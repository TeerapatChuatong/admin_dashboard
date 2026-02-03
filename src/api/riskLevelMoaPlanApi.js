// src/api/riskLevelMoaPlanApi.js
// ใช้ endpoint PHP เดิม (ไม่แก้ PHP)

import { apiFetch } from "./_baseApi";

export async function readRiskLevelMoaPlan(risk_level_id) {
  const qs = new URLSearchParams();
  qs.set("risk_level_id", String(risk_level_id));
  return apiFetch(`/risk_level_moa_plan/read_risk_level_moa_plan.php?${qs.toString()}`);
}

export async function createRiskLevelMoaPlan({ risk_level_id, moa_group_id, priority }) {
  return apiFetch("/risk_level_moa_plan/create_risk_level_moa_plan.php", {
    method: "POST",
    body: JSON.stringify({
      risk_level_id: Number(risk_level_id),
      moa_group_id: Number(moa_group_id),
      priority: Number(priority),
    }),
  });
}

export async function updateRiskLevelMoaPlan({ plan_id, risk_level_id, moa_group_id, priority }) {
  // update_risk_level_moa_plan.php รองรับ PATCH/POST → ใช้ POST เพื่อความชัวร์
  return apiFetch("/risk_level_moa_plan/update_risk_level_moa_plan.php", {
    method: "POST",
    body: JSON.stringify({
      plan_id: Number(plan_id),
      ...(risk_level_id != null ? { risk_level_id: Number(risk_level_id) } : {}),
      ...(moa_group_id != null ? { moa_group_id: Number(moa_group_id) } : {}),
      ...(priority != null ? { priority: Number(priority) } : {}),
    }),
  });
}

export async function deleteRiskLevelMoaPlan(plan_id) {
  const qs = new URLSearchParams();
  qs.set("plan_id", String(plan_id));
  return apiFetch(`/risk_level_moa_plan/delete_risk_level_moa_plan.php?${qs.toString()}`, {
    method: "DELETE",
  });
}

/**
 * บันทึกแผนแบบ bulk โดยใช้ endpoint เดิม (create/update/delete รายแถว)
 * - deleted_plan_ids: plan_id ที่ถูกลบใน UI ก่อนกดบันทึก
 * - items: แถวทั้งหมดที่ต้องการคงไว้ (ทั้งที่มี plan_id แล้ว และแถวใหม่ที่ยังไม่มี)
 */
export async function saveRiskLevelMoaPlan(risk_level_id, items = [], deleted_plan_ids = []) {
  const rid = Number(risk_level_id);

  // 1) ลบก่อน (กันชนกรณี priority ซ้ำ)
  if (Array.isArray(deleted_plan_ids) && deleted_plan_ids.length > 0) {
    await Promise.all(
      deleted_plan_ids
        .filter((id) => id != null && String(id).trim() !== "")
        .map((id) =>
          deleteRiskLevelMoaPlan(id).catch((e) => ({
            ok: false,
            plan_id: id,
            error: e?.message || String(e),
          }))
        )
    );
  }

  // 2) create/update ตามแถวที่เหลือ
  const ops = (Array.isArray(items) ? items : []).map(async (it) => {
    const payload = {
      risk_level_id: rid,
      moa_group_id: Number(it?.moa_group_id),
      priority: Number(it?.priority),
    };

    if (it?.plan_id) {
      return updateRiskLevelMoaPlan({
        plan_id: it.plan_id,
        risk_level_id: rid,
        moa_group_id: payload.moa_group_id,
        priority: payload.priority,
      });
    }
    return createRiskLevelMoaPlan(payload);
  });

  const results = await Promise.all(ops);
  return { ok: true, results };
}
