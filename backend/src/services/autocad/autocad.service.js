const { AutocadImportsService } = require('./autocad.class') 
const hooks = require('./autocad.hooks') 

module.exports = function (app) {

  app.use('/api/autocad-imports', new AutocadImportsService({}, app)) 
  const service = app.service('api/autocad-imports') 
  service.hooks(hooks) 
} 