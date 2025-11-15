// src/api/apiClient.js

export const API_BASE = "http://localhost/crud/api";
export const AUTH_BASE = `${API_BASE}/auth`;
export const USERS_BASE = `${API_BASE}/users`;

// แปลง response → json พร้อมจัดการ error ให้เหมือนกันทุกที่
export async function toJsonOrError(res, defaultMsg) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.status === "error" || data.success === false) {
    throw new Error(data.message || defaultMsg);
  }
  return data;
}

// ใช้ตอน read/search user ที่ backend อาจห่อ data หลายแบบ
export function extractUsers(data) {
  return data.data || data.users || data || [];
}
