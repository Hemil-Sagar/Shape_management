const express = require('@feathersjs/express')
const feathers = require('@feathersjs/feathers')
const cors = require("cors")
const path = require('path')

const authRoutes = require('./routes/auth')
const adminUsersRoutes = require('./routes/adminUsers')
const dashboardRoutes = require("./routes/dashboard")
const shapeRoutes = require('./routes/shapes')
const admincustomShapesRoutes = require('./routes/admincustomShapes')
const { UPLOADS_DIR } = require('./utils/upload')

function createApp() {
  const app = express(feathers())

  app.use(cors())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  app.use('/api/images', express.static(UPLOADS_DIR))
  app.use("/api/auth", authRoutes)
  app.use("/api/admin/users", adminUsersRoutes)
  app.use("/api/dashboard", dashboardRoutes)
  app.use('/api/shapes', shapeRoutes)
  app.use('/api/custom-shapes', admincustomShapesRoutes)

  app.use((err, req, res, next) => {
    console.error(err)
    const status = err.status || err.statusCode || 500
    res.status(status).json({error:err.message || "Something went wrong"})
  })
  return app
}

module.exports = createApp