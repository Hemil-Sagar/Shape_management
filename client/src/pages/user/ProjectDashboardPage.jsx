import { useOutletContext } from "react-router-dom";

export default function ProjectDashboardPage() {
  const { project } = useOutletContext();

  return (
    <div>
      <h1>Project Dashboard</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Home • {project.project_name || "Project"} • Dashboard
      </div>

      <div className="metrics-row">
        <div className="metric">
          <div className="label">Project Code</div>
          <div className="value">{project.project_code || "N/A"}</div>
        </div>
        <div className="metric">
          <div className="label">Status</div>
          <div className="value">{project.status || "N/A"}</div>
        </div>
      </div>

      <h3>{project.project_name || "Untitled Project"}</h3>
      <p>{project.description || "No description available."}</p>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 400 }}>
        <div>
          <strong>Start Date:</strong> {project.start_date || "N/A"}
        </div>
        <div>
          <strong>End Date:</strong> {project.end_date || "N/A"}
        </div>
      </div>
      <p>
        <strong>Created By:</strong> {project.created_by_name || "N/A"}
      </p>
    </div>
  );
}
