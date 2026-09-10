const { AdminUsersService } = require('./admin-users.class')
const hooks = require('./admin-users.hooks')

module.exports = function (app) {
    app.use('/api/admin/users', new AdminUsersService({}, app))
    const service = app.service('api/admin/users')
    service.hooks(hooks)
}