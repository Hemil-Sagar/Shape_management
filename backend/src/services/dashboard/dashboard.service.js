const { DashboardService } = require('./dashboard.class')
const hooks = require('./dashboard.hooks')

module.exports = function (app) {
    app.use('/api/dashboard', new DashboardService({}, app))
    const service = app.service('api/dashboard')
    service.hooks(hooks)
}