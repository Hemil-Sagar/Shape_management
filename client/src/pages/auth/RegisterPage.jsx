import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "user" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name || !email || !form.password || !form.confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await register({ name, email, password: form.password, confirmPassword: form.confirmPassword, role: form.role });
      setSuccess("Registration successful. You can now log in.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "4rem auto" }}>
      <h1>BBSteel</h1>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--muted)" }}>Register</h2>
      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Name</label>
          <input value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Confirm Password</label>
          <input type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Role</label>
          <select value={form.role} onChange={(e) => update("role", e.target.value)}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Registering..." : "Register"}
          </button>
        </div>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
