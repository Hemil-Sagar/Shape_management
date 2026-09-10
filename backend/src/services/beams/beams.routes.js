const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const asyncHandler = require('../../utils/asyncHandler')

// POST /api/beams/:id/calculate doesn't map onto Feathers' standard REST verbs
// (it's a POST that behaves like a patch), so it's handled here. Mounted AFTER
// the Feathers beams service (see beams.service.js) - same relative order as
// the original app.js, where beamCalculateRoutes was mounted last on the same
// '/api/beams' prefix. Feathers' own router doesn't match a two-segment path
// like "/:id/calculate", so it falls through to this router either way.
module.exports = function (beamsService) {
    const router = express.Router()

    router.use(requireAuth)

    router.post('/:id/calculate', asyncHandler(async (req, res) => {
        const result = await beamsService.calculate(req.params.id, req.body, { user: req.user })
        res.json(result)
    }))

    return router
}