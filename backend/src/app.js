const express = require('@feathersjs/express')
const feathers = require('@feathersjs/feathers')
const cors = require("cors")

const imageRoutes = require('./routes/images') // streams binary + custom headers, not a good fit for Feathers REST - left as-is

const configureAuthService = require('./services/auth/auth.service')
const configureAdminUsersService = require('./services/admin-users/admin-users.service')
const configureDashboardService = require('./services/dashboard/dashboard.service')
const configureShapesService = require('./services/shapes/shapes.service')
const configureAdminCustomShapesService = require('./services/admin-custom-shapes/admin-custom-shapes.service')
// NOTE: user-custom-shapes was never mounted in the original app.js either (dead code) - see
// services/user-custom-shapes/user-custom-shapes.service.js for how to wire it up if you want it live.

const configureDashboardUserService = require('./services/dashboard-user/dashboard-user.service')
const configureProjectsService = require('./services/user-project/projects.service')
const configureBlocksService = require('./services/blocks/blocks.service')
const configureFloorsService = require('./services/floors/floors.service')
const configureAutoCadService = require('./services/autocad/autocad.service')
const confugureBeamsService = require('./services/beams/beams.service')
const configureShapeAvailabilityService = require('./services/shape-availibility/shape-availability.service')
const configureShapeResolveService = require('./services/shape-resolve/shape-resolve.service')

function createApp() {
  const app = express(feathers())

  app.use(cors())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.configure(express.rest())

  app.configure(configureDashboardUserService)
  app.configure(configureProjectsService)
  app.configure(configureBlocksService)
  app.configure(configureFloorsService)
  app.configure(configureAutoCadService)
  app.configure(confugureBeamsService)
  app.configure(configureShapeAvailabilityService)
  app.configure(configureShapeResolveService)

  app.configure(configureAuthService)
  app.configure(configureAdminUsersService)
  app.configure(configureDashboardService)
  app.configure(configureShapesService)
  app.configure(configureAdminCustomShapesService)

  app.use('/api/images', imageRoutes)

  app.use((err, req, res, next) => {
    console.error(err)
    const status = err.code || err.status || err.statusCode || 500
    res.status(status).json({ error: err.message || "Something went wrong" })
  })
  return app
}

module.exports = createApp