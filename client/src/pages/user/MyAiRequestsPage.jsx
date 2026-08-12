import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

const STATUS_OPTIONS = ["All", "pending", "applied", "rejected", "needs_more_info", "approved"];

const REQUEST_TYPE_LABELS = {
  formula_update: "Formula Update",
  new_shape: "New Shape Request",
  formula_explanation: "Formula Explanation",
};

function getRequestCode(request) {
  return request.request_code || `AIR-${String(request.id || "").slice(-6).toUpperCase()}`;
}

function getRequestTypeLabel(requestType) {
  return REQUEST_TYPE_LABELS[requestType] || requestType || "Request";
}

function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function StatusBanner({ status }) {
  if (status === "pending") {
    return <div className="info-banner">This request is waiting for admin review.</div>;
  }
  if (status === "applied") {
    return <div className="success-banner">This request has been approved and applied to this project.</div>;
  }
  if (status === "rejected") {
    return <div className="error-banner">This request was rejected.</div>;
  }
  return null;
}

function FormulaUpdateDetails({ request }) {
  return (
    <div>
      <strong>Formula Change Details</strong>
      <div className="grid-2" style={{ marginTop: "0.5rem" }}>
        <div>
          <p><strong>Project:</strong> {request.project_name || "N/A"}</p>
          <p><strong>Category:</strong> {request.category || "N/A"}</p>
          <p><strong>Shape:</strong> {request.shape_name || "N/A"}</p>
          <p><strong>Output:</strong> {request.output_name || "N/A"}</p>
        </div>
        <div>
          <p><strong>Reason:</strong> {request.reason || "N/A"}</p>
          <p><strong>Scope:</strong> This request applies only to this project.</p>
        </div>
      </div>
      <div className="grid-2">
        <div>
          <strong>Current Formula</strong>
          <pre>{request.current_formula || "N/A"}</pre>
        </div>
        <div>
          <strong>Requested Formula</strong>
          <pre>{request.requested_formula || "N/A"}</pre>
        </div>
      </div>
    </div>
  );
}

function NewShapeDetails({ request }) {
  const payload = request.new_shape_payload || {};
  const outputs = payload.outputs || [];

  return (
    <div>
      <strong>New Shape Details</strong>
      <div className="grid-2" style={{ marginTop: "0.5rem" }}>
        <div>
          <p><strong>Project:</strong> {request.project_name || "N/A"}</p>
          <p><strong>Category:</strong> {(request.category || "beam").replace(/^\w/, (c) => c.toUpperCase())}</p>
          <p><strong>Shape Name:</strong> {payload.shape_name || request.shape_name || "N/A"}</p>
        </div>
        <div>
          <p><strong>Description:</strong> {payload.description || "N/A"}</p>
          <p><strong>Reason:</strong> {request.reason || "N/A"}</p>
        </div>
      </div>

      {outputs.length > 0 && (
        <div className="card">
          <strong>Outputs / Formulas</strong>
          <table>
            <thead>
              <tr>
                <th>Output</th>
                <th>Formula</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {outputs.map((output, idx) => (
                <tr key={idx}>
                  <td>{output.output_name || "N/A"}</td>
                  <td>{output.formula || "N/A"}</td>
                  <td>{output.unit || "m"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RequestCard({ request }) {
  const requestType = request.request_type;
  const status = request.status || "pending";

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>{getRequestCode(request)}</h3>
          <p style={{ margin: 0 }}><strong>Type:</strong> {getRequestTypeLabel(requestType)}</p>
        </div>
        <div>
          <p style={{ margin: 0 }}><strong>Project:</strong> {request.project_name || "N/A"}</p>
          <p style={{ margin: 0 }}>
            <strong>Status:</strong> {status.charAt(0).toUpperCase() + status.slice(1)}
          </p>
        </div>
        <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{formatDate(request.created_at)}</div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0.75rem 0" }} />

      {requestType === "formula_update" && <FormulaUpdateDetails request={request} />}
      {requestType === "new_shape" && <NewShapeDetails request={request} />}
      {requestType !== "formula_update" && requestType !== "new_shape" && (
        <div className="error-banner">Unsupported request type.</div>
      )}

      {request.admin_comment && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0.75rem 0" }} />
          <p><strong>Admin Comment:</strong> {request.admin_comment}</p>
        </>
      )}

      <div style={{ marginTop: "0.75rem" }}>
        <StatusBanner status={status} />
      </div>
    </div>
  );
}

export default function MyAiRequestsPage() {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    params.set("statusFilter", statusFilter);
    if (searchText) params.set("searchText", searchText);

    api(`/ai-requests/mine?${params.toString()}`)
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, searchText]);

  return (
    <div>
      <h1>My AI Requests</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Track formula and shape requests submitted to admin
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <input
          style={{ flex: 2 }}
          placeholder="Search by project, shape, or request number"
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

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading...</p>}

      {!loading && !error && requests.length === 0 && <div className="info-banner">No AI requests found.</div>}

      {!loading &&
        !error &&
        requests.map((request) => <RequestCard key={request.id} request={request} />)}
    </div>
  );
}
