const { ShapeAvailabilityService } = require('./shape-availibility.class')
const hooks = require('./shape-avaibility.hooks')

module.exports = function (app) {
  app.use('/api/shapes/available-for-project', new ShapeAvailabilityService({}, app))
  app.service('api/shapes/available-for-project').hooks(hooks)
}