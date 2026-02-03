// src/api/diseaseRiskLevelsApi.js
import { apiFetch } from "./_baseApi";

function unwrapOkPayload(res) {
  // รองรับทั้ง array ตรง ๆ และ {ok:true, data:...} / {ok:true, rows:...}
  if (Array.isArray(res)) return res;

  if (res && typeof res === "object") {
    if ("data" in res) return res.data;
    if ("rows" in res) return res.rows;
    if ("items" in res) return res.items;
  }
  return res;
}

export async function readDiseaseRiskLevels(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `/disease_risk_levels/read_disease_risk_levels.php${qs ? `?${qs}` : ""}`;

  const res = await apiFetch(url);
  return unwrapOkPayload(res);
}

// ✅ alias กันหน้าไหน import ชื่อ readDiseaseRiskLevelsApi แล้วพัง
export const readDiseaseRiskLevelsApi = readDiseaseRiskLevels;

/**
 * ✅ อัปเดตพารามิเตอร์กฎต่อ Risk Level
 * Backend ของคุณเป็น PATCH + JSON (แก้ 405 / patch_only)
 */
export async function updateDiseaseRiskLevelRule(risk_level_id, payload = {}) {
  const body = { risk_level_id: Number(risk_level_id) };

  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    body[k] = v;
  });

  return apiFetch("/disease_risk_levels/update_disease_risk_levels.php", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ✅ alias
export const updateDiseaseRiskLevelRuleApi = updateDiseaseRiskLevelRule;

/**
 * ✅ ลบ Risk Level
 * Backend ของคุณเป็น DELETE และรับ risk_level_id ผ่าน query
 */
export async function deleteDiseaseRiskLevel(risk_level_id) {
  const qs = new URLSearchParams({ risk_level_id: String(risk_level_id) }).toString();
  return apiFetch(`/disease_risk_levels/delete_disease_risk_levels.php?${qs}`, {
    method: "DELETE",
  });
}

// ✅ alias
export const deleteDiseaseRiskLevelApi = deleteDiseaseRiskLevel;
