const { BlocksService } = require('./blocks.class')
const hooks = require('./blocks.hooks')

module.exports = function (app) {
  app.use('/api/blocks', new BlocksService({}, app))
  const service = app.service('api/blocks')
  service.hooks(hooks)
}
