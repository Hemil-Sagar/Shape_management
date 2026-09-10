const { getDb } = require('../../db')
const { hashPassword } = require('../../utils/auth')
const { getNextUserId } = require('../../utils/ids')
const { NotFound, BadRequest } = require('@feathersjs/errors')

class AdminUsersService {
    constructor(options = {}, app) {
        this.options = options
        this.app = app
        this.db = getDb()
    }

    // GET /api/admin/users?searchText=&roleFilter=
    async find(params) {
        const { searchText, roleFilter } = params.query || {}

        const filter = {}

        if (searchText) {
            // Case-insensitive match on name OR email
            const regex = new RegExp(searchText, 'i')
            filter.$or = [{ name: regex }, { email: regex }]
        }

        if (roleFilter) {
            filter.role = roleFilter
        }

        const users = await this.db
            .collection('users')
            .find(filter)
            .project({ passwordHash: 0 }) // never send password hashes to the client
            .sort({ id: 1 })
            .toArray()

        return users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
        }))
    }

    // GET /api/admin/users/:userId
    async get(id) {
        const userId = Number(id)

        const user = await this.db.collection('users').findOne({ id: userId })
        if (!user) {
            throw new NotFound('User not found.')
        }

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
            },
            // Stubbed until Projects / AutoCAD Imports / Beams are built
            stats: {
                projects_count: 0,
                autocad_imports_count: 0,
                beams_count: 0,
                filled_beams_count: 0,
            },
            projects: [],
        }
    }

    // POST /api/admin/users
    async create(data) {
        const { name, email, password, role } = data

        if (!name || !email || !password) {
            throw new BadRequest('Name, email, and password are required.')
        }

        const safeRole = role === 'admin' ? 'admin' : 'user'

        const users = this.db.collection('users')

        const existing = await users.findOne({ email: email.toLowerCase() })
        if (existing) {
            throw new BadRequest('That email is already registered.')
        }

        const passwordHash = await hashPassword(password)
        const id = await getNextUserId(safeRole)

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

        return {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            status: newUser.status,
        }
    }
}

module.exports = { AdminUsersService }