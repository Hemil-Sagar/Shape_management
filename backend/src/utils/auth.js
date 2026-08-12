const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const env = require("../config/env")

async function hashPassword(plainPassword) {
  const saltRounds = 10
  return bcrypt.hash(plainPassword, saltRounds)
}

async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash)
}
// jwt

const signToken= (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  }
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn })  
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret)
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken }