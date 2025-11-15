// src/api/updateUserApi.js
import { USERS_BASE, toJsonOrError } from "./apiClient";

// payload ต้องมี id
export async function updateUserApi(payload) {
  const res = await fetch(`${USERS_BASE}/update.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return toJsonOrError(res, "อัปเดตผู้ใช้ไม่สำเร็จ");
}
