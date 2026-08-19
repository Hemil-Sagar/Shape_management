const { ObjectId } = require('mongodb')
const { getDb } = require('../../db')
const { NotFound, BadRequest } = require('@feathersjs/errors')
const { assertProjectAccess } = require('../../utils/projectAccess')

function toBeamResponse(doc) {
  return {
    id: doc._id.toString(),
    project_id: doc.project_id,
    autocad_import_id: doc.autocad_import_id,
    block_id: doc.block_id || null,
    block_name: doc.block_name || null,
    floor_id: doc.floor_id || null,
    floor_name: doc.floor_name || null,
    beam_name: doc.beam_name,
    beam_description: doc.beam_description || '',
    status: doc.status || 'Unfilled',
    inputs: doc.inputs || {},
    outputs: doc.outputs || [],
    selected_shape_key: doc.selected_shape_key || null,
    shape_source: doc.shape_source || null,
    shape_id: doc.shape_id || null,
    custom_shape_id: doc.custom_shape_id || null,
    created_by: doc.created_by,
    created_by_name: doc.created_by_name,
    created_at: doc.created_at,
    updated_at: doc.updated_at || null,
  }
}

class BeamsService{
  constructor(options = {}, app) {
    this.outputs = options
    this.app = app
  }

  async find(params) {
    const db = getDb()
    const { projectId, autocadImportId, searchText, statusFilter } = params.query || {}

    if (!projectId || !autocadImportId) {
      throw new BadRequest('projectId and autocadImportId are required')
    }

    await assertProjectAccess(db, projectId, params.user)

    const filter = { project_id: projectId, autocad_import_id: autocadImportId }
    if (searchText) {
      filter.beam_name = new RegExp(searchText, 'i')
    }
    if (statusFilter && statusFilter !== 'All') {
      filter.status = statusFilter
    }

    const beams = await db
      .collection('beams')
      .find(filter)
      .sort({created_at: -1})
      .toArray()
    return beams.map(toBeamResponse)
  }
  async get(id, params) {
    const db = getDb()

    let objectId
    try {
      objectId = new ObjectId(id)
    } catch {
      throw new NotFound('Beam not found')
    }

    const beam = await db.collection('beams').findOne({ _id: objectId })
    if (!beam) {
      throw new NotFound('beam not found')
    }
    await assertProjectAccess(db, beam.project_id, params.user)

    return toBeamResponse(beam)
  }

  async create(data, params) {
    const {
      project_id,
      autocad_import_id,
      block_id,
      block_name,
      floor_id,
      floor_name,
      beam_name,
      beam_description
    } = data

    if (!project_id || !autocad_import_id) {
      throw new BadRequest('projectid and autocadimportid are required')
    }

    if (!beam_name || !beam_name.trim()) {
      throw new BadRequest('beam_name id requireed')
    }

    const db = getDb()
    await assertProjectAccess(db, project_id, params.user)

    const now = new Date()
    const newBeam = {
      project_id,
      autocad_import_id,
      block_id: block_id || null,
      block_name: block_name || null,
      floor_id: floor_id || null,
      floor_name: floor_name || null,
      beam_name: beam_name.trim(),
      beam_description: (beam_description || '').trim(),
      status: 'Unfilled',
      inputs: {},
      outputs: [],
      selected_shape_key: null,
      shape_source: null,
      shape_id: null,
      custom_shape_id: null,
      created_by: params.user.email,
      created_by_name: params.user.name,
      created_at: now,
      updated_at: now,
    }
    const result = await db.collection('beams').insertOne(newBeam)
    newBeam._id = result.insertedId

    return toBeamResponse(newBeam)
  }
}

module.exports = { BeamsService }