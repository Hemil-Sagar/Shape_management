import { Router } from "express";
import { beamsCollection, toObjectId } from "../db/index.js";
import { resolveShapeForProject } from "../services/shapeResolver.js";
import {
  calculateShapeOutputs,
  parseBarDia,
  calculateLd,
  CONCRETE_GRADE_VALUES,
  STEEL_GRADE_VALUES,
} from "../utils/formulaUtils.js";

const router = Router();

function toJson(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// GET /api/beams?projectId=X&autocadImportId=Y&searchText=Z&statusFilter=W
router.get("/", async (req, res) => {
  const { projectId, autocadImportId, searchText, statusFilter } = req.query;

  if (!projectId || !autocadImportId) {
    return res.status(400).json({ error: "projectId and autocadImportId query parameters are required." });
  }

  const query = { project_id: projectId, autocad_import_id: autocadImportId };
  if (searchText) {
    query.beam_name = { $regex: searchText, $options: "i" };
  }
  if (statusFilter && statusFilter !== "All") {
    query.status = statusFilter;
  }

  const beams = await beamsCollection.find(query).sort({ created_at: -1 }).toArray();
  res.json(beams.map(toJson));
});

// GET /api/beams/:id
router.get("/:id", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Beam not found." });

  const beam = await beamsCollection.findOne({ _id: oid });
  if (!beam) return res.status(404).json({ error: "Beam not found." });

  res.json(toJson(beam));
});

// POST /api/beams
router.post("/", async (req, res) => {
  const {
    project_id,
    autocad_import_id,
    block_id,
    block_name,
    floor_id,
    floor_name,
    beam_name,
    beam_description,
  } = req.body;

  if (!project_id || !autocad_import_id || !beam_name) {
    return res.status(400).json({ error: "Project, AutoCAD import, and beam name are required." });
  }

  const now = new Date();
  const beamData = {
    project_id,
    autocad_import_id,
    block_id,
    block_name,
    floor_id,
    floor_name,
    beam_name,
    beam_description: beam_description || "",
    shape_id: null,
    shape_name: null,
    selected_shape_key: null,
    shape_source: null,
    base_shape_id: null,
    custom_shape_id: null,
    inputs: {},
    outputs: [],
    status: "Unfilled",
    created_by: req.user.email,
    created_by_name: req.user.name,
    created_at: now,
    updated_at: now,
  };

  const result = await beamsCollection.insertOne(beamData);
  res.status(201).json(toJson({ _id: result.insertedId, ...beamData }));
});

// PATCH /api/beams/:id/calculation
// Mirrors update_beam_calculation: arbitrary $set of whatever fields are given
// (calculation result payload), plus updated_at. Intentionally permissive —
// the beam-calculation route (owned by another agent) writes shape_id,
// inputs, outputs, status, etc. through this endpoint.
router.patch("/:id/calculation", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Beam not found." });

  const beamUpdate = { ...req.body, updated_at: new Date() };
  delete beamUpdate.id;
  delete beamUpdate._id;

  const result = await beamsCollection.updateOne({ _id: oid }, { $set: beamUpdate });
  if (result.matchedCount === 0) return res.status(404).json({ error: "Beam not found." });

  const updated = await beamsCollection.findOne({ _id: oid });
  res.json(toJson(updated));
});

// POST /api/beams/:id/calculate
// Body: { selectedShapeKey, projectId, inputs: { number_of_repetitions, BX, BY, BZ,
//   CX, CY, bar_dia, CO, grade_of_concrete, grade_of_steel, SD, LS, SS } }
// Resolves the live effective shape for the project, derives BR/D/GC/GS/LD server-side
// (mirrors ui/beams.py::beam_input_calculation_form), evaluates every output formula via
// calculateShapeOutputs, and persists the beam's shape selection + inputs + outputs.
router.post("/:id/calculate", async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(404).json({ error: "Beam not found." });

  const { selectedShapeKey, projectId, inputs } = req.body;

  if (!projectId || !selectedShapeKey || !inputs) {
    return res.status(400).json({ error: "projectId, selectedShapeKey, and inputs are required." });
  }

  const {
    number_of_repetitions,
    BX,
    BY,
    BZ,
    CX,
    CY,
    bar_dia,
    CO,
    grade_of_concrete,
    grade_of_steel,
    SD,
    LS,
    SS,
  } = inputs;

  if (!(Number(BX) > 0)) return res.status(400).json({ error: "Beam length is required." });
  if (!(Number(BY) > 0)) return res.status(400).json({ error: "Beam width is required." });
  if (!(Number(BZ) > 0)) return res.status(400).json({ error: "Beam depth is required." });

  const beam = await beamsCollection.findOne({ _id: oid });
  if (!beam) return res.status(404).json({ error: "Beam not found." });

  const selectedShape = await resolveShapeForProject(projectId, selectedShapeKey);
  if (!selectedShape) {
    return res.status(404).json({ error: "Selected shape could not be resolved." });
  }

  const { bar: BR, dia: D } = parseBarDia(bar_dia);
  const GC = CONCRETE_GRADE_VALUES[grade_of_concrete];
  const GS = STEEL_GRADE_VALUES[grade_of_steel];
  const LD = calculateLd(grade_of_concrete, grade_of_steel, D);

  const variables = {
    number_of_repetitions: Number(number_of_repetitions) || 1,
    BX: Number(BX),
    BY: Number(BY),
    BZ: Number(BZ),
    CX: Number(CX) || 0,
    CY: Number(CY) || 0,
    CO: Number(CO) || 0,
    BR,
    D,
    GC,
    GS,
    LD,
    SD: Number(SD) || 8,
    LS: Number(LS) || 2,
    SS: Number(SS) || 150,
  };

  const outputs = calculateShapeOutputs(selectedShape, variables);

  const beamUpdate = {
    selected_shape_key: selectedShapeKey,
    shape_id: selectedShape.shape_id,
    shape_name: selectedShape.shape_name,
    shape_source: selectedShape.shape_source,
    base_shape_id: selectedShape.base_shape_id,
    custom_shape_id: selectedShape.custom_shape_id,
    inputs: {
      number_of_repetitions: variables.number_of_repetitions,
      BX: variables.BX,
      BY: variables.BY,
      BZ: variables.BZ,
      CX: variables.CX,
      CY: variables.CY,
      CO: variables.CO,
      bar_dia,
      BR,
      D,
      grade_of_concrete_label: grade_of_concrete,
      grade_of_steel_label: grade_of_steel,
      GC,
      GS,
      LD,
      SD: variables.SD,
      LS: variables.LS,
      SS: variables.SS,
    },
    outputs,
    status: "Filled",
    updated_at: new Date(),
  };

  await beamsCollection.updateOne({ _id: oid }, { $set: beamUpdate });
  const updated = await beamsCollection.findOne({ _id: oid });
  res.json(toJson(updated));
});

export default router;
