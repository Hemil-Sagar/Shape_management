const { BeamsService } = require('./beams.class')
const hooks = require('./beams.hooks')

module.exports = function (app) {
  app.use('/api/beams', new BeamsService({}, app))
  const service = app.service('api/beams')
  service.hooks(hooks)
}