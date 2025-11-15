// src/api/logoutApi.js
import { AUTH_BASE, toJsonOrError } from "./apiClient";

export async function logoutApi() {
  const res = await fetch(`${AUTH_BASE}/logout.php`, {
    method: "POST",
  });

  return toJsonOrError(res, "ออกจากระบบไม่สำเร็จ");
}
