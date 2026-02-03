// src/api/moaGroupsApi.js
// ใช้ fetch ตรง + แนบ Authorization ถ้ามี token ใน localStorage
// ปรับ API_BASE ให้ตรงกับโปรเจกต์คุณได้ (หรือใช้ env VITE_API_BASE_URL)

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost/crud/api";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    ""
  );
}

function buildUrl(path, params = null) {
  const cleanBase = API_BASE.replace(/\/+$/, "");
  const cleanPath = String(path || "").startsWith("/")
    ? path
    : `/${path || ""}`;

  const url = new URL(`${cleanBase}${cleanPath}`);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function request(path, { method = "GET", params = null, body = null } = {}) {
  const url = buildUrl(path, params);

  const headers = { Accept: "application/json" };
  const token = getToken();
  if (token) {
    headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }
  if (body != null) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      `Request failed (${res.status}${res.statusText ? ` ${res.statusText}` : ""})`;
    throw new Error(msg);
  }

  return data;
}

// ---------- Public APIs ----------
export function readMoaGroupsApi(filters = {}) {
  // backend อาจจะรองรับ moa_system filter
  return request("/moa_groups/read_moa_groups.php", { params: filters });
}

// ✅ เพิ่ม alias เพื่อให้ import { readMoaGroups } ใช้งานได้
export const readMoaGroups = readMoaGroupsApi;

export function createMoaGroup(payload) {
  return request("/moa_groups/create_moa_groups.php", {
    method: "POST",
    body: payload,
  });
}

export function updateMoaGroup(payload) {
  return request("/moa_groups/update_moa_groups.php", {
    method: "POST",
    body: payload,
  });
}

export function deleteMoaGroup(moa_group_id) {
  return request("/moa_groups/delete_moa_groups.php", {
    method: "POST",
    body: { moa_group_id },
  });
}
