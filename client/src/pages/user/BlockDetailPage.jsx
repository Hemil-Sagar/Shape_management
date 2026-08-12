import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../api/client.js";

export default function BlockDetailPage() {
  const { project } = useOutletContext();
  const { projectId, blockId } = useParams();

  const [block, setBlock] = useState(null);
  const [blockError, setBlockError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setBlockError("");
    api(`/blocks/${blockId}`)
      .then((data) => !cancelled && setBlock(data))
      .catch((err) => !cancelled && setBlockError(err.message));
    return () => {
      cancelled = true;
    };
  }, [blockId]);

  function loadFloors() {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ projectId, blockId });
    if (searchText) qs.set("searchText", searchText);
    api(`/floors?${qs.toString()}`)
      .then(setFloors)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadFloors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, blockId, searchText]);

  if (blockError) {
    return (
      <div>
        <div className="error-banner">{blockError}</div>
        <Link className="btn btn-secondary" to={`/projects/${projectId}/blocks`}>
          Back to Blocks
        </Link>
      </div>
    );
  }

  if (!block) return <p>Loading...</p>;

  return (
    <div>
      <h1>Floors</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Home • {project.project_name || "Project"} • Blocks • {block.block_name || "Block"} • Floors
      </div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, flex: 1.5 }}>
          {block.block_name || "Block"} &gt; Floors ({floors.length})
        </h3>
        <input
          style={{ flex: 2 }}
          placeholder="Search Here"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowForm(true)}>
          + New Floor
        </button>
      </div>

      {showForm && (
        <NewFloorForm
          projectId={projectId}
          blockId={blockId}
          projectCode={project.project_code}
          blockName={block.block_name}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            loadFloors();
          }}
        />
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading...</p>}

      {!loading && !error && floors.length === 0 && (
        <div className="info-banner">No floors found.</div>
      )}

      {!loading && !error && floors.length > 0 && (
        <div className="grid-2">
          {floors.map((floor) => (
            <div className="card" key={floor.id}>
              <h3>{floor.floor_name || "Untitled Floor"}</h3>
              {floor.floor_description ? (
                <p>{floor.floor_description}</p>
              ) : (
                <p style={{ color: "var(--muted)" }}>No description available.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewFloorForm({ projectId, blockId, projectCode, blockName, onCancel, onCreated }) {
  const [floorName, setFloorName] = useState("");
  const [floorDescription, setFloorDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const name = floorName.trim();
    const description = floorDescription.trim();

    if (!name) {
      setError("Floor name is required.");
      return;
    }

    setBusy(true);
    try {
      await api("/floors", {
        method: "POST",
        body: {
          project_id: projectId,
          block_id: blockId,
          project_code: projectCode,
          block_name: blockName,
          floor_name: name,
          floor_description: description,
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
      <h3>Create New Floor</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Floor Name</label>
          <input value={floorName} onChange={(e) => setFloorName(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Floor Description</label>
          <textarea value={floorDescription} onChange={(e) => setFloorDescription(e.target.value)} />
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
