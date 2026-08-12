import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client.js";

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    setData(null);
    api(`/admin/users/${userId}`)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) {
    return (
      <div>
        <div className="error-banner">{error}</div>
        <Link className="btn btn-secondary" to="/admin/users">
          Back to Users
        </Link>
      </div>
    );
  }

  if (!data) return <p>Loading...</p>;

  const { user, stats, projects } = data;

  return (
    <div>
      <h1>{user.name || "User"}</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>{user.email}</div>

      <div className="metrics-row">
        <div className="metric">
          <div className="label">Projects</div>
          <div className="value">{stats.projects_count}</div>
        </div>
        <div className="metric">
          <div className="label">AutoCAD Imports</div>
          <div className="value">{stats.autocad_imports_count}</div>
        </div>
        <div className="metric">
          <div className="label">Beams</div>
          <div className="value">{stats.beams_count}</div>
        </div>
        <div className="metric">
          <div className="label">Filled Beams</div>
          <div className="value">{stats.filled_beams_count}</div>
        </div>
      </div>

      <h3>Projects</h3>
      {projects.length === 0 ? (
        <div className="info-banner">No projects found.</div>
      ) : (
        <div className="grid-2">
          {projects.map((project) => (
            <div className="card" key={project.id}>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                #{project.project_code || "N/A"}
              </div>
              <h3 style={{ marginTop: "0.25rem" }}>{project.project_name || "Untitled Project"}</h3>
              <p>{project.description || "No description available."}</p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span>Start Date: {project.start_date || "N/A"}</span>
                <span>End Date: {project.end_date || "N/A"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
