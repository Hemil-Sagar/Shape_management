import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Add User form state ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [addError, setAddError] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    const qs = searchText ? `?searchText=${encodeURIComponent(searchText)}` : "";
    api(`/admin/users${qs}`)
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [searchText]);

  function updateAddForm(field, value) {
    setAddForm((f) => ({ ...f, [field]: value }));
  }

  function openAddForm() {
    setAddForm({ name: "", email: "", password: "", role: "user" });
    setAddError("");
    setShowAddForm(true);
  }

  function closeAddForm() {
    setShowAddForm(false);
    setAddError("");
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setAddError("");

    const name = addForm.name.trim();
    const email = addForm.email.trim().toLowerCase();

    if (!name || !email || !addForm.password) {
      setAddError("Name, email, and password are required.");
      return;
    }

    setAddBusy(true);
    try {
      const newUser = await api("/admin/users", {
        method: "POST",
        body: { name, email, password: addForm.password, role: addForm.role },
      });

      // Add the new user straight into the table without re-fetching everything
      setUsers((prev) => [...prev, newUser]);
      setShowAddForm(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <div>
      <h1>User Management</h1>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, flex: 1 }}>Users</h3>
        <input
          style={{ flex: 2 }}
          placeholder="Search Here"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <button className="btn btn-primary" onClick={openAddForm}>
          + Add User
        </button>
      </div>

      {showAddForm && (
        <div className="card" style={{ marginBottom: "1rem", padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Add User</h3>
          {addError && <div className="error-banner">{addError}</div>}
          <form onSubmit={handleAddSubmit}>
            <div className="form-row">
              <label>Name</label>
              <input value={addForm.name} onChange={(e) => updateAddForm("name", e.target.value)} />
            </div>
            <div className="form-row">
              <label>Email</label>
              <input
                type="email"
                value={addForm.email}
                onChange={(e) => updateAddForm("email", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Password</label>
              <input
                type="password"
                value={addForm.password}
                onChange={(e) => updateAddForm("password", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Role</label>
              <select value={addForm.role} onChange={(e) => updateAddForm("role", e.target.value)}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="form-actions" style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-primary" type="submit" disabled={addBusy}>
                {addBusy ? "Creating..." : "Create User"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={closeAddForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading...</p>}
      {!loading && !error && users.length === 0 && (
        <div className="info-banner">No users found.</div>
      )}
      {!loading && !error && users.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name || "N/A"}</td>
                <td>{user.email}</td>
                <td>{user.status || "N/A"}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => navigate(`/admin/users/${user.id}`)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}