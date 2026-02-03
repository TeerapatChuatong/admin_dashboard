// src/api/_baseApi.js
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost/crud/api";
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    credentials: "include", // ใช้ session admin
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

  // บาง endpoint คืน array ตรง ๆ, บางอันคืน {ok:true,...}
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const err = new Error(
      data?.error?.message ||
        data?.message ||
        data?.error ||
        `request_failed_${res.status}`
    );
    err.status = res.status;
    err.code = data?.error?.code || data?.code || "REQUEST_FAILED";
    err.payload = data;
    throw err;
  }

  return data;
}
