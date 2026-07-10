import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";

const STATUS_OPTIONS = ["All", "pending", "approved", "rejected", "needs_more_info", "applied"];
const TYPE_OPTIONS = ["All", "formula_update", "new_shape"];

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

function RequestCard({ request, onOpen }) {
  const requestType = request.request_type;
  const status = request.status || "pending";

  let extraInfo = null;
  if (requestType === "formula_update") {
    extraInfo = (
      <>
        <p style={{ margin: 0 }}><strong>Shape:</strong> {request.shape_name || "N/A"}</p>
        <p style={{ margin: 0 }}><strong>Output:</strong> {request.output_name || "N/A"}</p>
      </>
    );
  } else if (requestType === "new_shape") {
    const payload = request.new_shape_payload || {};
    const outputNames = (payload.outputs || []).map((o) => o.output_name).filter(Boolean);
    extraInfo = (
      <>
        <p style={{ margin: 0 }}>
          <strong>New Shape:</strong> {payload.shape_name || request.shape_name || "N/A"}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Outputs:</strong> {outputNames.length ? outputNames.join(", ") : "N/A"}
        </p>
      </>
    );
  }

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>{getRequestCode(request)}</h3>
          <p style={{ margin: 0 }}><strong>Type:</strong> {getRequestTypeLabel(requestType)}</p>
          <p style={{ margin: 0 }}>
            <strong>Status:</strong> {status.charAt(0).toUpperCase() + status.slice(1)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0 }}><strong>Project:</strong> {request.project_name || "N/A"}</p>
          <p style={{ margin: 0 }}><strong>Requested By:</strong> {request.requested_by_name || "N/A"}</p>
          {extraInfo}
        </div>
        <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{formatDate(request.created_at)}</div>
      </div>

      <button className="btn btn-secondary" style={{ marginTop: "0.75rem" }} onClick={onOpen}>
        Open Request
      </button>
    </div>
  );
}

export default function AdminAiRequestsPage() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    params.set("statusFilter", statusFilter);
    params.set("requestTypeFilter", typeFilter);
    if (searchText) params.set("searchText", searchText);

    api(`/ai-requests?${params.toString()}`)
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter, searchText]);

  return (
    <div>
      <h1>AI Requests</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>Admin - AI-generated user requests</div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <input
          style={{ flex: 2 }}
          placeholder="Search by shape, project, or user"
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
        <select style={{ flex: 1 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {TYPE_OPTIONS.map((option) => (
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
        requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            onOpen={() => navigate(`/admin/ai-requests/${request.id}`)}
          />
        ))}
    </div>
  );
}
