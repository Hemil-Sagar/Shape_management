import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function PrivateRoute({ children, role }) {
  const { user, checkingAuth } = useAuth();

  if (checkingAuth) {
    return <p style={{ textAlign: "center", marginTop: "4rem" }}>Loading...</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}