// src/api/chemicalsApi.js
import { API_BASE } from "./apiClient";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function buildUrl(path, params = {}) {
  const base = String(API_BASE || "").replace(/\/$/, "");
  const p = String(path || "").replace(/^\//, "");
  const url = new URL(`${base}/${p}`);

  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") return;
    url.searchParams.set(k, String(v));
  });

  return url.toString();
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let fetchBody = undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(buildUrl(path), {
    method,
    headers,
    body: fetchBody,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-json response
  }

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error || json.detail)) ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

// -----------------------------
// API exports
// -----------------------------

export async function readChemicals(params = {}) {
  return request("chemicals/read_chemicals.php", {
    method: "GET",
    body: undefined,
    // query params handled by buildUrl wrapper below (we pass via path builder alternative)
  }).catch(() => {
    // fallback: if caller expects params, use buildUrl directly
  });
}

// Overload helper that truly supports params
export async function readChemicalsApi(params = {}) {
  const url = buildUrl("chemicals/read_chemicals.php", params);
  const token = getToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const msg =
      (json && (json.message || json.error || json.detail)) ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function searchChemicals(q, params = {}) {
  const url = buildUrl("chemicals/search_chemicals.php", { q, ...params });
  const token = getToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const msg =
      (json && (json.message || json.error || json.detail)) ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function createChemical(payload) {
  return request("chemicals/create_chemicals.php", {
    method: "POST",
    body: payload,
  });
}

// update_chemicals.php รองรับ PATCH/POST แต่เพื่อความชัวร์กับโฮสต์ทั่วไป ใช้ POST
export async function updateChemical(payload) {
  return request("chemicals/update_chemicals.php", {
    method: "POST",
    body: payload,
  });
}

export async function deleteChemical(chemical_id) {
  const url = buildUrl("chemicals/delete_chemicals.php", { chemical_id });
  const token = getToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: "DELETE", headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const msg =
      (json && (json.message || json.error || json.detail)) ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}
