// src/api/apiClient.js

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "http://localhost/crud/api";

export const AUTH_BASE = `${API_BASE}/auth`;
export const USERS_BASE = `${API_BASE}/users`;
export const CHOICES_BASE = `${API_BASE}/choices`;
export const SCORES_BASE = `${API_BASE}/scores`;

export const SYMPTOMS_BASE = `${API_BASE}/symptoms`;
export const QUESTIONS_BASE = `${SYMPTOMS_BASE}/questions`;
export const ANSWERS_BASE = `${SYMPTOMS_BASE}/answers`;

const TOKEN_KEY = "auth_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// ✅ fetch กลาง: ใส่ credentials + Bearer token ให้อัตโนมัติ
export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}

// แปลง response → json พร้อมจัดการ error ให้เหมือนกันทุกที่
export async function toJsonOrError(res, defaultMsg) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false || data.status === "error" || data.success === false) {
    throw new Error(data.message || defaultMsg);
  }
  return data;
}

export function extractUsers(data) {
  return data.data || data.users || data || [];
}
