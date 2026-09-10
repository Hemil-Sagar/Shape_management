const { ShapesService } = require('./shapes.class')
const hooks = require('./shapes.hooks')
const buildShapesRoutes = require('./shapes.routes')
const { upload } = require('../../utils/upload')

module.exports = function (app) {
    const shapesService = new ShapesService({}, app)

    // Custom actions (not standard REST verbs) first, so Express matches
    // their exact paths before falling through to the Feathers service below.
    app.use('/api/shapes', buildShapesRoutes(shapesService))

    // multer parses the multipart "image" field for create/patch; it's a no-op
    // for requests that aren't multipart (GET/DELETE etc pass straight through).
    // Stashing it on req.feathers makes it show up as params.file in the service.
    app.use('/api/shapes', upload.single('image'), (req, res, next) => {
        req.feathers.file = req.file
        next()
    })

    app.use('/api/shapes', shapesService)
    const service = app.service('api/shapes')
    service.hooks(hooks)
}