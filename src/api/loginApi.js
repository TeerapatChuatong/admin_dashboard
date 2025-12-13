// src/api/loginApi.js
import { AUTH_BASE, toJsonOrError } from "./apiClient";

export async function loginApi({ account, password }) {
  const res = await fetch(`${AUTH_BASE}/login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ✅ สำคัญ: ส่ง/รับ cookie session
    body: JSON.stringify({ account, password }),
  });

  return toJsonOrError(res, "เข้าสู่ระบบไม่สำเร็จ");
}
