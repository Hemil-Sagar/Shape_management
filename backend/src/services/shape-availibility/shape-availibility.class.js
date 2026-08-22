const { getDb } = require('../../db')
const { getAvailableShapesForProject } = require('../../utils/shapeResolver')
const { BadRequest } = require('@feathersjs/errors')

class ShapeAvailabilityService {
  constructor(options = {}, app) {
    this.options = options
    this.app = app
    this.db = getDb()
  }

  async find(params) {
    const { projectId, category } = params.query || {}
    if (!projectId) throw new BadRequest('projectId query parameter is required.')

    return getAvailableShapesForProject(this.db, projectId, category || 'beam')
  }
}

module.exports = { ShapeAvailabilityService }