// src/api/readUsersApi.js
import { USERS_BASE, toJsonOrError, extractUsers } from "./apiClient";

export async function readUsersApi() {
  const res = await fetch(`${USERS_BASE}/read_users.php`, {
    method: "GET",
    credentials: "include", // ✅ ส่ง cookie session ไปด้วย
  });

  const data = await toJsonOrError(res, "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
  return extractUsers(data);
}
