// AuthContext.jsx
// Wraps the feathers client's auth logic in a React context so any page
// can use `useAuth()` instead of importing the client directly.

import { createContext, useContext, useEffect, useState } from "react";
import client from "../api/feathersClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // On first load, try to restore a session from a JWT already in localStorage
  useEffect(() => {
    async function restoreSession() {
      try {
        const result = await client.reAuthenticate();
        setUser(result.user);
      } catch (err) {
        // No valid stored token - user just isn't logged in, that's fine
      } finally {
        setCheckingAuth(false);
      }
    }

    restoreSession();
  }, []);

  async function login({ email, password }) {
    const result = await client.authenticate({
      strategy: "local",
      email,
      password,
    });
    setUser(result.user);
    return result.user;
  }

  // Note: registration does NOT log the user in automatically here -
  // it just creates the account. RegisterPage sends them to /login after.
  async function register({ name, email, password, confirmPassword, role }) {
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    const newUser = await client.service("users").create({
      name,
      email,
      password,
      role,
    });

    return newUser;
  }

  async function logout() {
    await client.logout();
    setUser(null);
  }

  const value = { user, checkingAuth, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return ctx;
}
