import { API_BASE, toJsonOrError } from "./apiClient";

const DISEASES_BASE = `${API_BASE}/diseases`;

export async function readDiseasesApi() {
  const res = await fetch(`${DISEASES_BASE}/read_diseases.php`, { method: "GET" });
  const data = await toJsonOrError(res, "โหลดรายชื่อโรคไม่สำเร็จ");
  const list = data.data || data.diseases || data || [];
  return Array.isArray(list) ? list : [];
}
