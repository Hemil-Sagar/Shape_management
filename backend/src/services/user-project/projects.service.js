const { ProjectsService } = require('./projects.class')
const hooks = require('./projects.hooks')

module.exports = function (app) {
  app.use('/api/projects', new ProjectsService({}, app))
  const service = app.service('api/projects')
  service.hooks(hooks)
}