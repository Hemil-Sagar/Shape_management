import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, imageUrl } from "../../api/client.js";

const REQUEST_TYPE_LABELS = {
  formula_update: "Formula Update",
  new_shape: "New Shape Request",
  formula_explanation: "Formula Explanation",
};

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

function NewShapeDetails({ request }) {
  const payload = request.new_shape_payload || {};
  const outputs = payload.outputs || [];
  const imageFileId = payload.image_file_id || request.new_shape_image_file_id || request.image_file_id;

  return (
    <div>
      <div className="grid-2">
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

      {imageFileId && (
        <div style={{ marginBottom: "1rem" }}>
          <strong>Shape Image</strong>
          <div>
            <img src={imageUrl(imageFileId)} alt={payload.shape_name || "Shape"} style={{ maxWidth: 350 }} />
          </div>
        </div>
      )}

      {outputs.length > 0 ? (
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
      ) : (
        <div className="info-banner">No output formulas found.</div>
      )}
    </div>
  );
}

function AdminActions({ request, onApplied, onError }) {
  const [adminComment, setAdminComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    if (busy) return;
    setBusy(true);
    onError("");
    try {
      const path =
        request.request_type === "formula_update"
          ? `/ai-requests/${request.id}/apply-formula-update`
          : `/ai-requests/${request.id}/apply-new-shape`;

      await api(path, { method: "POST", body: { admin_comment: adminComment } });
      onApplied();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (busy) return;
    setBusy(true);
    onError("");
    try {
      await api(`/ai-requests/${request.id}/reject`, {
        method: "POST",
        body: { admin_comment: adminComment },
      });
      onApplied();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const approveLabel =
    request.request_type === "formula_update"
      ? "Approve & Apply to Project"
      : request.request_type === "new_shape"
      ? "Approve & Add Shape to Project"
      : null;

  return (
    <div className="card">
      <h3>Admin Action</h3>
      <div className="form-row">
        <label>Admin comment</label>
        <textarea
          placeholder="Optional comment for the user"
          value={adminComment}
          onChange={(e) => setAdminComment(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        {approveLabel ? (
          <button className="btn btn-primary" onClick={handleApprove} disabled={busy}>
            {busy ? "Working..." : approveLabel}
          </button>
        ) : (
          <div className="info-banner">This request type is not supported yet.</div>
        )}
        <button className="btn btn-danger" onClick={handleReject} disabled={busy}>
          {busy ? "Working..." : "Reject Request"}
        </button>
      </div>
    </div>
  );
}

export default function AdminAiRequestDetailPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function loadRequest() {
    setLoading(true);
    setError("");
    api(`/ai-requests/${requestId}`)
      .then(setRequest)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  if (loading) return <p>Loading...</p>;

  if (error || !request) {
    return (
      <div>
        <div className="error-banner">{error || "AI request not found."}</div>
        <Link className="btn btn-secondary" to="/admin/ai-requests">
          Back to AI Requests
        </Link>
      </div>
    );
  }

  const requestType = request.request_type;
  const status = request.status || "pending";

  return (
    <div>
      <h1>AI Request Detail</h1>
      <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Admin - AI Requests - {getRequestTypeLabel(requestType)}
      </div>

      <button className="btn btn-secondary" onClick={() => navigate("/admin/ai-requests")}>
        Back to AI Requests
      </button>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />

      {successMessage && <div className="success-banner">{successMessage}</div>}
      {actionError && <div className="error-banner">{actionError}</div>}

      <div className="grid-2">
        <div className="card">
          <h3>Request Info</h3>
          <p><strong>Request Type:</strong> {getRequestTypeLabel(requestType)}</p>
          <p><strong>Status:</strong> {status}</p>
          <p><strong>Requested By:</strong> {request.requested_by_name || "N/A"}</p>
          <p><strong>Email:</strong> {request.requested_by || "N/A"}</p>
          <p><strong>Project:</strong> {request.project_name || "N/A"}</p>
          <div className="info-banner">Scope: This request will apply only to the selected project.</div>
        </div>

        <div className="card">
          <h3>Shape Info</h3>
          <p><strong>Category:</strong> {request.category || "N/A"}</p>
          {requestType === "new_shape" ? (
            <p>
              <strong>New Shape:</strong>{" "}
              {(request.new_shape_payload || {}).shape_name || request.shape_name || "N/A"}
            </p>
          ) : (
            <>
              <p><strong>Shape:</strong> {request.shape_name || "N/A"}</p>
              <p><strong>Output:</strong> {request.output_name || "N/A"}</p>
            </>
          )}
          {request.created_at && (
            <p><strong>Created At:</strong> {formatDate(request.created_at)}</p>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />

      {requestType === "formula_update" && (
        <div className="card">
          <h3>Formula Change</h3>
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

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

          <h3>Reason and AI Suggestion</h3>
          <p><strong>Reason:</strong> {request.reason || "N/A"}</p>
          <div className="info-banner">{request.ai_suggestion || "No AI suggestion available."}</div>
        </div>
      )}

      {requestType === "new_shape" && (
        <div className="card">
          <h3>New Shape Details</h3>
          <NewShapeDetails request={request} />
        </div>
      )}

      {requestType !== "formula_update" && requestType !== "new_shape" && (
        <div className="error-banner">Unsupported request type.</div>
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />

      {status === "pending" ? (
        <AdminActions
          request={request}
          onError={setActionError}
          onApplied={() => {
            setSuccessMessage("Action completed successfully.");
            loadRequest();
          }}
        />
      ) : (
        <div className="info-banner">This request is already marked as: {status}</div>
      )}
    </div>
  );
}
