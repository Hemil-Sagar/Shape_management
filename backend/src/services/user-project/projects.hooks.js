const authenticate = require('../../hooks/authenticate')
const { all } = require('../../routes/auth')
const { before, after } = require('../dashboard-user/dashboard-user.hooks')

module.exports = {
  before: {
    all:[authenticate()],
  },
  after: {
    all:[],
  },
  error: {
    all:[],
  },
}