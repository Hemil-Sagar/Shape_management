const { ObjectId } = require('mongodb')
const { getDb } = require('../../db')
const { NotFound, BadRequest } = require('@feathersjs/errors')
const { assertProjectAccess } = require('../../utils/projectAccess')

function toBlockResponse(doc) {
  return {
    id: doc._id.toString(),
    project_id: doc.project_id,
    project_code: doc.project_code || null,
    block_name: doc.block_name,
    block_description: doc.block_description || '',
    created_by: doc.created_by,
    created_by_name: doc.created_by_name,
    created_at: doc.created_at,
    updated_at: doc.updated_at || null,
    status: doc.status,
  }
}

class BlocksService {
  constructor(options = {}, app) {
    this.options = options
    this.app = app
  }

  // GET /api/blocks?projectId=&searchText=
  async find(params) {
    const db = getDb()
    const { projectId, searchText } = params.query || {}

    if (!projectId) {
      throw new BadRequest('projectId is required.')
    }

    await assertProjectAccess(db, projectId, params.user)

    const filter = { project_id: projectId }
    if (searchText) {
      filter.block_name = new RegExp(searchText, 'i')
    }

    const blocks = await db
      .collection('blocks')
      .find(filter)
      .sort({ created_at: -1 })
      .toArray()

    return blocks.map(toBlockResponse)
  }

  // GET /api/blocks/:id
  async get(id, params) {
    const db = getDb()

    let objectId
    try {
      objectId = new ObjectId(id)
    } catch {
      throw new NotFound('Block not found')
    }

    const block = await db.collection('blocks').findOne({ _id: objectId })
    if (!block) throw new NotFound('Block not found')

    // Reuses the exact same project-ownership check as find/create.
    await assertProjectAccess(db, block.project_id, params.user)

    return toBlockResponse(block)
  }

  // POST /api/blocks
  async create(data, params) {
    const { project_id, project_code, block_name, block_description } = data

    if (!project_id || !block_name || !block_name.trim()) {
      throw new BadRequest('project_id and block_name are required.')
    }

    const db = getDb()
    await assertProjectAccess(db, project_id, params.user)

    const now = new Date()
    const newBlock = {
      project_id,
      project_code: project_code || null,
      block_name: block_name.trim(),
      block_description: block_description || '',
      created_by: params.user.email,
      created_by_name: params.user.name,
      created_at: now,
      updated_at: now,
      status: 'Active',
    }

    const result = await db.collection('blocks').insertOne(newBlock)
    newBlock._id = result.insertedId

    return toBlockResponse(newBlock)
  }
}

module.exports = { BlocksService }