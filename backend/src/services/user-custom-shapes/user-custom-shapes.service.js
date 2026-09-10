const { UserCustomShapesService } = require('./user-custom-shapes.class')
const hooks = require('./user-custom-shapes.hooks')

// NOTE: the original routes/usercustomShapes.js was never mounted anywhere in
// app.js, so it was dead code - unreachable by the frontend. This migration
// preserves that (this module is NOT required/configured in app.js either).
// If you actually want this live, pick a mount path and app.configure() it
// the same way as the other services, e.g.:
//   app.use('/api/my-custom-shapes', new UserCustomShapesService({}, app))
//   app.service('api/my-custom-shapes').hooks(hooks)
module.exports = function (app, mountPath) {
    app.use(mountPath, new UserCustomShapesService({}, app))
    const service = app.service(mountPath.replace(/^\//, ''))
    service.hooks(hooks)
}