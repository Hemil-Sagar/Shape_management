require('dotenv').config()

const { MongoClient } = require('mongodb')
const cors = require('cors')
const express = require('@feathersjs/express')
const feathers = require('@feathersjs/feathers')

const configureAuthentication = require('./authentication')
const configureUsersService = require('./services/users/users.service')

const start = async () => {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI)
    const db = client.db()

    const app = express(feathers())

    app.set('mongodbClient', db)

    app.set('authentication', {
      secret: process.env.JWT_SECRET,
      entity: 'user',
      service: 'users',
      authStrategies: ['jwt', 'local'],
      jwtOptions: {
        header: { typ: 'access' },
        audience: 'https://yourdomain.com',
        issuer: 'feathers',
        algorithm: 'HS256',
        expiresIn: '1d'
      },
      local: {
        usernameField: 'email',
        passwordField: 'password'
      }
    })

    app.use(cors())
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))
    app.configure(express.rest())

    app.configure(configureAuthentication)
    app.configure(configureUsersService)

    app.use(express.errorHandler())

    const port = process.env.PORT || 3030;
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`)
    })
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
}
start()