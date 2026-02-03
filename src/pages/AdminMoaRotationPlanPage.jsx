// src/pages/AdminMoaRotationPlanPage.jsx
// หน้าจัดการ MOA Rotation Plan (risk_level_moa_plan)

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import RequireAdmin from "../components/RequireAdmin";
import { apiFetch } from "../api/_baseApi";
import { readDiseaseRiskLevels } from "../api/diseaseRiskLevelsApi";
import { readMoaGroups } from "../api/moaGroupsApi";
import { readRiskLevelMoaPlan, saveRiskLevelMoaPlan } from "../api/riskLevelMoaPlanApi";

const MOA_SYSTEMS = ["FRAC", "IRAC", "HRAC"];

export default function AdminMoaRotationPlanPage() {
  const navigate = useNavigate();

  // ----- master data -----
  const [diseases, setDiseases] = useState([]);
  const [riskLevels, setRiskLevels] = useState([]);
  const [moaGroupsAll, setMoaGroupsAll] = useState([]);

  // ----- selection -----
  const [riskLevelId, setRiskLevelId] = useState(""); // ต้องเป็น string/number เท่านั้น (ห้ามเป็น object)
  const [moaSystem, setMoaSystem] = useState("FRAC");

  // ----- plan -----
  const [planRows, setPlanRows] = useState([]);
  const [deletedPlanIds, setDeletedPlanIds] = useState([]);

  // ----- ui state -----
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // modal add group
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addMoaGroupId, setAddMoaGroupId] = useState("");
  const [addPriority, setAddPriority] = useState("");

  // ---------- maps ----------
  const diseaseNameById = useMemo(() => {
    const m = new Map();
    (diseases || []).forEach((d) => {
      const id = Number(d?.disease_id);
      const name =
        d?.disease_name_th ||
        d?.disease_th ||
        d?.disease_name ||
        d?.disease_en ||
        d?.disease_name_en ||
        "";
      if (!Number.isNaN(id)) m.set(id, String(name || "").trim());
    });
    return m;
  }, [diseases]);

  const moaGroupById = useMemo(() => {
    const m = new Map();
    (moaGroupsAll || []).forEach((g) => {
      const id = Number(g?.moa_group_id);
      if (!Number.isNaN(id)) m.set(id, g);
    });
    return m;
  }, [moaGroupsAll]);

  // ---------- options ----------
  const riskLevelOptions = useMemo(() => {
    // label: "ชื่อโรค - ระดับ"
    return (riskLevels || []).map((rl) => {
      const diseaseId = Number(rl?.disease_id);
      const diseaseName = diseaseNameById.get(diseaseId) || `โรค#${diseaseId}`;
      const riskName = String(rl?.risk_level_name || "").trim();
      return {
        ...rl,
        label: `${diseaseName} - ${riskName}`,
      };
    });
  }, [riskLevels, diseaseNameById]);

  const selectedRiskLevel = useMemo(() => {
    const idNum = Number(riskLevelId);
    return riskLevelOptions.find((r) => Number(r?.risk_level_id) === idNum) || null;
  }, [riskLevelId, riskLevelOptions]);

  const moaGroupsFiltered = useMemo(() => {
    const sys = String(moaSystem).toUpperCase();
    return (moaGroupsAll || [])
      .filter((g) => String(g?.moa_system || "").toUpperCase() === sys)
      .sort((a, b) => String(a?.moa_code || "").localeCompare(String(b?.moa_code || "")));
  }, [moaGroupsAll, moaSystem]);

  // แผนที่แสดงในตาราง: กรองตาม moaSystem
  const planVisible = useMemo(() => {
    const sys = String(moaSystem).toUpperCase();
    const sorted = (planRows || [])
      .slice()
      .sort((a, b) => Number(a?.priority) - Number(b?.priority));

    // ถ้ายัง map moa_system ไม่ได้เลย ให้โชว์ทั้งหมดไปก่อน (กันตารางว่างช่วงโหลด)
    const anyHasSystem = sorted.some((r) => {
      const g = moaGroupById.get(Number(r?.moa_group_id));
      const rowSys = String(r?.moa_system || g?.moa_system || "").toUpperCase();
      return !!rowSys;
    });
    if (!anyHasSystem) return sorted;

    return sorted.filter((r) => {
      const g = moaGroupById.get(Number(r?.moa_group_id));
      const rowSys = String(r?.moa_system || g?.moa_system || "").toUpperCase();
      return rowSys === sys;
    });
  }, [planRows, moaSystem, moaGroupById]);

  const emptyPlanText = useMemo(() => {
    const sys = String(moaSystem).toUpperCase();
    const riskLabel = selectedRiskLevel?.label || "";
    return riskLabel ? `ยังไม่มีแผนสำหรับ ${sys} (${riskLabel})` : `ยังไม่มีแผนสำหรับ ${sys}`;
  }, [moaSystem, selectedRiskLevel]);

  // ---------- load master data ----------
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErrorMsg("");

        const [diseasesRes, riskRes, groupsRes] = await Promise.all([
          apiFetch("/diseases/read_diseases.php"),
          readDiseaseRiskLevels(),
          readMoaGroups(),
        ]);

        if (!alive) return;

        setDiseases(Array.isArray(diseasesRes?.data) ? diseasesRes.data : diseasesRes || []);
        setRiskLevels(Array.isArray(riskRes?.data) ? riskRes.data : riskRes || []);
        setMoaGroupsAll(Array.isArray(groupsRes?.data) ? groupsRes.data : groupsRes || []);
      } catch (e) {
        if (!alive) return;
        setErrorMsg(e?.message || "โหลดข้อมูลเริ่มต้นไม่สำเร็จ");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ---------- load plan ----------
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!riskLevelId) {
        setPlanRows([]);
        setDeletedPlanIds([]);
        return;
      }

      setLoading(true);
      setErrorMsg("");

      try {
        // สำคัญ: ส่ง risk_level_id เป็นค่า string/number เท่านั้น (ห้ามเป็น object)
        const res = await readRiskLevelMoaPlan(String(riskLevelId));
        if (!alive) return;

        const rows = Array.isArray(res?.data) ? res.data : res || [];

        // normalize + map moa_system จาก moa_group_id
        const normalized = rows.map((r) => {
          const gid = Number(r?.moa_group_id);
          const g = moaGroupById.get(gid);
          return {
            ...r,
            plan_id: r?.plan_id ?? r?.id ?? null,
            risk_level_id: Number(r?.risk_level_id ?? riskLevelId),
            moa_group_id: gid,
            priority: Number(r?.priority ?? 0),
            moa_code: r?.moa_code ?? g?.moa_code ?? "",
            moa_group_name: r?.moa_group_name ?? r?.group_name ?? g?.moa_group_name ?? g?.group_name ?? "",
            moa_system: r?.moa_system ?? g?.moa_system ?? "",
          };
        });

        setPlanRows(normalized);
        setDeletedPlanIds([]);
      } catch (e) {
        if (!alive) return;
        setErrorMsg(e?.message || "โหลดแผนไม่สำเร็จ");
        setPlanRows([]);
        setDeletedPlanIds([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [riskLevelId, moaGroupById]);

  // ---------- handlers ----------
  const openAddModal = () => {
    setErrorMsg("");
    setAddMoaGroupId("");
    const next = (planVisible?.length || 0) + 1;
    setAddPriority(String(next));
    setIsAddOpen(true);
  };

  const addGroupToPlan = () => {
    setErrorMsg("");

    if (!riskLevelId) {
      setErrorMsg("กรุณาเลือกระดับความเสี่ยงก่อน");
      return;
    }
    if (!addMoaGroupId) {
      setErrorMsg("กรุณาเลือกกลุ่ม MOA");
      return;
    }

    const gid = Number(addMoaGroupId);
    const exists = (planRows || []).some((r) => Number(r?.moa_group_id) === gid);
    if (exists) {
      setErrorMsg("กลุ่มนี้ถูกเพิ่มในแผนแล้ว");
      return;
    }

    const g = moaGroupById.get(gid);
    const pri = Number(addPriority || (planVisible?.length || 0) + 1);

    const newRow = {
      plan_id: null, // แถวใหม่ ยังไม่มีใน DB
      risk_level_id: Number(riskLevelId),
      moa_group_id: gid,
      priority: pri,
      moa_code: g?.moa_code || "",
      moa_group_name: g?.moa_group_name || g?.group_name || "",
      moa_system: g?.moa_system || moaSystem,
    };

    setPlanRows((prev) => [...(prev || []), newRow]);
    setIsAddOpen(false);
  };

  const moveRow = (idx, dir) => {
    const list = planVisible.slice();
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;

    const temp = list[idx];
    list[idx] = list[target];
    list[target] = temp;

    // re-number priority ในชุดที่มองเห็น (1..n)
    const renumberedVisible = list.map((r, i) => ({ ...r, priority: i + 1 }));

    // merge กลับเข้า planRows (ที่อาจมีระบบอื่นปนอยู่) โดยแทนที่เฉพาะแถวที่อยู่ใน visible
    setPlanRows((prevAll) => {
      const prev = prevAll || [];
      const visibleKey = new Set(renumberedVisible.map((r) => `${r.plan_id ?? "new"}:${r.moa_group_id}`));

      const updated = prev.map((r) => {
        const key = `${r.plan_id ?? "new"}:${r.moa_group_id}`;
        if (!visibleKey.has(key)) return r;
        const nv = renumberedVisible.find((x) => `${x.plan_id ?? "new"}:${x.moa_group_id}` === key);
        return nv || r;
      });

      // เผื่อกรณีแถวใหม่ (plan_id=null) ที่ key ชนกันยาก ให้ append แถวที่ยังไม่มีใน updated
      renumberedVisible.forEach((nv) => {
        const key = `${nv.plan_id ?? "new"}:${nv.moa_group_id}`;
        const has = updated.some((r) => `${r.plan_id ?? "new"}:${r.moa_group_id}` === key);
        if (!has) updated.push(nv);
      });

      return updated;
    });
  };

  const removeRow = (row) => {
    setErrorMsg("");
    const pid = row?.plan_id;

    setPlanRows((prev) => (prev || []).filter((r) => r !== row));

    if (pid) {
      setDeletedPlanIds((prev) => [...new Set([...(prev || []), pid])]);
    }
  };

  const onSave = async () => {
    setErrorMsg("");

    if (!riskLevelId) {
      setErrorMsg("กรุณาเลือกระดับความเสี่ยงก่อน");
      return;
    }

    setSaving(true);
    try {
      // บันทึกเฉพาะชุดที่มองเห็น (ตาม FRAC/IRAC ที่เลือก)
      const itemsToSave = planVisible
        .slice()
        .sort((a, b) => Number(a?.priority) - Number(b?.priority))
        .map((r, idx) => ({
          plan_id: r?.plan_id || null,
          moa_group_id: Number(r?.moa_group_id),
          priority: idx + 1,
        }));

      await saveRiskLevelMoaPlan(Number(riskLevelId), itemsToSave, deletedPlanIds);

      // reload
      const res = await readRiskLevelMoaPlan(String(riskLevelId));
      const rows = Array.isArray(res?.data) ? res.data : res || [];
      const normalized = rows.map((r) => {
        const gid = Number(r?.moa_group_id);
        const g = moaGroupById.get(gid);
        return {
          ...r,
          plan_id: r?.plan_id ?? r?.id ?? null,
          risk_level_id: Number(r?.risk_level_id ?? riskLevelId),
          moa_group_id: gid,
          priority: Number(r?.priority ?? 0),
          moa_code: r?.moa_code ?? g?.moa_code ?? "",
          moa_group_name: r?.moa_group_name ?? r?.group_name ?? g?.moa_group_name ?? g?.group_name ?? "",
          moa_system: r?.moa_system ?? g?.moa_system ?? "",
        };
      });

      setPlanRows(normalized);
      setDeletedPlanIds([]);
    } catch (e) {
      setErrorMsg(e?.message || "บันทึกแผนไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // ---------- styles (คงโทนเดิมแบบหน้า Questions) ----------
  const pageStyles = {
    padding: 24,
    background: "#f6f6f6",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  };

  const topBarStyles = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  };

  const btnOutline = {
    border: "1px solid #ff7a00",
    color: "#ff7a00",
    background: "#fff",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };

  const btnSolid = {
    border: "1px solid #ff7a00",
    color: "#fff",
    background: "#ff7a00",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 800,
  };

  const cardStyles = {
    background: "#fff",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 24px rgba(0,0,0,.06)",
    marginBottom: 16,
  };

  const rowStyles = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    alignItems: "center",
    marginTop: 8,
  };

  const selectStyles = {
    width: "100%",
    borderRadius: 12,
    border: "1px solid #e8e8e8",
    padding: "10px 12px",
    outline: "none",
    fontSize: 16,
    background: "#fff",
  };

  const tableStyles = {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 8,
  };

  const thStyles = {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid #eee",
    fontWeight: 900,
  };

  const tdStyles = {
    padding: "10px 8px",
    borderBottom: "1px solid #f1f1f1",
    verticalAlign: "middle",
  };

  const iconBtn = {
    border: "1px solid #eee",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 800,
  };

  const dangerBtn = {
    ...iconBtn,
    border: "1px solid #ffcccc",
    color: "#d40000",
  };

  // modal styles (ไม่ไปกระทบ UI ส่วนอื่น)
  const modalOverlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  };

  const modalCard = {
    width: "min(560px, 100%)",
    background: "#fff",
    borderRadius: 18,
    boxShadow: "0 18px 40px rgba(0,0,0,.22)",
    overflow: "hidden",
  };

  const modalHeader = {
    padding: 16,
    borderBottom: "1px solid #f0f0f0",
    fontWeight: 900,
    fontSize: 18,
  };

  const modalBody = {
    padding: 16,
    display: "grid",
    gap: 12,
  };

  const modalFooter = {
    padding: 16,
    borderTop: "1px solid #f0f0f0",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  };

  return (
    <RequireAdmin>
      <div style={pageStyles}>
        <div style={topBarStyles}>
          <button style={btnOutline} onClick={() => navigate("/admin")}>
            ← กลับหน้าหลัก
          </button>

          <div style={{ flex: 1 }} />

          <div style={{ fontWeight: 700, color: "#666" }}>
            เข้าสู่ระบบเป็น: <span style={{ color: "#111" }}>Admin</span>
          </div>

          <button style={btnOutline} onClick={() => navigate("/logout")}>
            ออกจากระบบ
          </button>
        </div>

        <h1 style={{ margin: "6px 0 12px", fontSize: 44, letterSpacing: -1 }}>MOA Rotation Plan</h1>

        {errorMsg ? (
          <div
            style={{
              ...cardStyles,
              border: "1px solid #ffd6d6",
              background: "#fff7f7",
              color: "#b80000",
              fontWeight: 700,
            }}
          >
            {errorMsg}
          </div>
        ) : null}

        <div style={cardStyles}>
          <div style={rowStyles}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>เลือกระดับความเสี่ยง (โรค - ระดับ)</div>
              <select
                style={selectStyles}
                value={riskLevelId}
                onChange={(e) => setRiskLevelId(e.target.value)}
              >
                <option value="">-- เลือก --</option>
                {riskLevelOptions.map((r) => (
                  <option key={r?.risk_level_id} value={r?.risk_level_id}>
                    {r?.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>เลือกกลุ่ม (ระบบ MOA)</div>
              <select style={selectStyles} value={moaSystem} onChange={(e) => setMoaSystem(e.target.value)}>
                {MOA_SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button style={btnOutline} onClick={openAddModal} disabled={!riskLevelId}>
              + เพิ่มกลุ่มในแผน
            </button>
            <button style={btnSolid} onClick={onSave} disabled={!riskLevelId || saving}>
              {saving ? "กำลังบันทึก..." : "บันทึกแผน"}
            </button>
          </div>
        </div>

        <div style={cardStyles}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>แผนการหมุนเวียน</div>

          {loading ? (
            <div style={{ color: "#666", fontWeight: 700 }}>กำลังโหลด...</div>
          ) : planVisible.length === 0 ? (
            <div style={{ color: "#666", fontWeight: 800 }}>{emptyPlanText}</div>
          ) : (
            <table style={tableStyles}>
              <thead>
                <tr>
                  <th style={thStyles}>ลำดับ</th>
                  <th style={thStyles}>MOA</th>
                  <th style={thStyles}>ชื่อกลุ่ม</th>
                  <th style={thStyles}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {planVisible.map((r, idx) => {
                  const g = moaGroupById.get(Number(r?.moa_group_id));
                  const moaCode = r?.moa_code || g?.moa_code || "-";
                  const groupName = r?.moa_group_name || g?.moa_group_name || g?.group_name || "-";
                  const orderNo = idx + 1;

                  return (
                    <tr key={`${r?.plan_id || "new"}-${r?.moa_group_id}`}>
                      <td style={tdStyles}>{orderNo}</td>
                      <td style={tdStyles}>{moaCode}</td>
                      <td style={tdStyles}>{groupName}</td>
                      <td style={tdStyles}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={iconBtn} onClick={() => moveRow(idx, -1)} disabled={idx === 0}>
                            ↑
                          </button>
                          <button
                            style={iconBtn}
                            onClick={() => moveRow(idx, +1)}
                            disabled={idx === planVisible.length - 1}
                          >
                            ↓
                          </button>
                          <button style={dangerBtn} onClick={() => removeRow(r)}>
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 12, color: "#666", fontWeight: 700 }}>
            กฎตัวอย่าง: “ใช้ผลิตภัณฑ์ในกลุ่ม 1A ให้ครบ 2 รอบ แล้วค่อยสลับ” = ตั้งค่า max_sprays_per_group = 2
            และให้แผนเป็น 1A → 2A
          </div>
        </div>

        {/* Add Modal */}
        {isAddOpen ? (
          <div style={modalOverlay} onMouseDown={() => setIsAddOpen(false)}>
            <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
              <div style={modalHeader}>เพิ่มกลุ่มในแผน</div>

              <div style={modalBody}>
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>เลือกกลุ่ม MOA ({String(moaSystem).toUpperCase()})</div>
                  <select
                    style={selectStyles}
                    value={addMoaGroupId}
                    onChange={(e) => setAddMoaGroupId(e.target.value)}
                  >
                    <option value="">-- เลือก --</option>
                    {moaGroupsFiltered.map((g) => (
                      <option key={g?.moa_group_id} value={g?.moa_group_id}>
                        {g?.moa_code} - {g?.moa_group_name || g?.group_name || ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>ลำดับ (priority)</div>
                  <input
                    style={{ ...selectStyles }}
                    type="number"
                    min={1}
                    value={addPriority}
                    onChange={(e) => setAddPriority(e.target.value)}
                    placeholder="เช่น 1"
                  />
                </div>
              </div>

              <div style={modalFooter}>
                <button style={btnOutline} onClick={() => setIsAddOpen(false)}>
                  ยกเลิก
                </button>
                <button style={btnSolid} onClick={addGroupToPlan}>
                  เพิ่ม
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </RequireAdmin>
  );
}
