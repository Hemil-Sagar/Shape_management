import { useEffect, useState } from "react";
import { Outlet, useParams, Link } from "react-router-dom";
import { api } from "../../api/client.js";

export default function ProjectDetailLayout() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api(`/projects/${projectId}`)
      .then((data) => !cancelled && setProject(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error) {
    return (
      <div>
        <div className="error-banner">{error}</div>
        <Link to="/projects" className="btn btn-secondary">Back to Projects</Link>
      </div>
    );
  }

  if (!project) return <p>Loading...</p>;

  return <Outlet context={{ project, reloadProject: () => api(`/projects/${projectId}`).then(setProject) }} />;
}
