import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Admin Dashboard" },
  { to: "/admin/shapes", label: "Shape & Formula Management" },
  { to: "/admin/users", label: "User Management" },
  { to: "/admin/project-monitoring", label: "Project Monitoring" },
  { to: "/admin/ai-requests", label: "AI Requests" },
  { to: "/admin/audit-logs", label: "Audit Logs" },
  { to: "/admin/settings", label: "Settings" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">BBSteel Admin</div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
            {item.label}
          </NavLink>
        ))}
        <div className="footer">
          <div>{user.name}</div>
          <div style={{ color: "var(--muted)", marginBottom: "0.5rem" }}>{user.role}</div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
