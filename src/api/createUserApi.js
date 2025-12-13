// src/api/createUserApi.js
import { USERS_BASE, toJsonOrError } from "./apiClient";

// payload เช่น { fname, lname, email, password, role }
export async function createUserApi(payload) {
  const res = await fetch(`${USERS_BASE}/create_users.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ✅ ส่ง cookie session ไปด้วย
    body: JSON.stringify(payload),
  });

  return toJsonOrError(res, "เพิ่มผู้ใช้ไม่สำเร็จ");
}
