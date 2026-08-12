import { createContext, useContext, useState, useCallback } from "react";
import { api, setToken, getToken } from "../api/client.js";

const AuthContext = createContext(null);

function decodeUserFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: payload.userId, email: payload.email, role: payload.role, name: payload.name };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => decodeUserFromToken(getToken()));

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    return api("/auth/register", { method: "POST", body: payload });
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loggedIn: Boolean(user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
