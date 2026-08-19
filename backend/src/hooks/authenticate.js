const { NotAuthenticated } = require('@feathersjs/errors')
const { verifyToken } = require('../utils/auth')
module.exports = function authenticate() {
  return async (context) => {
    const authHeader = context.params.headers?.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      throw new NotAuthenticated('Not loggen in')
    }
    try {
      context.params.user = verifyToken(token)
    } catch {
      throw new NotAuthenticated('Session expired please log in again')
    }
    return context
  }
}