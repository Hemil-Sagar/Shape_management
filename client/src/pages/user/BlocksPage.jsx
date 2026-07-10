import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../api/client.js";

export default function BlocksPage() {
  const { project } = useOutletContext();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function loadBlocks() {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ projectId });
    if (searchText) qs.set("searchText", searchText);
    api(`/blocks?${qs.toString()}`)
      .then(setBlocks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, searchText]);

  return (
    <div>
      <h1>Blocks</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Home • {project.project_name || "Project"} • Blocks
      </div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, flex: 2 }}>Blocks</h3>
        <input
          style={{ flex: 2 }}
          placeholder="Search Here"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowForm(true)}>
          + New Block
        </button>
      </div>

      {showForm && (
        <NewBlockForm
          projectId={projectId}
          projectCode={project.project_code}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            loadBlocks();
          }}
        />
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading...</p>}

      {!loading && !error && blocks.length === 0 && (
        <div className="info-banner">No blocks found.</div>
      )}

      {!loading && !error && blocks.length > 0 && (
        <div className="grid-2">
          {blocks.map((block) => (
            <div className="card" key={block.id}>
              <h3>{block.block_name || "Untitled Block"}</h3>
              {block.block_description ? (
                <p>{block.block_description}</p>
              ) : (
                <p style={{ color: "var(--muted)" }}>No description available.</p>
              )}
              <button
                className="btn btn-secondary"
                style={{ width: "100%" }}
                onClick={() => navigate(`/projects/${projectId}/blocks/${block.id}`)}
              >
                Open Block
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewBlockForm({ projectId, projectCode, onCancel, onCreated }) {
  const [blockName, setBlockName] = useState("");
  const [blockDescription, setBlockDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const name = blockName.trim();
    const description = blockDescription.trim();

    if (!name) {
      setError("Block name is required.");
      return;
    }

    setBusy(true);
    try {
      await api("/blocks", {
        method: "POST",
        body: {
          project_id: projectId,
          project_code: projectCode,
          block_name: name,
          block_description: description,
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
      <h3>Create New Block</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Block Name</label>
          <input value={blockName} onChange={(e) => setBlockName(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Block Description</label>
          <textarea value={blockDescription} onChange={(e) => setBlockDescription(e.target.value)} />
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
