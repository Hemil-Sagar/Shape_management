import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../api/client.js";

const STATUS_OPTIONS = ["All", "Pending", "Imported"];

export default function AutocadImportsPage() {
  const { project } = useOutletContext();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function loadImports() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ projectId });
    if (searchText) params.set("searchText", searchText);
    if (statusFilter !== "All") params.set("statusFilter", statusFilter);

    api(`/autocad-imports?${params.toString()}`)
      .then(setImports)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadImports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, searchText, statusFilter]);

  return (
    <div>
      <h1>AutoCAD Import</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Home • {project.project_name || "Project"} • AutoCAD Import
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, flex: 2 }}>Autocad Import</h3>
        <button className="btn btn-secondary" style={{ flex: 1 }} disabled title="Not yet implemented">
          Merge Dwg
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowForm(true)}>
          + New Import
        </button>
      </div>

      {showForm && (
        <NewAutocadImportForm
          project={project}
          projectId={projectId}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            loadImports();
          }}
        />
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <input
          style={{ flex: 3 }}
          placeholder="Search Here"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select style={{ flex: 1 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading...</p>}

      {!loading && !error && imports.length === 0 && (
        <div className="info-banner">No AutoCAD imports found.</div>
      )}

      {!loading && !error && imports.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Imported By</th>
              <th>Date</th>
              <th>Block</th>
              <th>Floor</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {imports.map((item) => (
              <tr key={item.id}>
                <td>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "0.25rem 0.5rem" }}
                    onClick={() => navigate(`/projects/${projectId}/autocad-imports/${item.id}`)}
                  >
                    {item.name || "Untitled"}
                  </button>
                </td>
                <td>{item.imported_by_name || "N/A"}</td>
                <td>{item.imported_at ? new Date(item.imported_at).toLocaleDateString() : "N/A"}</td>
                <td>{item.block_name || "N/A"}</td>
                <td>{item.floor_name || "N/A"}</td>
                <td>
                  <span className={`badge ${item.status === "Imported" ? "badge-success" : "badge-warning"}`}>
                    {item.status || "Pending"}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/projects/${projectId}/autocad-imports/${item.id}`)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewAutocadImportForm({ project, projectId, onCancel, onCreated }) {
  const [blocks, setBlocks] = useState(null);
  const [blocksError, setBlocksError] = useState("");

  const [importName, setImportName] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [floors, setFloors] = useState([]);
  const [floorsLoading, setFloorsLoading] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [drawingNumber, setDrawingNumber] = useState("");
  const [structureName, setStructureName] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/blocks?projectId=${projectId}`)
      .then((data) => {
        setBlocks(data);
        if (data.length > 0) setSelectedBlockId(data[0].id);
      })
      .catch((err) => setBlocksError(err.message));
  }, [projectId]);

  useEffect(() => {
    if (!selectedBlockId) {
      setFloors([]);
      setSelectedFloorId("");
      return;
    }
    setFloorsLoading(true);
    api(`/floors?projectId=${projectId}&blockId=${selectedBlockId}`)
      .then((data) => {
        setFloors(data);
        setSelectedFloorId(data.length > 0 ? data[0].id : "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setFloorsLoading(false));
  }, [projectId, selectedBlockId]);

  if (blocksError) {
    return (
      <div className="card">
        <div className="error-banner">{blocksError}</div>
      </div>
    );
  }

  if (blocks === null) {
    return (
      <div className="card">
        <p>Loading blocks...</p>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="card">
        <div className="info-banner">You need to create a Block first.</div>
        <Link className="btn btn-primary" to={`/projects/${projectId}/blocks`}>
          Go to Blocks
        </Link>
      </div>
    );
  }

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const name = importName.trim();
    const drawing = drawingNumber.trim();
    const structure = structureName.trim();

    if (!name) {
      setError("Name is required.");
      return;
    }
    if (!selectedFloorId) {
      setError("Please create/select a floor before importing.");
      return;
    }

    const selectedFloor = floors.find((f) => f.id === selectedFloorId);

    setBusy(true);
    try {
      await api("/autocad-imports", {
        method: "POST",
        body: {
          project_id: projectId,
          project_code: project.project_code,
          import_name: name,
          block_id: selectedBlockId,
          block_name: selectedBlock?.block_name,
          floor_id: selectedFloorId,
          floor_name: selectedFloor?.floor_name,
          drawing_number: drawing,
          structure_name: structure,
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>New AutoCAD Import</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Name</label>
          <input value={importName} onChange={(e) => setImportName(e.target.value)} />
        </div>

        <div className="grid-2">
          <div className="form-row">
            <label>Block</label>
            <select value={selectedBlockId} onChange={(e) => setSelectedBlockId(e.target.value)}>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.block_name || "Untitled Block"}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Floor</label>
            {floorsLoading ? (
              <p>Loading floors...</p>
            ) : floors.length > 0 ? (
              <select value={selectedFloorId} onChange={(e) => setSelectedFloorId(e.target.value)}>
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.floor_name || "Untitled Floor"}
                  </option>
                ))}
              </select>
            ) : (
              <div className="info-banner" style={{ marginBottom: 0 }}>
                No floors found for selected block. Please create a floor first.
              </div>
            )}
          </div>
        </div>

        <div className="grid-2">
          <div className="form-row">
            <label>Drawing Number</label>
            <input value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Structure Name</label>
            <input value={structureName} onChange={(e) => setStructureName(e.target.value)} />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Importing..." : "Import"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
