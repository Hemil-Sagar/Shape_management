import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";

import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import Placeholder from "./components/Placeholder.jsx";

import UserLayout from "./components/UserLayout.jsx";
import UserDashboardPage from "./pages/user/UserDashboardPage.jsx";
import ProjectManagementPage from "./pages/user/ProjectManagementPage.jsx";
import ProjectDetailLayout from "./pages/user/ProjectDetailLayout.jsx";
import ProjectDashboardPage from "./pages/user/ProjectDashboardPage.jsx";
import BlocksPage from "./pages/user/BlocksPage.jsx";
import BlockDetailPage from "./pages/user/BlockDetailPage.jsx";
import AutocadImportsPage from "./pages/user/AutocadImportsPage.jsx";
import AutocadImportDetailPage from "./pages/user/AutocadImportDetailPage.jsx";
import BeamDetailPage from "./pages/user/BeamDetailPage.jsx";
import AiAssistantPage from "./pages/user/AiAssistantPage.jsx";
import MyAiRequestsPage from "./pages/user/MyAiRequestsPage.jsx";

import AdminLayout from "./components/AdminLayout.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminShapesPage from "./pages/admin/AdminShapesPage.jsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.jsx";
import AdminUserDetailPage from "./pages/admin/AdminUserDetailPage.jsx";
import AdminAiRequestsPage from "./pages/admin/AdminAiRequestsPage.jsx";
import AdminAiRequestDetailPage from "./pages/admin/AdminAiRequestDetailPage.jsx";

function RequireAuth({ children, role }) {
  const { loggedIn, user } = useAuth();
  if (!loggedIn) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { loggedIn, user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={loggedIn ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={loggedIn ? <Navigate to="/" replace /> : <RegisterPage />} />

      <Route
        path="/"
        element={
          !loggedIn ? (
            <Navigate to="/login" replace />
          ) : user.role === "admin" ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      {/* User routes */}
      <Route
        element={
          <RequireAuth role="user">
            <UserLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<UserDashboardPage />} />
        <Route path="/projects" element={<ProjectManagementPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ProjectDashboardPage />} />
          <Route path="blocks" element={<BlocksPage />} />
          <Route path="blocks/:blockId" element={<BlockDetailPage />} />
          <Route path="autocad-imports" element={<AutocadImportsPage />} />
          <Route path="autocad-imports/:importId" element={<AutocadImportDetailPage />} />
          <Route path="autocad-imports/:importId/beams/:beamId" element={<BeamDetailPage />} />
          <Route path="waste-inventory" element={<Placeholder title="Waste Inventory" />} />
          <Route path="access-control" element={<Placeholder title="Access Control" />} />
        </Route>
        <Route path="/ai-assistant" element={<AiAssistantPage />} />
        <Route path="/my-ai-requests" element={<MyAiRequestsPage />} />
        <Route path="/user-management" element={<Placeholder title="User Management" />} />
        <Route path="/subscription" element={<Placeholder title="Subscription" />} />
        <Route path="/payment-history" element={<Placeholder title="Payment History" />} />
      </Route>

      {/* Admin routes */}
      <Route
        element={
          <RequireAuth role="admin">
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/shapes" element={<AdminShapesPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
        <Route path="/admin/project-monitoring" element={<Placeholder title="Project Monitoring" />} />
        <Route path="/admin/ai-requests" element={<AdminAiRequestsPage />} />
        <Route path="/admin/ai-requests/:requestId" element={<AdminAiRequestDetailPage />} />
        <Route path="/admin/audit-logs" element={<Placeholder title="Audit Logs" />} />
        <Route path="/admin/settings" element={<Placeholder title="Settings" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
