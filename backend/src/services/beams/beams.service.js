const { BeamsService } = require('./beams.class')
const hooks = require('./beams.hooks')
const buildBeamsRoutes = require('./beams.routes')

module.exports = function (app) {
  const beamsService = new BeamsService({}, app)

  app.use('/api/beams', beamsService)
  const service = app.service('api/beams')
  service.hooks(hooks)

  // Mounted after the Feathers service, same as the original app.js ordering
  // (beamCalcul
  // Node.js v20.20.2ateRoutes was the very last thing mounted on '/api/beams').
  app.use('/api/beams', buildBeamsRoutes(beamsService))
}