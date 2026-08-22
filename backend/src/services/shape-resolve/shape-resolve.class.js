// services/shape-resolve/shape-resolve.class.js
const { getDb } = require('../../db')
const { resolveShapeForProject } = require('../../utils/shapeResolver')
const { NotFound, BadRequest } = require('@feathersjs/errors')

class ShapeResolveService {
  constructor(options = {}, app) {
    this.options = options
    this.app = app
    this.db = getDb()
  }

  async find(params) {
    const { projectId, selectedShapeKey, shapeId } = params.query || {}
    if (!projectId) {
      throw new BadRequest('projectId query is required')
    }

    const resolved = await resolveShapeForProject(this.db, projectId, selectedShapeKey || null, shapeId || null)

    if (!resolved) {
      throw new NotFound('Could not resolve shape for this project')
    }

    return resolved
  }
}

module.exports = { ShapeResolveService }