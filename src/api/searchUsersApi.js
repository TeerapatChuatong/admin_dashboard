// src/api/searchUsersApi.js
import { USERS_BASE, toJsonOrError, extractUsers } from "./apiClient";

export async function searchUsersApi(keyword) {
  const url = `${USERS_BASE}/search.php?keyword=${encodeURIComponent(
    keyword
  )}`;

  const res = await fetch(url, {
    method: "GET",
  });

  const data = await toJsonOrError(res, "ค้นหาผู้ใช้ไม่สำเร็จ");
  return extractUsers(data);
}
