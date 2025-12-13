const API_BASE = import.meta.env.VITE_API_BASE; 
// ตัวอย่าง: http://localhost/crud/api

const DISEASES_BASE = `${API_BASE}/diseases`;

async function toJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || `HTTP_${res.status}`);
  }
  return data;
}

export async function readDiseasesApi() {
  const res = await fetch(`${DISEASES_BASE}/read_diseases.php`, {
    method: "GET",
    credentials: "include",
  });
  const json = await toJson(res);
  return json.data;
}

export async function updateDiseaseApi(payload) {
  // payload: FormData หรือ Object (JSON)
  const isFD = payload instanceof FormData;

  const res = await fetch(`${DISEASES_BASE}/update_diseases.php`, {
    method: "POST",
    credentials: "include",
    headers: isFD ? undefined : { "Content-Type": "application/json" },
    body: isFD ? payload : JSON.stringify(payload),
  });

  const json = await toJson(res);
  return json.data;
}
