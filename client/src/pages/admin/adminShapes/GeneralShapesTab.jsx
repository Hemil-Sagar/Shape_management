import { useEffect, useState } from "react";
import { api } from "../../../api/client.js";
import {
  GENERAL_SHAPE_CATEGORIES,
  getCategoryLabel,
  getShapeVisibilityLabel,
  validateOutputRows,
  outputsOrDefault,
  OutputRowsEditor,
  VisibilitySelect,
  FormulasList,
  FormulaTable,
  ShapeImage,
  formatDateTime,
  buildOutputsField,
} from "./shared.jsx";

/**
 * General Shapes & Formulas tab. Mode state machine: list | add | view | edit,
 * mirroring st.session_state.admin_shape_mode from ui/admin_shapes.py.
 */
export default function GeneralShapesTab() {
  const [mode, setMode] = useState("list");
  const [category, setCategory] = useState("beam");
  const [selectedShapeId, setSelectedShapeId] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  function goToAdd(cat) {
    setCategory(cat);
    setSelectedShapeId(null);
    setMode("add");
  }

  function goToView(shapeId, cat) {
    setSelectedShapeId(shapeId);
    setCategory(cat);
    setMode("view");
  }

  function goToEdit(shapeId, cat) {
    setSelectedShapeId(shapeId);
    setCategory(cat);
    setMode("edit");
  }

  function backToList() {
    setMode("list");
    setSelectedShapeId(null);
    setListRefreshKey((k) => k + 1);
  }

  if (mode === "add") {
    return (
      <AddGeneralShapeForm
        category={category}
        onCancel={() => setMode("list")}
        onSaved={() => backToList()}
      />
    );
  }

  if (mode === "view") {
    return (
      <ViewGeneralShape
        shapeId={selectedShapeId}
        onBack={backToList}
        onEdit={() => setMode("edit")}
      />
    );
  }

  if (mode === "edit") {
    return (
      <EditGeneralShapeForm
        shapeId={selectedShapeId}
        onCancel={() => setMode("view")}
        onSaved={() => setMode("view")}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {GENERAL_SHAPE_CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={category === c.key ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <CategoryShapeList
        key={`${category}-${listRefreshKey}`}
        category={category}
        onAdd={() => goToAdd(category)}
        onView={(id) => goToView(id, category)}
        onEdit={(id) => goToEdit(id, category)}
      />
    </div>
  );
}

function CategoryShapeList({ category, onAdd, onView, onEdit }) {
  const label = getCategoryLabel(category);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [shapes, setShapes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ category, searchText, statusFilter });
      api(`/shapes?${params.toString()}`)
        .then((data) => {
          if (!cancelled) setShapes(data || []);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [category, searchText, statusFilter]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}>{label} Shapes</h3>
        <button className="btn btn-primary" onClick={onAdd}>
          + Add {label} Shape
        </button>
      </div>

      <div className="form-row" style={{ display: "flex", gap: "0.75rem" }}>
        <input
          type="text"
          placeholder={`Search ${label.toLowerCase()} shape`}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ flex: 3 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="All">All</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading...</p>}

      {!loading && shapes.length === 0 && (
        <div className="info-banner">No {label.toLowerCase()} shapes found.</div>
      )}

      {!loading &&
        shapes.map((shape) => (
          <GeneralShapeCard key={shape.id} shape={shape} onView={onView} onEdit={onEdit} />
        ))}
    </div>
  );
}

function GeneralShapeCard({ shape, onView, onEdit }) {
  const status = shape.is_active !== false ? "Active" : "Inactive";
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div className="grid-3" style={{ gridTemplateColumns: "1fr 1.4fr 1.4fr 0.6fr" }}>
        <ShapeImage fileId={shape.image_file_id} alt={shape.shape_name} />

        <div>
          <h3 style={{ margin: "0 0 0.5rem" }}>{shape.shape_name || "Untitled Shape"}</h3>
          <p><strong>Type:</strong> General Shape</p>
          <p><strong>Category:</strong> {getCategoryLabel(shape.category)}</p>
          <p>
            <strong>Status:</strong>{" "}
            <span className={status === "Active" ? "badge badge-success" : "badge badge-neutral"}>
              {status}
            </span>
          </p>
          <p><strong>Visible To:</strong> {getShapeVisibilityLabel(shape)}</p>
          {shape.description && <p><strong>Description:</strong> {shape.description}</p>}
        </div>

        <div>
          <strong>Formulas</strong>
          <FormulasList outputs={shape.outputs} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button className="btn btn-secondary" onClick={() => onView(shape.id)}>
            View
          </button>
          <button className="btn btn-secondary" onClick={() => onEdit(shape.id)}>
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function AddGeneralShapeForm({ category, onCancel, onSaved }) {
  const categoryLabel = getCategoryLabel(category);
  const [shapeName, setShapeName] = useState("");
  const [visibleToUser, setVisibleToUser] = useState(null);
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [outputs, setOutputs] = useState(outputsOrDefault([]));
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/admin/users?roleFilter=user")
      .then(setUsers)
      .catch(() => {});
  }, []);

  async function handleSave() {
    setError("");
    const name = shapeName.trim();
    if (!name) {
      setError("Shape name is required.");
      return;
    }

    const { valid, error: outputError, cleaned } = validateOutputRows(outputs);
    if (!valid) {
      setError(outputError);
      return;
    }

    const formData = new FormData();
    formData.append("shape_name", name);
    formData.append("category", category);
    formData.append("description", description.trim());
    if (visibleToUser) {
      formData.append("user_email", visibleToUser.email);
      formData.append("user_name", visibleToUser.name || "");
    }
    formData.append("outputs", buildOutputsField(cleaned));
    if (imageFile) formData.append("image", imageFile);

    setSaving(true);
    try {
      await api("/shapes", { method: "POST", body: formData, isFormData: true });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>Add {categoryLabel} Shape</h3>
      <p style={{ color: "var(--muted)" }}>General Shapes & Formulas</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="form-row">
        <label>Shape Name</label>
        <input
          type="text"
          placeholder={`Enter ${categoryLabel.toLowerCase()} shape name`}
          value={shapeName}
          onChange={(e) => setShapeName(e.target.value)}
        />
      </div>

      <VisibilitySelect users={users} value={visibleToUser?.email} onChange={setVisibleToUser} />

      <div className="form-row">
        <label>Description</label>
        <textarea
          placeholder="Short description of this shape"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-row">
        <label>Shape Image</label>
        <input
          type="file"
          accept=".png,.jpg,.jpeg"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
        />
      </div>

      <OutputRowsEditor outputs={outputs} setOutputs={setOutputs} />

      <div className="form-actions">
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          Save Shape
        </button>
        <button className="btn btn-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function EditGeneralShapeForm({ shapeId, onCancel, onSaved }) {
  const [shape, setShape] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [shapeName, setShapeName] = useState("");
  const [visibleToUser, setVisibleToUser] = useState(null);
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [outputs, setOutputs] = useState(outputsOrDefault([]));
  const [isActive, setIsActive] = useState(true);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/admin/users?roleFilter=user")
      .then(setUsers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    api(`/shapes/${shapeId}`)
      .then((data) => {
        setShape(data);
        setShapeName(data.shape_name || "");
        setDescription(data.description || "");
        setOutputs(outputsOrDefault(data.outputs));
        setIsActive(data.is_active !== false);
        if (data.user_email) {
          setVisibleToUser({ email: data.user_email, name: data.user_name });
        } else {
          setVisibleToUser(null);
        }
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [shapeId]);

  if (loading) return <p>Loading...</p>;

  if (loadError || !shape) {
    return (
      <div>
        <div className="error-banner">{loadError || "Shape not found."}</div>
        <button className="btn btn-secondary" onClick={onCancel}>
          Back to Shapes
        </button>
      </div>
    );
  }

  const category = shape.category || "beam";
  const categoryLabel = getCategoryLabel(category);

  async function handleSave() {
    setError("");
    const name = shapeName.trim();
    if (!name) {
      setError("Shape name is required.");
      return;
    }

    const { valid, error: outputError, cleaned } = validateOutputRows(outputs);
    if (!valid) {
      setError(outputError);
      return;
    }

    const formData = new FormData();
    formData.append("shape_name", name);
    formData.append("category", category);
    formData.append("description", description.trim());
    if (visibleToUser) {
      formData.append("user_email", visibleToUser.email);
      formData.append("user_name", visibleToUser.name || "");
    }
    formData.append("outputs", buildOutputsField(cleaned));
    formData.append("is_active", String(isActive));
    if (imageFile) formData.append("image", imageFile);

    setSaving(true);
    try {
      await api(`/shapes/${shapeId}`, { method: "PATCH", body: formData, isFormData: true });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>Edit {categoryLabel} Shape</h3>
      <p style={{ color: "var(--muted)" }}>General Shapes & Formulas</p>

      {(shape.image_file_id) && (
        <div style={{ marginBottom: "1rem" }}>
          <strong>Current Shape Image</strong>
          <ShapeImage fileId={shape.image_file_id} alt={shape.shape_name} height={200} />
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="form-row">
        <label>Shape Name</label>
        <input type="text" value={shapeName} onChange={(e) => setShapeName(e.target.value)} />
      </div>

      <VisibilitySelect users={users} value={visibleToUser?.email} onChange={setVisibleToUser} />

      <div className="form-row">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="form-row">
        <label>Upload New Shape Image</label>
        <input
          type="file"
          accept=".png,.jpg,.jpeg"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
        />
      </div>

      <OutputRowsEditor outputs={outputs} setOutputs={setOutputs} />

      <div className="form-row">
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          Save Changes
        </button>
        <button className="btn btn-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ViewGeneralShape({ shapeId, onBack, onEdit }) {
  const [shape, setShape] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeId]);

  function reload() {
    setLoading(true);
    setError("");
    api(`/shapes/${shapeId}`)
      .then(setShape)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  if (loading) return <p>Loading...</p>;

  if (error || !shape) {
    return (
      <div>
        <div className="error-banner">{error || "Shape not found."}</div>
        <button className="btn btn-secondary" onClick={onBack}>
          Back to Shapes
        </button>
      </div>
    );
  }

  async function toggleActive() {
    setBusy(true);
    setActionError("");
    setActionMsg("");
    try {
      const endpoint = shape.is_active !== false ? "deactivate" : "reactivate";
      const updated = await api(`/shapes/${shapeId}/${endpoint}`, { method: "POST" });
      setShape(updated);
      setActionMsg(shape.is_active !== false ? "Shape deactivated." : "Shape reactivated.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const status = shape.is_active !== false ? "Active" : "Inactive";
  const updatedAt = formatDateTime(shape.updated_at);

  return (
    <div className="card">
      <h3>{shape.shape_name}</h3>
      <p style={{ color: "var(--muted)" }}>General Shape • {getCategoryLabel(shape.category)}</p>

      {actionError && <div className="error-banner">{actionError}</div>}
      {actionMsg && <div className="success-banner">{actionMsg}</div>}

      <div className="grid-2">
        <div>
          <p><strong>Type:</strong> General Shape</p>
          <p><strong>Category:</strong> {getCategoryLabel(shape.category)}</p>
          <p><strong>Status:</strong> {status}</p>
          <p><strong>Visible To:</strong> {getShapeVisibilityLabel(shape)}</p>
        </div>
        <div>
          <p><strong>Created By:</strong> {shape.created_by || "N/A"}</p>
          <p><strong>Updated By:</strong> {shape.updated_by || "N/A"}</p>
          {updatedAt && <p><strong>Updated At:</strong> {updatedAt}</p>}
        </div>
      </div>

      {shape.description && (
        <>
          <hr />
          <p><strong>Description:</strong> {shape.description}</p>
        </>
      )}

      {shape.image_file_id && (
        <>
          <hr />
          <strong>Shape Image</strong>
          <ShapeImage fileId={shape.image_file_id} alt={shape.shape_name} height={280} />
        </>
      )}

      <hr />
      <FormulaTable outputs={shape.outputs} />

      <hr />
      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={toggleActive}>
          {shape.is_active !== false ? "Deactivate" : "Reactivate"}
        </button>
        <button className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
