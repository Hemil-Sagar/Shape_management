import { useEffect, useState } from "react";
import { api } from "../../../api/client.js";
import { EditGeneralShapeForm } from "./GeneralShapesTab.jsx";
import {
  GENERAL_SHAPE_CATEGORIES,
  getCategoryLabel,
  validateOutputRows,
  outputsOrDefault,
  OutputRowsEditor,
  FormulasList,
  FormulaTable,
  ShapeImage,
  formatDateTime,
  buildOutputsField,
} from "./shared.jsx";

/**
 * Custom Shapes & Formulas tab. Mode state machine: list | add | view | edit | edit_general,
 * mirroring st.session_state.admin_custom_shape_mode from ui/admin_shapes.py.
 */
export default function CustomShapesTab() {
  const [mode, setMode] = useState("list");
  const [selectedUser, setSelectedUser] = useState(null); // { email, name } chosen in list dropdown
  const [targetUser, setTargetUser] = useState(null); // user the Add form applies to
  const [selectedCustomItemId, setSelectedCustomItemId] = useState(null);
  const [selectedGeneralShapeId, setSelectedGeneralShapeId] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  function backToList() {
    setMode("list");
    setSelectedCustomItemId(null);
    setSelectedGeneralShapeId(null);
    setListRefreshKey((k) => k + 1);
  }

  if (mode === "import") {
    return (
      <ImportFromLibrary
        targetUser={targetUser}
        onCancel={() => setMode("list")}
        onDone={backToList}
      />
    );
  }

  if (mode === "add") {
    return (
      <AddUserCustomShapeForm
        targetUser={targetUser}
        onCancel={() => setMode("list")}
        onSaved={backToList}
      />
    );
  }

  if (mode === "view") {
    return (
      <ViewCustomItem
        customItemId={selectedCustomItemId}
        onBack={backToList}
        onEdit={() => setMode("edit")}
      />
    );
  }

  if (mode === "edit") {
    return (
      <EditCustomItem
        customItemId={selectedCustomItemId}
        onCancel={() => setMode("view")}
        onSaved={() => setMode("view")}
      />
    );
  }

  if (mode === "edit_general") {
    return (
      <EditGeneralShapeForm
        shapeId={selectedGeneralShapeId}
        onCancel={backToList}
        onSaved={backToList}
      />
    );
  }

  return (
    <CustomShapesUserList
      key={listRefreshKey}
      selectedUser={selectedUser}
      setSelectedUser={setSelectedUser}
      onAdd={(user) => {
        setTargetUser(user);
        setSelectedCustomItemId(null);
        setMode("add");
      }}
      onImport={(user) => {
        setTargetUser(user);
        setSelectedCustomItemId(null);
        setMode("import");
      }}
      onViewCustomItem={(id) => {
        setSelectedCustomItemId(id);
        setMode("view");
      }}
      onEditCustomItem={(id) => {
        setSelectedCustomItemId(id);
        setMode("edit");
      }}
      onEditGeneralShape={(id) => {
        setSelectedGeneralShapeId(id);
        setMode("edit_general");
      }}
    />
  );
}

function CustomShapesUserList({
  selectedUser,
  setSelectedUser,
  onAdd,
  onImport,
  onViewCustomItem,
  onEditCustomItem,
  onEditGeneralShape,
}) {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [assignedShapes, setAssignedShapes] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteAssignedId, setConfirmDeleteAssignedId] = useState(null);
  const [confirmDeleteCustomId, setConfirmDeleteCustomId] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api("/admin/users?roleFilter=user")
      .then((data) => {
        setUsers(data || []);
        if (!selectedUser && data && data.length > 0) {
          setSelectedUser({ email: data[0].email, name: data[0].name });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setUsersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedUser?.email) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.email]);

  function loadData() {
    setLoading(true);
    setError("");
    Promise.all([
      api(`/shapes/assigned?userEmail=${encodeURIComponent(selectedUser.email)}`),
      api(`/custom-shapes/for-user?userEmail=${encodeURIComponent(selectedUser.email)}`),
    ])
      .then(([assigned, custom]) => {
        setAssignedShapes(assigned || []);
        setCustomItems(custom || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function confirmDeleteAssigned(shapeId) {
    try {
      await api(`/shapes/${shapeId}`, { method: "DELETE" });
      setConfirmDeleteAssignedId(null);
      setNotice("Shape deleted.");
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDeleteCustom(customItemId) {
    try {
      await api(`/custom-shapes/${customItemId}`, { method: "DELETE" });
      setConfirmDeleteCustomId(null);
      setNotice("Custom shape deleted.");
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  if (usersLoading) return <p>Loading...</p>;

  if (users.length === 0) {
    return <div className="error-banner">No users found. Create a user first.</div>;
  }

  return (
    <div>
      <div className="form-row" style={{ maxWidth: 420 }}>
        <label>Select User / Company</label>
        <select
          value={selectedUser?.email || ""}
          onChange={(e) => {
            const user = users.find((u) => u.email === e.target.value);
            if (user) setSelectedUser({ email: user.email, name: user.name });
          }}
        >
          {users.map((u) => (
            <option key={u.id} value={u.email}>
              {u.name || "Unknown"} ({u.email})
            </option>
          ))}
        </select>
      </div>

      <hr />

      {selectedUser && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Custom Shapes of {selectedUser.name}</h3>
              <p style={{ color: "var(--muted)", margin: "0.25rem 0" }}>
                Changes here apply only to this user.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-secondary" onClick={() => onImport(selectedUser)}>
                Import from Shape Library
              </button>
              <button className="btn btn-primary" onClick={() => onAdd(selectedUser)}>
                + Add Custom Shape
              </button>
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}
          {notice && <div className="success-banner">{notice}</div>}
          {loading && <p>Loading...</p>}

          {!loading && assignedShapes.length === 0 && customItems.length === 0 && (
            <div className="info-banner">
              No shapes for {selectedUser.name} yet. Use + Add Custom Shape, or assign a general
              shape via Visible To in the General tab.
            </div>
          )}

          {assignedShapes.length > 0 && (
            <>
              <h4>General shapes visible only to {selectedUser.name}</h4>
              {assignedShapes.map((shape) => (
                <div className="card" key={shape.id} style={{ marginBottom: "1rem" }}>
                  <div className="grid-3" style={{ gridTemplateColumns: "1fr 1.4fr 1.4fr 0.6fr" }}>
                    <ShapeImage fileId={shape.image_file_id} alt={shape.shape_name} />
                    <div>
                      <h3 style={{ margin: "0 0 0.5rem" }}>{shape.shape_name || "Untitled Shape"}</h3>
                      <p><strong>Type:</strong> General Shape (assigned)</p>
                      <p><strong>Category:</strong> {getCategoryLabel(shape.category)}</p>
                      <p><strong>Status:</strong> {shape.is_active !== false ? "Active" : "Inactive"}</p>
                    </div>
                    <div>
                      <strong>Formulas</strong>
                      <FormulasList outputs={shape.outputs} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <button className="btn btn-secondary" onClick={() => onEditGeneralShape(shape.id)}>
                        Edit
                      </button>
                      {confirmDeleteAssignedId === shape.id ? (
                        <button className="btn btn-danger" onClick={() => confirmDeleteAssigned(shape.id)}>
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          onClick={() => setConfirmDeleteAssignedId(shape.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {customItems.length > 0 && (
            <>
              <h4>Custom shapes & formulas of {selectedUser.name}</h4>
              {customItems.map((item) => (
                <div className="card" key={item.id} style={{ marginBottom: "1rem" }}>
                  <div className="grid-3" style={{ gridTemplateColumns: "0.8fr 1.4fr 1.4fr 0.6fr" }}>
                    <ShapeImage fileId={item.display_image_file_id} alt={item.display_shape_name} />
                    <div>
                      <h3 style={{ margin: "0 0 0.5rem" }}>{item.display_shape_name || "N/A"}</h3>
                      <p><strong>Customization Type:</strong> {item.customization_type_label || "Customization"}</p>
                      {item.cloned_from && (
                        <p style={{ color: "var(--muted)" }}>
                          Cloned from library — replaces "{item.cloned_from_name || item.shape_name}" for this user
                        </p>
                      )}
                      <p><strong>Status:</strong> {item.is_active !== false ? "Active" : "Inactive"}</p>
                    </div>
                    <div>
                      <p><strong>Project:</strong> {item.project_name || "N/A"}</p>
                      <p><strong>Category:</strong> {getCategoryLabel(item.category)}</p>
                      <p><strong>Request ID:</strong> {item.request_code || "N/A"}</p>
                      <p><strong>Requested By:</strong> {item.requested_by_name || "N/A"}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <button className="btn btn-secondary" onClick={() => onViewCustomItem(item.id)}>
                        View
                      </button>
                      <button className="btn btn-secondary" onClick={() => onEditCustomItem(item.id)}>
                        Edit
                      </button>
                      {confirmDeleteCustomId === item.id ? (
                        <button className="btn btn-danger" onClick={() => confirmDeleteCustom(item.id)}>
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          onClick={() => setConfirmDeleteCustomId(item.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {item.display_description && (
                    <p style={{ marginTop: "0.5rem" }}>
                      <strong>Description:</strong> {item.display_description}
                    </p>
                  )}
                  {item.display_outputs && item.display_outputs.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <strong>Formulas</strong>
                      <FormulasList outputs={item.display_outputs} />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Clone a global shape into a user-scoped custom shape. The clone replaces the
 * original in that user's shape dropdowns; admin can then edit its formulas freely. */
function ImportFromLibrary({ targetUser, onCancel, onDone }) {
  const [shapes, setShapes] = useState([]);
  const [clonedIds, setClonedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!targetUser?.email) return;
    Promise.all([
      api("/shapes?statusFilter=Active"),
      api(`/custom-shapes/for-user?userEmail=${encodeURIComponent(targetUser.email)}`),
    ])
      .then(([allShapes, customItems]) => {
        // Only common-pool shapes (not already user-assigned ones).
        setShapes((allShapes || []).filter((s) => !s.user_email));
        setClonedIds(new Set((customItems || []).map((c) => c.cloned_from).filter(Boolean)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [targetUser?.email]);

  if (!targetUser) {
    return (
      <div>
        <div className="error-banner">No user selected.</div>
        <button className="btn btn-secondary" onClick={onCancel}>Back</button>
      </div>
    );
  }

  async function handleClone(shape) {
    setError("");
    setNotice("");
    setBusyId(shape.id);
    try {
      await api("/custom-shapes/clone-from-global", {
        method: "POST",
        body: {
          shape_id: shape.id,
          user_email: targetUser.email,
          user_name: targetUser.name || "",
        },
      });
      setClonedIds((prev) => new Set([...prev, shape.id]));
      setNotice(`"${shape.shape_name}" cloned for ${targetUser.name}. It now replaces the library version for this user.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Import from Shape Library for {targetUser.name}</h3>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0" }}>
            Cloning copies the shape to this user only and hides the original library version
            from them. Edit the clone's formulas afterwards without affecting other users.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onDone}>
          Back to Custom Shapes
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      {loading && <p>Loading...</p>}

      {!loading && shapes.length === 0 && (
        <div className="info-banner">No shapes in the common library.</div>
      )}

      {shapes.map((shape) => {
        const alreadyCloned = clonedIds.has(shape.id);
        return (
          <div className="card" key={shape.id} style={{ marginBottom: "1rem" }}>
            <div className="grid-3" style={{ gridTemplateColumns: "0.8fr 1.4fr 1.4fr 0.7fr" }}>
              <ShapeImage fileId={shape.image_file_id} alt={shape.shape_name} />
              <div>
                <h3 style={{ margin: "0 0 0.5rem" }}>{shape.shape_name || "Untitled Shape"}</h3>
                <p><strong>Category:</strong> {getCategoryLabel(shape.category)}</p>
                {shape.description && <p>{shape.description}</p>}
              </div>
              <div>
                <strong>Formulas</strong>
                <FormulasList outputs={shape.outputs} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {alreadyCloned ? (
                  <span className="badge badge-success">Cloned</span>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled={busyId === shape.id}
                    onClick={() => handleClone(shape)}
                  >
                    {busyId === shape.id ? "Cloning..." : "Clone for user"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddUserCustomShapeForm({ targetUser, onCancel, onSaved }) {
  const [category, setCategory] = useState("beam");
  const [shapeName, setShapeName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [outputs, setOutputs] = useState(outputsOrDefault([]));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!targetUser) {
    return (
      <div>
        <div className="error-banner">No user selected.</div>
        <button className="btn btn-secondary" onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

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
    formData.append("user_email", targetUser.email);
    formData.append("user_name", targetUser.name || "");
    formData.append("category", category);
    formData.append("shape_name", name);
    formData.append("description", description.trim());
    formData.append("outputs", buildOutputsField(cleaned));
    if (imageFile) formData.append("image", imageFile);

    setSaving(true);
    try {
      await api("/custom-shapes/user", { method: "POST", body: formData, isFormData: true });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>Add Custom Shape for {targetUser.name}</h3>
      <p style={{ color: "var(--muted)" }}>Custom Shapes & Formulas • Visible only to this user</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="form-row" style={{ maxWidth: 300 }}>
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {GENERAL_SHAPE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>Shape Name</label>
        <input
          type="text"
          placeholder="Enter custom shape name"
          value={shapeName}
          onChange={(e) => setShapeName(e.target.value)}
        />
      </div>

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
          Save Custom Shape
        </button>
        <button className="btn btn-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ViewCustomItem({ customItemId, onBack, onEdit }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customItemId]);

  function reload() {
    setLoading(true);
    setError("");
    api(`/custom-shapes/${customItemId}`)
      .then(setItem)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  if (loading) return <p>Loading...</p>;

  if (error || !item) {
    return (
      <div>
        <div className="error-banner">{error || "Custom shape/formula not found."}</div>
        <button className="btn btn-secondary" onClick={onBack}>
          Back to Custom Shapes & Formulas
        </button>
      </div>
    );
  }

  async function toggleActive() {
    setBusy(true);
    setActionError("");
    setActionMsg("");
    try {
      const endpoint = item.is_active !== false ? "deactivate" : "reactivate";
      const updated = await api(`/custom-shapes/${customItemId}/${endpoint}`, { method: "POST" });
      setItem(updated);
      setActionMsg(item.is_active !== false ? "Customization deactivated." : "Customization reactivated.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const updatedAt = formatDateTime(item.updated_at);
  const imageFileId =
    item.type === "custom_shape" ? item.display_image_file_id || item.image_file_id : null;

  return (
    <div className="card">
      <h3>{item.display_shape_name || "N/A"}</h3>
      <p style={{ color: "var(--muted)" }}>{item.customization_type_label || "Customization"}</p>

      {actionError && <div className="error-banner">{actionError}</div>}
      {actionMsg && <div className="success-banner">{actionMsg}</div>}

      <div className="grid-2">
        <div>
          <p><strong>Project:</strong> {item.project_name || "N/A"}</p>
          <p><strong>Category:</strong> {getCategoryLabel(item.category)}</p>
          <p><strong>Status:</strong> {item.is_active !== false ? "Active" : "Inactive"}</p>
          <p><strong>Request ID:</strong> {item.request_code || "N/A"}</p>
        </div>
        <div>
          <p><strong>Requested By:</strong> {item.requested_by_name || "N/A"}</p>
          <p><strong>Requested Email:</strong> {item.requested_by || "N/A"}</p>
          <p><strong>Updated By:</strong> {item.updated_by || "N/A"}</p>
          {updatedAt && <p><strong>Updated At:</strong> {updatedAt}</p>}
        </div>
      </div>

      {item.display_description && (
        <>
          <hr />
          <p><strong>Description:</strong> {item.display_description}</p>
        </>
      )}

      {imageFileId && (
        <>
          <hr />
          <strong>Shape Image</strong>
          <ShapeImage fileId={imageFileId} alt={item.display_shape_name} height={280} />
        </>
      )}

      <hr />
      <FormulaTable outputs={item.display_outputs} />

      <hr />
      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={toggleActive}>
          {item.is_active !== false ? "Deactivate" : "Reactivate"}
        </button>
        <button className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

function EditCustomItem({ customItemId, onCancel, onSaved }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api(`/custom-shapes/${customItemId}`)
      .then(setItem)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [customItemId]);

  if (loading) return <p>Loading...</p>;

  if (error || !item) {
    return (
      <div>
        <div className="error-banner">{error || "Custom shape/formula not found."}</div>
        <button className="btn btn-secondary" onClick={onCancel}>
          Back to Custom Shapes & Formulas
        </button>
      </div>
    );
  }

  if (item.type === "formula_override") {
    return <EditCustomFormulaForm item={item} onCancel={onCancel} onSaved={onSaved} />;
  }

  if (item.type === "custom_shape") {
    return <EditCustomShapeForm item={item} onCancel={onCancel} onSaved={onSaved} />;
  }

  return (
    <div>
      <div className="error-banner">Unsupported customization type.</div>
      <button className="btn btn-secondary" onClick={onCancel}>
        Back
      </button>
    </div>
  );
}

function EditCustomFormulaForm({ item, onCancel, onSaved }) {
  const [outputs, setOutputs] = useState(outputsOrDefault(item.override_outputs));
  const [isActive, setIsActive] = useState(item.is_active !== false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError("");
    const { valid, error: outputError, cleaned } = validateOutputRows(outputs);
    if (!valid) {
      setError(outputError);
      return;
    }

    setSaving(true);
    try {
      await api(`/custom-shapes/${item.id}/formula-override`, {
        method: "PATCH",
        body: { override_outputs: cleaned, is_active: isActive },
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>Edit Custom Formula</h3>
      <p style={{ color: "var(--muted)" }}>{item.display_shape_name || "Custom Formula"}</p>

      <p><strong>Project:</strong> {item.project_name || "N/A"}</p>
      <p><strong>Base Shape:</strong> {item.base_shape_name || "N/A"}</p>
      <p><strong>Request ID:</strong> {item.request_code || "N/A"}</p>
      <p><strong>Requested By:</strong> {item.requested_by_name || "N/A"}</p>

      <hr />

      {error && <div className="error-banner">{error}</div>}

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

function EditCustomShapeForm({ item, onCancel, onSaved }) {
  const [shapeName, setShapeName] = useState(item.shape_name || "");
  const [description, setDescription] = useState(item.description || "");
  const [imageFile, setImageFile] = useState(null);
  const [outputs, setOutputs] = useState(outputsOrDefault(item.outputs));
  const [isActive, setIsActive] = useState(item.is_active !== false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
    formData.append("description", description.trim());
    formData.append("outputs", buildOutputsField(cleaned));
    formData.append("is_active", String(isActive));
    if (imageFile) formData.append("image", imageFile);

    setSaving(true);
    try {
      await api(`/custom-shapes/${item.id}`, { method: "PATCH", body: formData, isFormData: true });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>Edit Custom Shape</h3>
      <p style={{ color: "var(--muted)" }}>{item.display_shape_name || "Custom Shape"}</p>

      <p><strong>Project:</strong> {item.project_name || "N/A"}</p>
      <p><strong>Request ID:</strong> {item.request_code || "N/A"}</p>
      <p><strong>Requested By:</strong> {item.requested_by_name || "N/A"}</p>

      {(item.image_file_id) && (
        <div style={{ margin: "0.75rem 0" }}>
          <strong>Current Shape Image</strong>
          <ShapeImage fileId={item.image_file_id} alt={item.shape_name} height={200} />
        </div>
      )}

      <hr />

      {error && <div className="error-banner">{error}</div>}

      <div className="form-row">
        <label>Shape Name</label>
        <input type="text" value={shapeName} onChange={(e) => setShapeName(e.target.value)} />
      </div>

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
