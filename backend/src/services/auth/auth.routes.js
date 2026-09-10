const express = require('express')
const asyncHandler = require('../../utils/asyncHandler')

// Auth is public - no authenticate() hook, exactly like the original routes/auth.js.
// Kept as a plain Express router (mounted alongside the service instance) because
// register/login are two POST actions on the same base path, which doesn't map onto
// Feathers' single POST "/" -> create() convention.
module.exports = function (authService) {
    const router = express.Router()

    router.post('/register', asyncHandler(async (req, res) => {
        const result = await authService.register(req.body)
        res.status(201).json(result)
    }))

    router.post('/login', asyncHandler(async (req, res) => {
        const result = await authService.login(req.body)
        res.json(result)
    }))

    return router
}