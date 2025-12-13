// src/api/deleteUserApi.js
import { USERS_BASE, toJsonOrError } from "./apiClient";

export async function deleteUserApi(id) {
  const res = await fetch(`${USERS_BASE}/delete_users.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ✅ ส่ง cookie session ไปด้วย
    body: JSON.stringify({ id }),
  });

  return toJsonOrError(res, "ลบผู้ใช้ไม่สำเร็จ");
}
