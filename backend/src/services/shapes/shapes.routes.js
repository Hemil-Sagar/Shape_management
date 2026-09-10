const express = require('express')
const { requireAuth, requireRole } = require('../../middleware/auth')
const asyncHandler = require('../../utils/asyncHandler')

// POST /api/shapes/:id/deactivate and /reactivate don't map onto Feathers'
// standard REST verbs, so they're handled here and mounted BEFORE the Feathers
// shapes service (see shapes.service.js) so Express matches these exact paths
// first, then falls through to the Feathers service for everything else.
module.exports = function (shapesService) {
    const router = express.Router()

    router.use(requireAuth, requireRole('admin'))

    router.post('/:id/deactivate', asyncHandler(async (req, res) => {
        const result = await shapesService.deactivate(req.params.id, { user: req.user })
        res.json(result)
    }))

    router.post('/:id/reactivate', asyncHandler(async (req, res) => {
        const result = await shapesService.reactivate(req.params.id, { user: req.user })
        res.json(result)
    }))

    return router
}