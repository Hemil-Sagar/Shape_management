const { AuthService } = require('./auth.class')
const buildAuthRoutes = require('./auth.routes')

module.exports = function (app) {
    const authService = new AuthService({}, app)
    app.use('/api/auth', buildAuthRoutes(authService))
}