const { AdminCustomShapesService } = require('./admin-custom-shapes.class')
const hooks = require('./admin-custom-shapes.hooks')
const buildRoutes = require('./admin-custom-shapes.routes')
const { upload } = require('../../utils/upload')

module.exports = function (app) {
    const service = new AdminCustomShapesService({}, app)

    // Custom actions first (for-user, user, clone-from-*, formula-override,
    // deactivate/reactivate, delete-with-204) so Express matches them before
    // falling through to the Feathers service below.
    app.use('/api/custom-shapes', buildRoutes(service))

    // multer for the plain PATCH /:id (optional "image" field); no-op otherwise.
    app.use('/api/custom-shapes', upload.single('image'), (req, res, next) => {
        req.feathers.file = req.file
        next()
    })

    app.use('/api/custom-shapes', service)
    const registered = app.service('api/custom-shapes')
    registered.hooks(hooks)
}