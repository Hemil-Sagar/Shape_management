const authenticate = require('../../hooks/authenticate')
const { before, after } = require('../dashboard-user/dashboard-user.hooks')

module.exports = {
  before: {
    all: [authenticate()],
  },
  after: {
    all: [],
  },
  error: {
    all: [],
  },
}
