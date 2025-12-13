// src/api/searchUsersApi.js
import { USERS_BASE, toJsonOrError, extractUsers } from "./apiClient";

export async function searchUsersApi(keyword) {
  const url = `${USERS_BASE}/search_users.php?keyword=${encodeURIComponent(
    keyword
  )}`;

  const res = await fetch(url, {
    method: "GET",
    credentials: "include", // ✅ ส่ง cookie session ไปด้วย
  });

  const data = await toJsonOrError(res, "ค้นหาผู้ใช้ไม่สำเร็จ");
  return extractUsers(data);
}
