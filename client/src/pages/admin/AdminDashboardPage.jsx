import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api("/dashboard/admin")
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>Platform overview</div>

      {error && <div className="error-banner">{error}</div>}
      {!error && !data && <p>Loading...</p>}

      {data && (
        <>
          <div className="metrics-row">
            <div className="metric">
              <div className="label">Total Users</div>
              <div className="value">{data.stats.total_users}</div>
            </div>
            <div className="metric">
              <div className="label">Total Projects</div>
              <div className="value">{data.stats.total_projects}</div>
            </div>
            <div className="metric">
              <div className="label">Active Shapes</div>
              <div className="value">{data.stats.total_shapes}</div>
            </div>
            <div className="metric">
              <div className="label">AutoCAD Imports</div>
              <div className="value">{data.stats.total_imports}</div>
            </div>
            <div className="metric">
              <div className="label">Total Beams</div>
              <div className="value">{data.stats.total_beams}</div>
            </div>
            <div className="metric">
              <div className="label">Filled Beams</div>
              <div className="value">{data.stats.filled_beams}</div>
            </div>
          </div>

          <h3>Recent Projects</h3>
          {data.recent_projects.length === 0 ? (
            <div className="info-banner">No recent projects found.</div>
          ) : (
            <div className="grid-2">
              {data.recent_projects.map((project) => (
                <div className="card" key={project.id}>
                  <strong>{project.project_name || "Untitled Project"}</strong>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                    Code: {project.project_code || "N/A"}
                  </div>
                  <div>Created By: {project.created_by_name || "N/A"}</div>
                  <div>Status: {project.status || "N/A"}</div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginTop: "1.5rem" }}>Recently Added Shapes</h3>
          {data.recent_shapes.length === 0 ? (
            <div className="info-banner">No shapes found.</div>
          ) : (
            <div className="grid-2">
              {data.recent_shapes.map((shape) => (
                <div className="card" key={shape.id}>
                  <strong>{shape.shape_name || "Untitled Shape"}</strong>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                    Category: {shape.category || "N/A"}
                  </div>
                  <div>Outputs: {(shape.outputs || []).length}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
