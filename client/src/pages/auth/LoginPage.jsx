import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      navigate(user.role === "admin" ? "/admin/dashboard" : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "4rem auto" }}>
      <h1>BBSteel</h1>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--muted)" }}>Login</h2>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Logging in..." : "Login"}
          </button>
        </div>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
