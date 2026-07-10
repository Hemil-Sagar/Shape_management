import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/projects", label: "Project Management" },
  { to: "/ai-assistant", label: "AI Assistant" },
  { to: "/my-ai-requests", label: "My AI Requests" },
  { to: "/user-management", label: "User Management" },
  { to: "/subscription", label: "Subscription" },
  { to: "/payment-history", label: "Payment History" },
];

export default function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inProject = location.pathname.startsWith("/projects/") && location.pathname !== "/projects";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">BBSteel</div>
        {inProject ? (
          <ProjectSidebar />
        ) : (
          NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ))
        )}
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

function ProjectSidebar() {
  const location = useLocation();
  const match = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = match?.[1];

  return (
    <>
      <NavLink to="/projects">&larr; Back to Projects</NavLink>
      <div className="caption">Project</div>
      <NavLink to={`/projects/${projectId}/dashboard`}>Dashboard</NavLink>
      <NavLink to={`/projects/${projectId}/blocks`}>Blocks</NavLink>
      <NavLink to={`/projects/${projectId}/autocad-imports`}>AutoCAD Import</NavLink>
      <NavLink to={`/projects/${projectId}/waste-inventory`}>Waste Inventory</NavLink>
      <NavLink to={`/projects/${projectId}/access-control`}>Access Control</NavLink>
    </>
  );
}
