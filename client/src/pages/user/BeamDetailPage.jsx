import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api, imageUrl } from "../../api/client.js";

const BAR_DIA_OPTIONS = ["2-T12", "2-T16", "4-T20", "3-T16", "3-T20", "2-T20", "4-T25", "3-T12EF"];
const CONCRETE_OPTIONS = ["M20", "M25", "M30", "M35", "M40"];
const STEEL_OPTIONS = ["Fe415", "Fe500"];

// Hidden/default constants for POC (not exposed as form fields), mirrors ui/beams.py.
const SD = 8;
const LS = 2;
const SS = 150;

export default function BeamDetailPage() {
  const { project } = useOutletContext();
  const { projectId, importId, beamId } = useParams();

  const [importItem, setImportItem] = useState(null);
  const [beam, setBeam] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setImportItem(null);
    setBeam(null);

    Promise.all([api(`/autocad-imports/${importId}`), api(`/beams/${beamId}`)])
      .then(([importData, beamData]) => {
        setImportItem(importData);
        setBeam(beamData);
      })
      .catch((err) => setError(err.message));
  }, [importId, beamId]);

  if (error) {
    return (
      <div>
        <div className="error-banner">{error}</div>
        <Link className="btn btn-secondary" to={`/projects/${projectId}/autocad-imports/${importId}`}>
          Back to Beams
        </Link>
      </div>
    );
  }

  if (!importItem || !beam) return <p>Loading...</p>;

  return (
    <div>
      <h1>Beam › {beam.beam_name || "Beam"}</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Home • {project.project_name || "Project"} • AutoCAD Import • {importItem.name || "Import"} • Beam
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

      <Link className="btn btn-secondary" to={`/projects/${projectId}/autocad-imports/${importId}`}>
        ← Back to Beam List
      </Link>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

      <BeamCalculationForm projectId={projectId} beam={beam} onSaved={setBeam} />
    </div>
  );
}

function reconstructShapeKey(beam) {
  if (beam.selected_shape_key) return beam.selected_shape_key;
  if (beam.shape_source === "custom" && beam.custom_shape_id) return `custom:${beam.custom_shape_id}`;
  if (beam.shape_id) return `global:${beam.shape_id}`;
  return "";
}

function BeamCalculationForm({ projectId, beam, onSaved }) {
  const [availableShapes, setAvailableShapes] = useState(null);
  const [shapesError, setShapesError] = useState("");

  const [selectedShapeKey, setSelectedShapeKey] = useState(() => reconstructShapeKey(beam));
  const [resolvedShape, setResolvedShape] = useState(null);
  const [resolveError, setResolveError] = useState("");

  const oldInputs = beam.inputs || {};
  const [numberOfRepetitions, setNumberOfRepetitions] = useState(oldInputs.number_of_repetitions ?? 1);
  const [bx, setBx] = useState(oldInputs.BX ?? 0);
  const [by, setBy] = useState(oldInputs.BY ?? 0);
  const [bz, setBz] = useState(oldInputs.BZ ?? 0);
  const [cx, setCx] = useState(oldInputs.CX ?? 0);
  const [cy, setCy] = useState(oldInputs.CY ?? 0);
  const [barDia, setBarDia] = useState(BAR_DIA_OPTIONS.includes(oldInputs.bar_dia) ? oldInputs.bar_dia : "2-T12");
  const [cover, setCover] = useState(oldInputs.CO ?? 25);
  const [gradeOfConcrete, setGradeOfConcrete] = useState(
    CONCRETE_OPTIONS.includes(oldInputs.grade_of_concrete_label) ? oldInputs.grade_of_concrete_label : "M25"
  );
  const [gradeOfSteel, setGradeOfSteel] = useState(
    STEEL_OPTIONS.includes(oldInputs.grade_of_steel_label) ? oldInputs.grade_of_steel_label : "Fe500"
  );

  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  const [currentOutputs, setCurrentOutputs] = useState(beam.outputs || []);

  // Load shapes available for this project.
  useEffect(() => {
    api(`/shapes/available-for-project?projectId=${projectId}&category=beam`)
      .then((data) => {
        setAvailableShapes(data);
        if (!selectedShapeKey && data.length > 0) {
          setSelectedShapeKey(data[0].option_key);
        }
      })
      .catch((err) => setShapesError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Resolve the effective shape+formulas whenever the selection changes.
  useEffect(() => {
    if (!selectedShapeKey) return;
    setResolveError("");
    setResolvedShape(null);
    api(
      `/shapes/resolve?projectId=${projectId}&selectedShapeKey=${encodeURIComponent(selectedShapeKey)}`
    )
      .then(setResolvedShape)
      .catch((err) => setResolveError(err.message));
  }, [projectId, selectedShapeKey]);

  if (shapesError) return <div className="error-banner">{shapesError}</div>;
  if (availableShapes === null) return <p>Loading shapes...</p>;
  if (availableShapes.length === 0) return <div className="error-banner">No beam shapes found.</div>;

  async function handleCalculate(e) {
    e.preventDefault();
    setFormError("");

    const beamLength = Number(bx);
    const beamWidth = Number(by);
    const beamDepth = Number(bz);

    if (!(beamLength > 0)) {
      setFormError("Beam length is required.");
      return;
    }
    if (!(beamWidth > 0)) {
      setFormError("Beam width is required.");
      return;
    }
    if (!(beamDepth > 0)) {
      setFormError("Beam depth is required.");
      return;
    }

    setSaving(true);
    try {
      const updated = await api(`/beams/${beam.id}/calculate`, {
        method: "POST",
        body: {
          selectedShapeKey,
          projectId,
          inputs: {
            number_of_repetitions: Number(numberOfRepetitions) || 1,
            BX: beamLength,
            BY: beamWidth,
            BZ: beamDepth,
            CX: Number(cx) || 0,
            CY: Number(cy) || 0,
            bar_dia: barDia,
            CO: Number(cover) || 0,
            grade_of_concrete: gradeOfConcrete,
            grade_of_steel: gradeOfSteel,
            SD,
            LS,
            SS,
          },
        },
      });
      onSaved(updated);
      setCurrentOutputs(updated.outputs || []);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h4>Shape:</h4>
      <div className="form-row" style={{ maxWidth: 400 }}>
        <select value={selectedShapeKey} onChange={(e) => setSelectedShapeKey(e.target.value)}>
          {availableShapes.map((item) => (
            <option key={item.option_key} value={item.option_key}>
              {item.option_label}
            </option>
          ))}
        </select>
      </div>

      {resolveError && <div className="error-banner">{resolveError}</div>}

      {resolvedShape && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3>{resolvedShape.shape_name || "Shape"}</h3>
          {resolvedShape.image_file_id ? (
            <img
              src={imageUrl(resolvedShape.image_file_id)}
              alt={resolvedShape.shape_name || "Shape"}
              style={{ maxWidth: 350, width: "100%" }}
            />
          ) : (
            <p style={{ color: "var(--muted)" }}>No image available for this shape.</p>
          )}
        </div>
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

      <form onSubmit={handleCalculate}>
        <h3>Beam Input Details</h3>

        <div className="form-row" style={{ maxWidth: 250 }}>
          <label>Number of Repetitions</label>
          <input
            type="number"
            min="1"
            step="1"
            value={numberOfRepetitions}
            onChange={(e) => setNumberOfRepetitions(e.target.value)}
          />
        </div>

        <div className="grid-3">
          <div className="form-row">
            <label>Beam Length BX (mm)</label>
            <input type="number" min="0" step="any" value={bx} onChange={(e) => setBx(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Beam Width BY (mm)</label>
            <input type="number" min="0" step="any" value={by} onChange={(e) => setBy(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Beam Depth BZ (mm)</label>
            <input type="number" min="0" step="any" value={bz} onChange={(e) => setBz(e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-row">
            <label>Column in Left CX (mm)</label>
            <input type="number" min="0" step="any" value={cx} onChange={(e) => setCx(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Column in Right CY (mm)</label>
            <input type="number" min="0" step="any" value={cy} onChange={(e) => setCy(e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-row">
            <label>Select Bar & Dia</label>
            <select value={barDia} onChange={(e) => setBarDia(e.target.value)}>
              {BAR_DIA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Cover CO (mm)</label>
            <input type="number" min="0" step="any" value={cover} onChange={(e) => setCover(e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-row">
            <label>Grade of Concrete</label>
            <select value={gradeOfConcrete} onChange={(e) => setGradeOfConcrete(e.target.value)}>
              {CONCRETE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Grade of Steel</label>
            <select value={gradeOfSteel} onChange={(e) => setGradeOfSteel(e.target.value)}>
              {STEEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formError && <div className="error-banner">{formError}</div>}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Calculating..." : "Calculate & Save"}
          </button>
        </div>
      </form>

      {currentOutputs.length > 0 && (
        <div>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />
          <h3>Output</h3>

          <div className="metrics-row">
            {currentOutputs.map((output) => (
              <div className="metric" key={output.output_name}>
                <div className="label">{output.output_name}</div>
                {output.value === null || output.value === undefined ? (
                  <div style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
                    Error: {output.error || "Could not evaluate formula."}
                  </div>
                ) : (
                  <div className="value">
                    {output.value} {output.unit || "m"}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="btn btn-secondary" onClick={() => setShowFormulas((v) => !v)}>
            {showFormulas ? "Hide" : "Show"} Formula used
          </button>

          {showFormulas && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              {currentOutputs.map((output) => (
                <div key={output.output_name} style={{ marginBottom: "0.5rem" }}>
                  <strong>{output.output_name}</strong> ({output.formula_source || "global"}) ={" "}
                  <code>{output.formula_used}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
