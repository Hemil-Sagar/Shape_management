import { useAuth } from "../context/AuthContext.jsx";

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ maxWidth: 480, margin: "4rem auto" }}>
      <h1>BBSteel</h1>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--muted)" }}>
        Admin Dashboard
      </h2>
      <p>Logged in as {user?.name} ({user?.email})</p>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}