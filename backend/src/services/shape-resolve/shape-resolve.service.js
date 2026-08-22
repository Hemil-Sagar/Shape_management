const { ShapeResolveService } = require('./shape-resolve.class')
const hooks = require('./shape-resolve.hooks')

module.exports = function (app) {
  app.use('/api/shapes/resolve', new ShapeResolveService({}, app))
  app.service('api/shapes/resolve').hooks(hooks)
}