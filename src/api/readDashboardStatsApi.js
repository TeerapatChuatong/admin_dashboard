// src/api/readDashboardStatsApi.js
import { API_BASE, apiFetch, toJsonOrError } from "./apiClient";

const DASHBOARD_BASE = `${API_BASE}/dashboard`;

export async function readDashboardStatsApi() {
  const res = await apiFetch(`${DASHBOARD_BASE}/dashboard_stats.php`, { method: "GET" });

  // รองรับทั้ง 2 รูปแบบ:
  // 1) { ok:true, totals:... }
  // 2) { ok:true, data:{ totals:... } }  ← มาจาก json_ok ใน db.php
  const json = await toJsonOrError(res, "โหลดข้อมูลสถิติ Dashboard ไม่สำเร็จ");
  return json?.data ?? json;
}

export default readDashboardStatsApi;
