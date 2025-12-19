// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

// ✅ Patch global fetch: ใส่ cookie + Bearer token ให้ทุก request
const _origFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  let token = "";
  try {
    const u = JSON.parse(localStorage.getItem("auth_user") || "null");
    token = u?.token ? String(u.token) : "";
  } catch {}

  const headers = new Headers(init.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return _origFetch(input, {
    ...init,
    credentials: init.credentials || "include",
    headers,
  });
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
