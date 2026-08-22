const express = require('express')
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')
const { requireAuth } = require('../middleware/auth')
const asyncHandler = require('../utils/asyncHandler')
const { resolveShapeForProject } = require('../utils/shapeResolver')
const { assertProjectAccess } = require('../utils/projectAccess')
const { calculateShapeOutputs, parseBarDia, calculateLd, CONCRETE_GRADE_VALUES, STEEL_GRADE_VALUES } = require('../utils/formulaUtils')

const router = express.Router()
router.use(requireAuth)
router.use((req, res, next) => {
  req.db = getDb()
  next()
})

router.post('/:id/calculate', asyncHandler(async (req, res) => {
  

  let objectId
  try {
    objectId = new ObjectId(req.params.id)
  } catch {
    return res.status(404).json({ error: 'Beam not found.' })
  }

  const { selectedShapeKey, projectId, inputs } = req.body
  if (!projectId || !selectedShapeKey || !inputs) {
    return res.status(400).json({ error: 'projectId, selectedShapeKey, and inputs are required.' })
  }

  const beam = await req.db.collection('beams').findOne({ _id: objectId })
  if (!beam) return res.status(404).json({ error: 'Beam not found.' })

  await assertProjectAccess(req.db, projectId, req.user)

  const { number_of_repetitions, BX, BY, BZ, CX, CY, bar_dia, CO, grade_of_concrete, grade_of_steel, SD, LS, SS } = inputs

  if (!(Number(BX) > 0)) return res.status(400).json({ error: 'Beam length is required.' })
  if (!(Number(BY) > 0)) return res.status(400).json({ error: 'Beam width is required.' })
  if (!(Number(BZ) > 0)) return res.status(400).json({ error: 'Beam depth is required.' })

  const selectedShape = await resolveShapeForProject(req.db, projectId, selectedShapeKey)
  if (!selectedShape) return res.status(404).json({ error: 'Selected shape could not be resolved.' })

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
    SD: Number(SD) || 8, LS: Number(LS) || 2, SS: Number(SS) || 150,
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

  const updated = await req.db.collection('beams').findOneAndUpdate({ _id: objectId }, { $set: beamUpdate }, { returnDocument: 'after' })

  res.json({
    id: updated._id.toString(), project_id: updated.project_id, autocad_import_id: updated.autocad_import_id,
    block_id: updated.block_id || null, block_name: updated.block_name || null,
    floor_id: updated.floor_id || null, floor_name: updated.floor_name || null,
    beam_name: updated.beam_name, beam_description: updated.beam_description || '',
    status: updated.status, inputs: updated.inputs, outputs: updated.outputs,
    selected_shape_key: updated.selected_shape_key, shape_source: updated.shape_source,
    shape_id: updated.shape_id, custom_shape_id: updated.custom_shape_id,
    created_by: updated.created_by, created_by_name: updated.created_by_name,
    created_at: updated.created_at, updated_at: updated.updated_at,
  })
}))

module.exports = router
