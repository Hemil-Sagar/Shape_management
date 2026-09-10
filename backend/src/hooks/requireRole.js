const { Forbidden } = require('@feathersjs/errors')

// Feathers-hook equivalent of middleware/auth.js's requireRole(role).
// Must run AFTER authenticate() in the before.all chain so params.user exists.
module.exports = function requireRole(role) {
    return async (context) => {
        if (context.params.user.role !== role) {
            throw new Forbidden('You do not have permission')
        }
        return context
    }
}