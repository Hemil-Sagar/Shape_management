const express = require('@feathersjs/express')
const feathers = require('@feathersjs/feathers')
const cors = require("cors")

const authRoutes = require('./routes/auth')
const adminUsersRoutes = require('./routes/adminUsers')
const dashboardRoutes = require("./routes/dashboard")
const shapeRoutes = require('./routes/shapes')
const admincustomShapesRoutes = require('./routes/admincustomShapes')
const imageRoutes = require('./routes/images')
const configureDashboardUserService = require('./services/dashboard-user/dashboard-user.service')
const configureProjectsService = require('./services/user-project/projects.service')
const configureBlocksService = require('./services/blocks/blocks.service')
const configureFloorsService = require('./services/floors/floors.service')
const configureAutoCadService = require('./services/autocad/autocad.service')
const confugureBeamsService = require('./services/beams/beams.service')

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
  
  app.use('/api/images', imageRoutes)
  app.use("/api/auth", authRoutes)
  app.use("/api/admin/users", adminUsersRoutes)
  app.use("/api/dashboard", dashboardRoutes)
  app.use('/api/shapes', shapeRoutes)
  app.use('/api/custom-shapes', admincustomShapesRoutes)

  app.use((err, req, res, next) => {
    console.error(err)
    const status = err.code ||err.status || err.statusCode || 500
    res.status(status).json({error:err.message || "Something went wrong"})
  })
  return app
}

module.exports = createApp