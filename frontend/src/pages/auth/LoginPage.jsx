import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) {
      setError("Email and password are required.");
      return;
    }

    setBusy(true);
    try {
      const user = await login({ email, password: form.password });
      // Send admins and regular users to the same place for now -
      // branch here later if you want separate admin/user landing pages
      navigate(user.role === "admin" ? "/dashboard" : "/dashboard");
    } catch (err) {
      setError(err.message || "Invalid email or password.");
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
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Logging in..." : "Login"}
          </button>
        </div>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
