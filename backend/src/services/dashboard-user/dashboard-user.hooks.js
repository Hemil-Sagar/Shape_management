const authenticate = require('../../hooks/authenticate')

module.exports = {
  before: {
    all: [authenticate()],
  },
  after: {
    all:[],
  },
  error: {
    all: [],
  },
}