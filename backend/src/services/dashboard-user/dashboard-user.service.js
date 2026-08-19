const { DashBoardUserService } = require('./dashboard-user.class')
const hooks = require('./dashboard-user.hooks')

module.exports = function (app) {
  app.use('/api/dashboard/user', new DashBoardUserService({}, app))
  const service = app.service('api/dashboard/user')
  service.hooks(hooks)
}

