const { FloorsService } = require('./floors.class')
const hooks = require('./floors.hooks')

module.exports = function (app) {
  app.use('/api/floors', new FloorsService({}, app))
  const service = app.service('api/floors')
  service.hooks(hooks)
}