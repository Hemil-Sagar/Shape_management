const { ObjectId } = require('mongodb')
const { getDb } = require('../../db')
const { NotFound, BadRequest } = require('@feathersjs/errors')
const { assertProjectAccess } = require('../../utils/projectAccess')

function toFloorResponse(doc) {
  return {
    id: doc._id.toString(),
    project_id: doc.project_id,
    block_id: doc.block_id,
    project_code: doc.project_code || null,
    block_name: doc.block_name || null,
    floor_name: doc.floor_name,
    floor_description: doc.floor_description || '',
    created_by: doc.created_by,
    created_by_name: doc.created_by_name,
    created_at: doc.created_at,
    updated_at: doc.updated_at || null,
    status: doc.status,
  }
}

class FloorsService {
  constructor(options = {}, app) {
    this.options = options
    this.app = app
    this.db = getDb()
  }

  // GET /api/floors?projectId=&blockId=&searchText=
  async find(params) {
    const { projectId, blockId, searchText } = params.query || {}

    if (!projectId || !blockId) {
      throw new BadRequest('projectId and blockId are required.')
    }

    await assertProjectAccess(this.db, projectId, params.user)

    const filter = { project_id: projectId, block_id: blockId }
    if (searchText) {
      filter.floor_name = new RegExp(searchText, 'i')
    }

    const floors = await this.db
      .collection('floors')
      .find(filter)
      .sort({ created_at: -1 })
      .toArray()

    return floors.map(toFloorResponse)
  }

  // GET /api/floors/:id
  async get(id, params) {

    let objectId
    try {
      objectId = new ObjectId(id)
    } catch {
      throw new NotFound('Floor not found')
    }

    const floor = await this.db.collection('floors').findOne({ _id: objectId })
    if (!floor) throw new NotFound('Floor not found')

    await assertProjectAccess(this.db, floor.project_id, params.user)

    return toFloorResponse(floor)
  }

  // POST /api/floors
  async create(data, params) {
    const { project_id, block_id, project_code, block_name, floor_name, floor_description } = data

    if (!project_id || !block_id || !floor_name || !floor_name.trim()) {
      throw new BadRequest('project_id, block_id, and floor_name are required.')
    }

    await assertProjectAccess(this.db, project_id, params.user)

    const now = new Date()
    const newFloor = {
      project_id,
      block_id,
      project_code: project_code || null,
      block_name: block_name || null,
      floor_name: floor_name.trim(),
      floor_description: floor_description || '',
      created_by: params.user.email,
      created_by_name: params.user.name,
      created_at: now,
      updated_at: now,
      status: 'Active',
    }

    const result = await this.db.collection('floors').insertOne(newFloor)
    newFloor._id = result.insertedId

    return toFloorResponse(newFloor)
  }
}

module.exports = { FloorsService }