// src/pages/AdminRotationSummaryPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import { readDiseaseRiskLevels } from "../api/diseaseRiskLevelsApi";
import { readRiskLevelMoaPlan } from "../api/riskLevelMoaPlanApi";
import { readRiskLevelMoaChemicals } from "../api/riskLevelMoaChemicalsApi";
import { readTreatmentEpisode, readTreatmentEpisodeEvents } from "../api/treatmentEpisodesApi";

function sortByPriority(a, b) {
  return Number(a.priority) - Number(b.priority);
}

export default function AdminRotationSummaryPage() {
  const navigate = useNavigate();
  const ctx = useAuth();
  const user = ctx?.user ?? ctx?.auth?.user;
  const doLogout = ctx?.logout ?? ctx?.auth?.logout;

  const [riskLevels, setRiskLevels] = useState([]);
  const [riskLevelId, setRiskLevelId] = useState("");

  const [plan, setPlan] = useState([]);
  const [allowed, setAllowed] = useState([]);

  const [episodeId, setEpisodeId] = useState("");
  const [episode, setEpisode] = useState(null);
  const [events, setEvents] = useState([]);

  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedRisk = useMemo(
    () => riskLevels.find((r) => String(r.risk_level_id) === String(riskLevelId)),
    [riskLevels, riskLevelId]
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorText("");
        const rls = await readDiseaseRiskLevels();
        setRiskLevels(Array.isArray(rls) ? rls : []);
      } catch (e) {
        setErrorText(e.message || "โหลด risk levels ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!riskLevelId) {
      setPlan([]);
      setAllowed([]);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setErrorText("");
        const p = await readRiskLevelMoaPlan(riskLevelId);
        setPlan((Array.isArray(p) ? p : []).sort(sortByPriority));

        const a = await readRiskLevelMoaChemicals(riskLevelId);
        setAllowed((Array.isArray(a) ? a : []).sort(sortByPriority));
      } catch (e) {
        setErrorText(e.message || "โหลดข้อมูลแผน/สารไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [riskLevelId]);

  async function loadEpisode() {
    if (!episodeId) return;
    try {
      setLoading(true);
      setErrorText("");
      const ep = await readTreatmentEpisode(episodeId);
      setEpisode(ep || null);

      const ev = await readTreatmentEpisodeEvents(episodeId);
      const arr = Array.isArray(ev) ? ev : [];
      arr.sort((a, b) => new Date(a.event_at) - new Date(b.event_at));
      setEvents(arr);
    } catch (e) {
      setErrorText(e.message || "โหลด episode/events ไม่สำเร็จ");
      setEpisode(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  // ======= Compute Summary =======
  const planOrder = useMemo(() => {
    const arr = [...plan].sort(sortByPriority);
    return arr.map((x) => ({
      moa_group_id: Number(x.moa_group_id),
      moa_code: x.moa_code,
      group_name: x.group_name,
      priority: Number(x.priority),
    }));
  }, [plan]);

  const allowedByGroup = useMemo(() => {
    const map = new Map();
    for (const r of allowed) {
      const gid = Number(r.moa_group_id);
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid).push({
        chemical_id: Number(r.chemical_id),
        trade_name: r.trade_name,
        priority: Number(r.priority),
      });
    }
    for (const [k, v] of map.entries()) v.sort(sortByPriority);
    return map;
  }, [allowed]);

  const computed = useMemo(() => {
    if (!planOrder.length) return null;

    const maxSpraysPerGroup = Number(selectedRisk?.max_sprays_per_group ?? 2);

    // current group: prefer episode.current_moa_group_id, else last spray group, else first group
    let currentGroupId = episode?.current_moa_group_id ? Number(episode.current_moa_group_id) : null;

    if (!currentGroupId) {
      const lastSpray = [...events].reverse().find((e) => e.event_type === "spray" && e.moa_group_id);
      currentGroupId = lastSpray?.moa_group_id ? Number(lastSpray.moa_group_id) : Number(planOrder[0].moa_group_id);
    }

    // count sprays in current group since last switch_group (or from beginning)
    const lastSwitch = [...events].reverse().find((e) => e.event_type === "switch_group" && e.moa_group_id);
    const fromTime = lastSwitch?.event_at ? new Date(lastSwitch.event_at) : null;

    const spraysInGroup = events.filter((e) => {
      if (e.event_type !== "spray") return false;
      if (!e.moa_group_id) return false;
      if (Number(e.moa_group_id) !== currentGroupId) return false;
      if (!fromTime) return true;
      return new Date(e.event_at) >= fromTime;
    }).length;

    // decide next group
    let nextGroupId = currentGroupId;
    const idx = planOrder.findIndex((x) => Number(x.moa_group_id) === currentGroupId);
    if (spraysInGroup >= maxSpraysPerGroup && idx >= 0) {
      const nextIdx = (idx + 1) % planOrder.length;
      nextGroupId = Number(planOrder[nextIdx].moa_group_id);
    }

    const currentGroup = planOrder.find((x) => Number(x.moa_group_id) === currentGroupId);
    const suggestedGroup = planOrder.find((x) => Number(x.moa_group_id) === nextGroupId);

    // suggest chemical = first priority in suggested group
    const chemList = allowedByGroup.get(nextGroupId) || [];
    const suggestedChemical = chemList.length ? chemList[0] : null;

    return {
      maxSpraysPerGroup,
      currentGroupId,
      spraysInGroup,
      nextGroupId,
      currentGroup,
      suggestedGroup,
      suggestedChemical,
    };
  }, [planOrder, allowedByGroup, selectedRisk, episode, events]);

  function handleLogout() {
    try {
      doLogout?.();
    } finally {
      navigate("/");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn ghost" onClick={() => navigate("/admin")}>
            ← กลับหน้าหลัก
          </button>
          <h1 style={{ margin: 0 }}>Rotation Summary</h1>
        </div>

        <div className="header-right">
          <span>
            เข้าสู่ระบบเป็น: {user?.username ?? user?.email ?? "-"} ({user?.role ?? "admin"})
          </span>
          <button className="btn ghost" onClick={handleLogout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      {errorText ? <div className="alert error">{errorText}</div> : null}

      {/* Filters */}
      <div
        className="card"
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
      >
        <select
          value={riskLevelId}
          onChange={(e) => setRiskLevelId(e.target.value)}
          style={{ minWidth: 320 }}
        >
          <option value="">-- เลือก Risk Level --</option>
          {riskLevels.map((r) => (
            <option key={r.risk_level_id} value={r.risk_level_id}>
              {r.risk_level_id} - {r.risk_level_name || r.level_name || "Risk Level"}
            </option>
          ))}
        </select>

        <input
          placeholder="episode_id (ถ้าต้องการสรุปจาก log)"
          value={episodeId}
          onChange={(e) => setEpisodeId(e.target.value)}
          style={{ minWidth: 260 }}
        />

        <button className="btn" onClick={loadEpisode} disabled={!episodeId}>
          โหลด Episode
        </button>

        {loading ? (
          <span style={{ fontSize: 12, color: "#6b7280" }}>กำลังโหลด...</span>
        ) : null}
      </div>

      {/* Content */}
      <div className="card">
        {!riskLevelId ? (
          <div className="muted">เลือก Risk Level ก่อน</div>
        ) : (
          <>
            <div className="muted" style={{ marginBottom: 10 }}>
              พารามิเตอร์กฎ: max_sprays_per_group = <b>{selectedRisk?.max_sprays_per_group ?? "-"}</b>{" "}
              (ตัวอย่าง “ใช้ 1A 2 รอบแล้วสลับ” = 2)
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>ลำดับ</th>
                    <th style={{ width: 160 }}>MOA</th>
                    <th>ชื่อกลุ่ม</th>
                  </tr>
                </thead>
                <tbody>
                  {planOrder.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center" }}>
                        ยังไม่มีแผน (ไปตั้งที่ MOA Rotation Plan)
                      </td>
                    </tr>
                  ) : (
                    planOrder.map((g) => (
                      <tr key={g.moa_group_id}>
                        <td style={{ textAlign: "center" }}>{g.priority}</td>
                        <td style={{ textAlign: "center" }}>{g.moa_code || g.moa_group_id}</td>
                        <td style={{ whiteSpace: "pre-wrap" }}>{g.group_name || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <h3 style={{ marginTop: 0 }}>สรุปการสลับ / แนะนำสารถัดไป</h3>

              {!computed ? (
                <div className="muted">ต้องมีแผนก่อน</div>
              ) : (
                <div>
                  <div style={{ marginBottom: 6 }}>
                    กลุ่มปัจจุบัน:{" "}
                    <b>{computed.currentGroup?.moa_code || computed.currentGroupId}</b>{" "}
                    {computed.currentGroup?.group_name ? `- ${computed.currentGroup.group_name}` : ""}
                  </div>

                  <div style={{ marginBottom: 6 }}>
                    จำนวนรอบที่ใช้กลุ่มนี้ (จาก log): <b>{computed.spraysInGroup}</b> /{" "}
                    <b>{computed.maxSpraysPerGroup}</b>
                  </div>

                  <div style={{ marginBottom: 6 }}>
                    กลุ่มที่แนะนำถัดไป:{" "}
                    <b>{computed.suggestedGroup?.moa_code || computed.nextGroupId}</b>{" "}
                    {computed.suggestedGroup?.group_name ? `- ${computed.suggestedGroup.group_name}` : ""}
                  </div>

                  <div style={{ marginBottom: 6 }}>
                    สารที่แนะนำ (priority แรกของกลุ่ม):{" "}
                    <b>{computed.suggestedChemical?.trade_name || "-"}</b>{" "}
                    {computed.suggestedChemical?.chemical_id ? `(id:${computed.suggestedChemical.chemical_id})` : ""}
                  </div>

                  <div className="muted">
                    ถ้าคุณต้องการให้ “ระบบบันทึก event สลับกลุ่ม/สลับสาร อัตโนมัติ” ค่อยเพิ่มปุ่มยิง API ไปสร้าง
                    `treatment_episode_events` ชนิด `switch_group / switch_product`
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
