// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { loginApi } from "../api/loginApi";
import { logoutApi } from "../api/logoutApi";

const AuthContext = createContext(null);

function pickUser(data) {
  // ปรับให้ยืดหยุ่นกับ response จาก PHP
  return (
    data.user ||
    data.data?.user ||
    data.data ||
    data
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("auth_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem("auth_user", JSON.stringify(user));
    else localStorage.removeItem("auth_user");
  }, [user]);

  async function login({ account, password }) {
    const data = await loginApi({ account, password });
    const u = pickUser(data);

    if (!u) throw new Error("ไม่พบข้อมูลผู้ใช้จาก API");
    if (!u.role) throw new Error("ไม่พบ role ของผู้ใช้");
    setUser(u);
    return u;
  }

  async function logout() {
    try {
      await logoutApi();
    } catch (e) {
      console.error(e);
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องใช้ภายใน <AuthProvider>");
  return ctx;
}
