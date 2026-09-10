const express = require('express')
const { requireAuth, requireRole } = require('../../middleware/auth')
const { upload } = require('../../utils/upload')
const asyncHandler = require('../../utils/asyncHandler')

// Everything here is a custom action that doesn't map onto Feathers' standard
// find/get/create/patch/remove REST verbs. Mounted BEFORE the Feathers service
// (see admin-custom-shapes.service.js) so Express matches these exact paths
// first, then falls through to the Feathers service for the plain CRUD routes
// (GET /, GET /:id, PATCH /:id, DELETE /:id).
module.exports = function (service) {
    const router = express.Router()

    router.use(requireAuth, requireRole('admin'))

    router.get('/for-user', asyncHandler(async (req, res) => {
        const result = await service.getForUser({ query: req.query })
        res.json(result)
    }))

    router.post('/user', upload.single('image'), asyncHandler(async (req, res) => {
        const result = await service.createForUser(req.body, { user: req.user, file: req.file })
        res.status(201).json(result)
    }))

    router.post('/clone-from-global', asyncHandler(async (req, res) => {
        const result = await service.cloneFromGlobal(req.body, { user: req.user })
        res.status(201).json(result)
    }))

    router.post('/clone-from-custom', asyncHandler(async (req, res) => {
        const result = await service.cloneFromCustom(req.body, { user: req.user })
        res.status(201).json(result)
    }))

    router.patch('/:id/formula-override', asyncHandler(async (req, res) => {
        const result = await service.formulaOverride(req.params.id, req.body, { user: req.user })
        res.json(result)
    }))

    router.post('/:id/deactivate', asyncHandler(async (req, res) => {
        const result = await service.deactivate(req.params.id, { user: req.user })
        res.json(result)
    }))

    router.post('/:id/reactivate', asyncHandler(async (req, res) => {
        const result = await service.reactivate(req.params.id, { user: req.user })
        res.json(result)
    }))

    router.delete('/:id', asyncHandler(async (req, res) => {
        await service.remove(req.params.id)
        res.status(204).end()
    }))

    return router
}