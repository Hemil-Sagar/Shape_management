import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";

export default function ProjectManagementPage() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function loadProjects() {
    setLoading(true);
    setError("");
    api(`/projects${searchText ? `?searchText=${encodeURIComponent(searchText)}` : ""}`)
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  return (
    <div>
      <h1>Project Management</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>Home</div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, flex: 2 }}>My Projects</h3>
        <input
          style={{ flex: 2 }}
          placeholder="Search Here"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={() => setShowForm(true)}
        >
          + New Project
        </button>
      </div>

      {showForm && (
        <NewProjectForm
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            loadProjects();
          }}
        />
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading...</p>}

      {!loading && !error && projects.length === 0 && (
        <div className="info-banner">No projects found.</div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="grid-2">
          {projects.map((project) => (
            <div className="card" key={project.id}>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                #{project.project_code || "N/A"}
              </div>
              <h3 style={{ marginTop: "0.25rem" }}>{project.project_name || "Untitled Project"}</h3>
              <p>{project.description || "No description available."}</p>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0.75rem 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span>Start Date: {project.start_date || "N/A"}</span>
                <span>End Date: {project.end_date || "N/A"}</span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: "100%", marginTop: "0.75rem" }}
                onClick={() => navigate(`/projects/${project.id}/dashboard`)}
              >
                Open Project
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewProjectForm({ onCancel, onCreated }) {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const name = projectName.trim();
    const desc = description.trim();

    if (!name) {
      setError("Project name is required.");
      return;
    }
    if (endDate < startDate) {
      setError("End date cannot be before start date.");
      return;
    }

    setBusy(true);
    try {
      await api("/projects", {
        method: "POST",
        body: { project_name: name, description: desc, start_date: startDate, end_date: endDate },
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
      <h3>Create New Project</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Project Name</label>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid-2">
          <div className="form-row">
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-row">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create Project"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
