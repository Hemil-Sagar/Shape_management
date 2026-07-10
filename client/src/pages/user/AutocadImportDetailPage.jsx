import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../api/client.js";
import Placeholder from "../../components/Placeholder.jsx";

const TABS = ["Beam", "Slab", "Column / SW", "Footing / Raft"];

export default function AutocadImportDetailPage() {
  const { project } = useOutletContext();
  const { projectId, importId } = useParams();
  const navigate = useNavigate();

  const [importItem, setImportItem] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Beam");

  useEffect(() => {
    setError("");
    setImportItem(null);
    api(`/autocad-imports/${importId}`)
      .then(setImportItem)
      .catch((err) => setError(err.message));
  }, [importId]);

  if (error) {
    return (
      <div>
        <div className="error-banner">{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate(`/projects/${projectId}/autocad-imports`)}>
          Back to AutoCAD Import
        </button>
      </div>
    );
  }

  if (!importItem) return <p>Loading...</p>;

  return (
    <div>
      <h1>Autocad Import › {importItem.name || "Import"}</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Home • {project.project_name || "Project"} • AutoCAD Import • {importItem.name || "Import"}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ flex: 2 }}>
          <strong>Block:</strong> {importItem.block_name || "N/A"} | <strong>Floor:</strong>{" "}
          {importItem.floor_name || "N/A"}
        </div>
        <button className="btn btn-secondary" style={{ flex: 1 }} disabled title="Not yet implemented">
          Merge
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} disabled title="Not yet implemented">
          Export
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "btn btn-primary" : "btn btn-secondary"}
            style={{ borderRadius: "6px 6px 0 0" }}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Beam" && (
        <BeamTab project={project} projectId={projectId} importItem={importItem} navigate={navigate} />
      )}
      {activeTab === "Slab" && <Placeholder title="Slab" />}
      {activeTab === "Column / SW" && <Placeholder title="Column / SW" />}
      {activeTab === "Footing / Raft" && <Placeholder title="Footing / Raft" />}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />
      <Link className="btn btn-secondary" to={`/projects/${projectId}/autocad-imports`}>
        Back to AutoCAD Imports
      </Link>
    </div>
  );
}

const BEAM_STATUS_OPTIONS = ["All", "Filled", "Unfilled"];

function BeamTab({ project, projectId, importItem, navigate }) {
  const [showForm, setShowForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [beams, setBeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function loadBeams() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ projectId, autocadImportId: importItem.id });
    if (searchText) params.set("searchText", searchText);
    if (statusFilter !== "All") params.set("statusFilter", statusFilter);

    api(`/beams?${params.toString()}`)
      .then(setBeams)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, importItem.id, searchText, statusFilter]);

  return (
    <div>
      <h3>Beam</h3>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <input
          style={{ flex: 2 }}
          placeholder="Search Here"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select style={{ flex: 1 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {BEAM_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowForm(true)}>
          + Add Beam
        </button>
      </div>

      {showForm && (
        <AddBeamForm
          project={project}
          projectId={projectId}
          importItem={importItem}
          onCancel={() => setShowForm(false)}
          onCreated={(beam) => {
            setShowForm(false);
            navigate(`/projects/${projectId}/autocad-imports/${importItem.id}/beams/${beam.id}`);
          }}
        />
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading...</p>}

      {!loading && !error && beams.length === 0 && <div className="info-banner">No beams found.</div>}

      {!loading && !error && beams.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {beams.map((beam) => (
            <div
              key={beam.id}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: "0.25rem 0.5rem" }}
                  onClick={() =>
                    navigate(`/projects/${projectId}/autocad-imports/${importItem.id}/beams/${beam.id}`)
                  }
                >
                  {beam.beam_name || "Untitled Beam"}
                </button>
                {beam.beam_description && (
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                    {beam.beam_description}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span className={`badge ${beam.status === "Filled" ? "badge-success" : "badge-warning"}`}>
                  {beam.status || "Unfilled"}
                </span>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    navigate(`/projects/${projectId}/autocad-imports/${importItem.id}/beams/${beam.id}`)
                  }
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddBeamForm({ projectId, importItem, onCancel, onCreated }) {
  const [beamName, setBeamName] = useState("");
  const [beamDescription, setBeamDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const name = beamName.trim();
    if (!name) {
      setError("Beam name is required.");
      return;
    }

    setBusy(true);
    try {
      const beam = await api("/beams", {
        method: "POST",
        body: {
          project_id: projectId,
          autocad_import_id: importItem.id,
          block_id: importItem.block_id,
          block_name: importItem.block_name,
          floor_id: importItem.floor_id,
          floor_name: importItem.floor_name,
          beam_name: name,
          beam_description: beamDescription.trim(),
        },
      });
      onCreated(beam);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>Add Beam</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Beam Name</label>
          <input value={beamName} onChange={(e) => setBeamName(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Beam Description</label>
          <textarea value={beamDescription} onChange={(e) => setBeamDescription(e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
