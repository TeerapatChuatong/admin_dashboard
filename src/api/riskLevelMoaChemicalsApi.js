// src/api/riskLevelMoaChemicalsApi.js
import { apiFetch } from "./_baseApi";

/** -------------------------------
 * Helpers
 * ------------------------------*/
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function toQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/** -------------------------------
 * READ
 * ------------------------------*/
/**
 * readRiskLevelMoaChemicals
 * รองรับ 2 แบบ:
 *  - readRiskLevelMoaChemicals(2)
 *  - readRiskLevelMoaChemicals({ risk_level_id: 2, moa_group_id, chemical_id })
 */
export async function readRiskLevelMoaChemicals(arg = {}) {
  const params =
    typeof arg === "number" || typeof arg === "string"
      ? { risk_level_id: arg }
      : (arg || {});
  const url =
    "/risk_level_moa_chemicals/read_risk_level_moa_chemicals.php" + toQuery(params);

  return apiFetch(url, {
    method: "GET",
    headers: authHeaders(),
  });
}

/**
 * ใช้สำหรับ dropdown "สาร (Chemical)"
 * (ถ้าต้องการแบบ mini จริง ๆ ค่อยทำ endpoint แยกได้ แต่ตอนนี้อ่านจาก read_chemicals.php)
 */
export async function readChemicalsMini() {
  return apiFetch("/chemicals/read_chemicals.php", {
    method: "GET",
    headers: authHeaders(),
  });
}

/** -------------------------------
 * CREATE / UPDATE / DELETE (ตามที่หน้าเรียก)
 * ------------------------------*/
export async function createRiskLevelMoaChemical(payload) {
  // payload: { risk_level_id, moa_group_id, chemical_id, priority }
  return apiFetch("/risk_level_moa_chemicals/create_risk_level_moa_chemicals.php", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload || {}),
  });
}

export async function updateRiskLevelMoaChemical(payload) {
  // payload: { id, priority?, risk_level_id?, moa_group_id?, chemical_id? }
  return apiFetch("/risk_level_moa_chemicals/update_risk_level_moa_chemicals.php", {
    method: "POST", // backend รองรับ POST/PATCH
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload || {}),
  });
}

/**
 * deleteRiskLevelMoaChemical
 * รองรับ:
 *  - deleteRiskLevelMoaChemical(12)
 *  - deleteRiskLevelMoaChemical({ id: 12 })
 */
export async function deleteRiskLevelMoaChemical(arg) {
  const id =
    typeof arg === "object" && arg !== null ? arg.id : arg;

  if (id === undefined || id === null || id === "") {
    throw new Error("deleteRiskLevelMoaChemical: missing id");
  }

  const url =
    "/risk_level_moa_chemicals/delete_risk_level_moa_chemicals.php" +
    toQuery({ id });

  return apiFetch(url, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

/** -------------------------------
 * Backward-compatible exports (กันหน้าเดิมพัง)
 * ------------------------------*/
/**
 * เดิมคุณอาจเคยใช้ saveRiskLevelMoaChemicals(riskLevelId, items)
 * แต่ backend ปัจจุบันเป็น create/update ทีละรายการ
 * -> ทำให้เป็น "batch upsert" แบบง่าย ๆ (มี id = update, ไม่มี id = create)
 */
export async function saveRiskLevelMoaChemicals(riskLevelId, items = []) {
  const list = Array.isArray(items) ? items : [];

  const results = [];
  for (const it of list) {
    // รองรับฟิลด์ที่หน้าอาจส่งมา
    const payload = {
      id: it.id ?? it.mapping_id ?? it.risk_level_moa_chemical_id,
      risk_level_id: it.risk_level_id ?? riskLevelId,
      moa_group_id: it.moa_group_id,
      chemical_id: it.chemical_id,
      priority: it.priority,
    };

    if (payload.id) {
      results.push(await updateRiskLevelMoaChemical(payload));
    } else {
      // remove id field for create
      const { id, ...createPayload } = payload;
      results.push(await createRiskLevelMoaChemical(createPayload));
    }
  }

  return results;
}

/** เดิมบางไฟล์เรียกชื่อ deleteRiskLevelMoaChemicalRow */
export const deleteRiskLevelMoaChemicalRow = deleteRiskLevelMoaChemical;
