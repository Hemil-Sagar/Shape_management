const authenticate = require('../../hooks/authenticate')
const requireRole = require('../../hooks/requireRole')

module.exports = {
    before: {
        all: [authenticate(), requireRole('admin')],
    },
    after: {
        all: [],
    },
    error: {
        all: [],
    },
}