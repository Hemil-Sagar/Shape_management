const { MongoDBService } = require('@feathersjs/mongodb')
const hooks = require('./users.hooks')

const configureUsersService = (app) => {

  const db = app.get('mongodbClient')

  class UserService extends MongoDBService {}

  app.use('users', new UserService({
    Model: db.collection('users'),
    paginate: false,
    multi: false
  }))

  app.service('users').hooks(hooks)
}

module.exports = configureUsersService