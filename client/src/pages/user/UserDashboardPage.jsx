import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

export default function UserDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api("/dashboard/user")
      .then((data) => !cancelled && setStats(data.stats))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to BBSteel dashboard.</p>

      {error && <div className="error-banner">{error}</div>}

      {!error && !stats && <p>Loading...</p>}

      {stats && (
        <div className="metrics-row">
          <div className="metric">
            <div className="label">Total Projects</div>
            <div className="value">{stats.total_projects}</div>
          </div>
          <div className="metric">
            <div className="label">Pending AI Requests</div>
            <div className="value">{stats.pending_ai_requests}</div>
          </div>
          <div className="metric">
            <div className="label">Applied AI Requests</div>
            <div className="value">{stats.applied_ai_requests}</div>
          </div>
        </div>
      )}
    </div>
  );
}
