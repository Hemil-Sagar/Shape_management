const { authenticate } = require('@feathersjs/authentication').hooks
const { hashPassword, protect } = require('@feathersjs/authentication-local').hooks

module.exports = {
  before: {
    all: [],
    create: [hashPassword('password')],

    find: [authenticate('jwt')],
    get: [authenticate('jwt')],
    update: [hashPassword('password'), authenticate('jwt')],
    patch: [hashPassword('password'), authenticate('jwt')],
    remove: [authenticate('jwt')]
  },

  after: {

    all: [protect('password')]
  },

  error: {
    all: []
  }
}