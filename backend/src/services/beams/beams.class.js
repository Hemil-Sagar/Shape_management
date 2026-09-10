const { ObjectId } = require('mongodb')
const { getDb } = require('../../db')
const { NotFound, BadRequest } = require('@feathersjs/errors')
const { assertProjectAccess } = require('../../utils/projectAccess')
const { resolveShapeForProject } = require('../../utils/shapeResolver')
const {
  calculateShapeOutputs,
  parseBarDia,
  calculateLd,
  CONCRETE_GRADE_VALUES,
  STEEL_GRADE_VALUES,
} = require('../../utils/formulaUtils')

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
    this.db = getDb()
  }

  async find(params) {
    const { projectId, autocadImportId, searchText, statusFilter } = params.query || {}

    if (!projectId || !autocadImportId) {
      throw new BadRequest('projectId and autocadImportId are required')
    }

    await assertProjectAccess(this.db, projectId, params.user)

    const filter = { project_id: projectId, autocad_import_id: autocadImportId }
    if (searchText) {
      filter.beam_name = new RegExp(searchText, 'i')
    }
    if (statusFilter && statusFilter !== 'All') {
      filter.status = statusFilter
    }

    const beams = await this.db
      .collection('beams')
      .find(filter)
      .sort({created_at: -1})
      .toArray()
    return beams.map(toBeamResponse)
  }
  async get(id, params) {

    let objectId
    try {
      objectId = new ObjectId(id)
    } catch {
      throw new NotFound('Beam not found')
    }

    const beam = await this.db.collection('beams').findOne({ _id: objectId })
    if (!beam) {
      throw new NotFound('beam not found')
    }
    await assertProjectAccess(this.db, beam.project_id, params.user)

    return toBeamResponse(beam)
  }
  // POST /api/beams/:id/calculate
  async calculate(id, data, params) {
    let objectId
    try {
      objectId = new ObjectId(id)
    } catch {
      throw new NotFound('Beam not found.')
    }

    const { selectedShapeKey, projectId, inputs } = data
    if (!projectId || !selectedShapeKey || !inputs) {
      throw new BadRequest('projectId, selectedShapeKey, and inputs are required.')
    }

    const beam = await this.db.collection('beams').findOne({ _id: objectId })
    if (!beam) throw new NotFound('Beam not found.')

    await assertProjectAccess(this.db, projectId, params.user)

    const { number_of_repetitions, BX, BY, BZ, CX, CY, bar_dia, CO, grade_of_concrete, grade_of_steel, SD, LS, SS } = inputs

    if (!(Number(BX) > 0)) throw new BadRequest('Beam length is required.')
    if (!(Number(BY) > 0)) throw new BadRequest('Beam width is required.')
    if (!(Number(BZ) > 0)) throw new BadRequest('Beam depth is required.')

    const selectedShape = await resolveShapeForProject(this.db, projectId, selectedShapeKey)
    if (!selectedShape) throw new NotFound('Selected shape could not be resolved.')

    const { bar: BR, dia: D } = parseBarDia(bar_dia)
    const GC = CONCRETE_GRADE_VALUES[grade_of_concrete]
    const GS = STEEL_GRADE_VALUES[grade_of_steel]
    const LD = calculateLd(grade_of_concrete, grade_of_steel, D)

    const variables = {
      number_of_repetitions: Number(number_of_repetitions) || 1,
      BX: Number(BX),
      BY: Number(BY),
      BZ: Number(BZ),
      CX: Number(CX) || 0,
      CY: Number(CY) || 0,
      CO: Number(CO) || 0,
      BR, D, GC, GS, LD,
      SD: Number(SD) || 8,
      LS: Number(LS) || 2,
      SS: Number(SS) || 150,
    }

    const outputs = calculateShapeOutputs(selectedShape, variables)

    const beamUpdate = {
      selected_shape_key: selectedShapeKey,
      shape_id: selectedShape.shape_id,
      shape_name: selectedShape.shape_name,
      shape_source: selectedShape.shape_source,
      base_shape_id: selectedShape.base_shape_id,
      custom_shape_id: selectedShape.custom_shape_id,
      inputs: {
        number_of_repetitions: variables.number_of_repetitions, BX: variables.BX, BY: variables.BY, BZ: variables.BZ,
        CX: variables.CX, CY: variables.CY, CO: variables.CO, bar_dia, BR, D,
        grade_of_concrete_label: grade_of_concrete, grade_of_steel_label: grade_of_steel,
        GC, GS, LD, SD: variables.SD, LS: variables.LS, SS: variables.SS,
      },
      outputs,
      status: 'Filled',
      updated_at: new Date(),
    }

    const updated = await this.db.collection('beams').findOneAndUpdate({ _id: objectId }, { $set: beamUpdate }, { returnDocument: 'after' })

    return {
      id: updated._id.toString(), project_id: updated.project_id, autocad_import_id: updated.autocad_import_id,
      block_id: updated.block_id || null, block_name: updated.block_name || null,
      floor_id: updated.floor_id || null, floor_name: updated.floor_name || null,
      beam_name: updated.beam_name, beam_description: updated.beam_description || '',
      status: updated.status, inputs: updated.inputs, outputs: updated.outputs,
      selected_shape_key: updated.selected_shape_key, shape_source: updated.shape_source,
      shape_id: updated.shape_id, custom_shape_id: updated.custom_shape_id,
      created_by: updated.created_by, created_by_name: updated.created_by_name,
      created_at: updated.created_at, updated_at: updated.updated_at,
    }
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

    await assertProjectAccess(this.db, project_id, params.user)

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
    const result = await this.db.collection('beams').insertOne(newBeam)
    newBeam._id = result.insertedId

    return toBeamResponse(newBeam)
  }
}

module.exports = { BeamsService }