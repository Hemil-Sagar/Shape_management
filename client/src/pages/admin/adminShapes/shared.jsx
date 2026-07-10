import { imageUrl } from "../../../api/client.js";

export const GENERAL_SHAPE_CATEGORIES = [
  { key: "beam", label: "Beam" },
  { key: "slab", label: "Slab" },
  { key: "column", label: "Column / SW" },
  { key: "footing", label: "Footing / Raft" },
];

export function getCategoryLabel(category) {
  const found = GENERAL_SHAPE_CATEGORIES.find((c) => c.key === category);
  if (found) return found.label;
  return category ? category[0].toUpperCase() + category.slice(1) : "";
}

export function getShapeVisibilityLabel(shape) {
  if (shape?.user_email) {
    return `Only ${shape.user_name || shape.user_email}`;
  }
  return "All Users";
}

/** Mirrors validate_output_rows from ui/admin_shapes.py exactly (messages included). */
export function validateOutputRows(rows) {
  const cleaned = [];

  for (const output of rows) {
    const output_name = (output.output_name || "").trim();
    const formula = (output.formula || "").trim();
    const unit = (output.unit || "m").trim() || "m";

    if (!output_name) {
      return { valid: false, error: "Output name is required.", cleaned: [] };
    }

    if (!formula) {
      return { valid: false, error: `Formula is required for ${output_name}.`, cleaned: [] };
    }

    cleaned.push({ output_name, formula, unit });
  }

  return { valid: true, error: "", cleaned };
}

export function defaultOutputRow(index) {
  return { output_name: `L${index + 1}`, formula: "", unit: "m" };
}

export function outputsOrDefault(outputs) {
  if (outputs && outputs.length > 0) return outputs.map((o) => ({ ...o }));
  return [defaultOutputRow(0)];
}

/** Controlled editor for the "Number of Outputs" + per-row output_name/formula/unit fields. */
export function OutputRowsEditor({ outputs, setOutputs }) {
  function setOutputCount(rawValue) {
    let n = parseInt(rawValue, 10);
    if (Number.isNaN(n)) n = 1;
    n = Math.max(1, Math.min(10, n));

    setOutputs((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(defaultOutputRow(next.length));
      return next;
    });
  }

  function updateRow(i, field, value) {
    setOutputs((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  return (
    <div>
      <div className="form-row" style={{ maxWidth: 220 }}>
        <label>Number of Outputs</label>
        <input
          type="number"
          min={1}
          max={10}
          value={outputs.length}
          onChange={(e) => setOutputCount(e.target.value)}
        />
      </div>

      <h4>Output Formulas</h4>

      {outputs.map((row, i) => (
        <div key={i} className="form-row">
          <strong>Output {i + 1}</strong>
          <div className="grid-3" style={{ marginTop: "0.4rem" }}>
            <div>
              <label>Output Name</label>
              <input
                type="text"
                value={row.output_name}
                onChange={(e) => updateRow(i, "output_name", e.target.value)}
              />
            </div>
            <div>
              <label>Formula</label>
              <input
                type="text"
                value={row.formula}
                onChange={(e) => updateRow(i, "formula", e.target.value)}
              />
            </div>
            <div>
              <label>Unit</label>
              <input
                type="text"
                value={row.unit}
                onChange={(e) => updateRow(i, "unit", e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Visible To" selector: null = All Users, otherwise a specific user object {email, name}. */
export function VisibilitySelect({ users, value, onChange }) {
  return (
    <div className="form-row">
      <label>Visible To</label>
      <select
        value={value || ""}
        onChange={(e) => {
          const email = e.target.value;
          if (!email) {
            onChange(null);
            return;
          }
          const user = users.find((u) => u.email === email);
          onChange(user || null);
        }}
      >
        <option value="">All Users</option>
        {users.map((u) => (
          <option key={u.id} value={u.email}>
            {u.name || "Unknown"} ({u.email})
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormulasList({ outputs }) {
  if (!outputs || outputs.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No formulas added.</p>;
  }
  return (
    <div>
      {outputs.map((o, i) => (
        <div key={i} style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}>
          <strong>
            {o.output_name || "Output"} ({o.unit || "m"})
          </strong>
          : <code>{o.formula || "N/A"}</code>
        </div>
      ))}
    </div>
  );
}

export function FormulaTable({ outputs }) {
  if (!outputs || outputs.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No formulas added.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Output</th>
          <th>Formula</th>
          <th>Unit</th>
        </tr>
      </thead>
      <tbody>
        {outputs.map((o, i) => (
          <tr key={i}>
            <td>{o.output_name}</td>
            <td>
              <code>{o.formula}</code>
            </td>
            <td>{o.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ShapeImage({ fileId, alt, height = 120 }) {
  const src = imageUrl(fileId);
  if (!src) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F2F4F7",
          borderRadius: 6,
          color: "var(--muted)",
          fontSize: "0.8rem",
        }}
      >
        No image
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || "Shape"}
      style={{ maxWidth: "100%", maxHeight: height, objectFit: "contain" }}
    />
  );
}

export function formatDateTime(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  } catch {
    return String(value);
  }
}

export function buildOutputsField(outputs) {
  return JSON.stringify(outputs);
}
