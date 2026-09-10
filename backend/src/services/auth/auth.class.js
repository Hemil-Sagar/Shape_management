const { getDb } = require('../../db')
const { hashPassword, comparePassword, signToken } = require('../../utils/auth')
const { getNextUserId } = require('../../utils/ids')
const { BadRequest, Unauthorized } = require('@feathersjs/errors')

class AuthService {
    constructor(options = {}, app) {
        this.options = options
        this.app = app
        this.db = getDb()
    }

    // POST /api/auth/register
    // Body: { name, email, password, confirmPassword, role }
    async register(data) {
        const { name, email, password, confirmPassword, role } = data

        if (!name || !email || !password || !confirmPassword) {
            throw new BadRequest('All fields are required.')
        }
        if (password !== confirmPassword) {
            throw new BadRequest('Passwords do not match.')
        }
        const safeRole = role === 'admin' ? 'admin' : 'user' // anything else defaults to "user"

        const users = this.db.collection('users')

        const existing = await users.findOne({ email: email.toLowerCase() })
        if (existing) {
            throw new BadRequest('That email is already registered.')
        }

        // --- Create the user ---
        const passwordHash = await hashPassword(password)
        const id = await getNextUserId(safeRole) // 1,2,3... for users - 400,401... for admins

        const newUser = {
            id,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash,
            role: safeRole,
            status: 'active',
            createdAt: new Date(),
        }

        await users.insertOne(newUser)

        // Never send the password hash back to the client
        return {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
        }
    }

    // POST /api/auth/login
    // Body: { email, password }
    // Returns: { token, user: { id, name, email, role } }
    async login(data) {
        const { email, password } = data

        if (!email || !password) {
            throw new BadRequest('Email and password are required.')
        }

        const user = await this.db.collection('users').findOne({ email: email.toLowerCase() })

        if (!user) {
            throw new Unauthorized('Invalid email or password.')
        }

        const passwordMatches = await comparePassword(password, user.passwordHash)
        if (!passwordMatches) {
            throw new Unauthorized('Invalid email or password.')
        }

        const token = signToken(user) // expires in 24h - see utils/auth.js

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        }
    }
}

module.exports = { AuthService }