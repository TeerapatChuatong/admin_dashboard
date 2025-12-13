// src/api/logoutApi.js
import { AUTH_BASE, toJsonOrError } from "./apiClient";

export async function logoutApi() {
  const res = await fetch(`${AUTH_BASE}/logout.php`, {
    method: "POST",
    credentials: "include", // ✅ ส่ง cookie session เพื่อเคลียร์ฝั่ง backend
  });

  return toJsonOrError(res, "ออกจากระบบไม่สำเร็จ");
}
