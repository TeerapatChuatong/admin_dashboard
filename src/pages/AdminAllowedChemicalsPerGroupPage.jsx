// src/pages/AdminAllowedChemicalsPerGroupPage.jsx
import React, { useEffect, useMemo, useState } from "react";

import { readDiseaseRiskLevels } from "../api/diseaseRiskLevelsApi";
import { readRiskLevelMoaPlan } from "../api/riskLevelMoaPlanApi";
import {
  readRiskLevelMoaChemicals,
  readChemicalsMini,
  createRiskLevelMoaChemical,
  updateRiskLevelMoaChemical,
  deleteRiskLevelMoaChemical,
} from "../api/riskLevelMoaChemicalsApi";
import { apiFetch } from "../api/_baseApi";

// --- helpers ---
function unwrapList(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (typeof res === "object" && res !== null) {
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.rows)) return res.rows;
  }
  return [];
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function diseaseNameFromRow(d) {
  return (
    d?.disease_name_th ||
    d?.disease_th ||        // ✅ ของจริงจาก read_diseases.php
    d?.disease_name_en ||
    d?.disease_en ||
    d?.name ||
    ""
  );
}

function chemicalNameFromRow(c) {
  return (
    c?.trade_name ||
    c?.chemical_name ||
    c?.name_th ||
    c?.name ||
    c?.active_ingredient ||
    c?.activeIngredient ||
    null
  );
}

export default function AdminAllowedChemicalsPerGroupPage() {
  // lookup
  const [diseaseMap, setDiseaseMap] = useState({});
  const [riskLevels, setRiskLevels] = useState([]);
  const [plan, setPlan] = useState([]);
  const [chemicals, setChemicals] = useState([]);
  const [allowed, setAllowed] = useState([]);

  // ui state
  const [riskLevelId, setRiskLevelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // modals
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [addForm, setAddForm] = useState({
    moaGroupId: "",
    chemicalId: "",
    priority: 1,
  });

  const [editForm, setEditForm] = useState({
    id: "",
    moaGroupId: "",
    chemicalId: "",
    priority: 1,
  });

  // -----------------------------
  // initial load (diseases + risk levels + chemicals)
  // -----------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadInit() {
      setError("");
      setLoading(true);
      try {
        // diseases (for showing disease name)
        const dRes = await apiFetch("/diseases/read_diseases.php");
        const dList = unwrapList(dRes);
        const map = {};
        for (const d of dList) {
          const id = toInt(d?.disease_id ?? d?.id ?? d?.diseaseId, 0);
          if (!id) continue;
          map[id] = diseaseNameFromRow(d) || `โรค #${id}`;
        }
        if (!cancelled) setDiseaseMap(map);

        // risk levels
        const rlRes = await readDiseaseRiskLevels();
        const rlList = unwrapList(rlRes);
        if (!cancelled) setRiskLevels(rlList);

        // chemicals
        const cRes = await readChemicalsMini();
        const cList = unwrapList(cRes);
        if (!cancelled) setChemicals(cList);
      } catch (e) {
        if (!cancelled) setError(e?.message || "โหลดข้อมูลเริ่มต้นไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInit();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------
  // load plan + allowed when riskLevelId changed
  // -----------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadByRiskLevel(id) {
      setError("");
      setLoading(true);
      try {
        const [planRes, allowedRes] = await Promise.all([
          readRiskLevelMoaPlan(id),
          readRiskLevelMoaChemicals(id),
        ]);

        const planList = unwrapList(planRes);
        const allowedList = unwrapList(allowedRes);

        // normalize allowed
        const normAllowed = allowedList.map((r) => ({
          id: toInt(r?.id ?? r?.risk_level_moa_chemical_id ?? r?.mapping_id, 0),
          riskLevelId: toInt(r?.risk_level_id ?? r?.riskLevelId, 0),
          moaGroupId: toInt(r?.moa_group_id ?? r?.moaGroupId, 0),
          moaCode: r?.moa_code ?? r?.moaCode ?? "",
          chemicalId: toInt(r?.chemical_id ?? r?.chemicalId, 0),
          tradeName: r?.trade_name ?? r?.tradeName ?? "",
          activeIngredient: r?.active_ingredient ?? r?.activeIngredient ?? "",
          targetType: r?.target_type ?? r?.targetType ?? "",
          priority: toInt(r?.priority ?? 1, 1),
        }));

        if (!cancelled) {
          setPlan(planList);
          setAllowed(normAllowed);
        }
      } catch (e) {
        if (!cancelled) {
          setPlan([]);
          setAllowed([]);
          setError(e?.message || "โหลดข้อมูลตามระดับความรุนแรงไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!riskLevelId) {
      setPlan([]);
      setAllowed([]);
      return;
    }

    loadByRiskLevel(riskLevelId);
    return () => {
      cancelled = true;
    };
  }, [riskLevelId]);

  // -----------------------------
  // computed
  // -----------------------------
  const selectedRiskLevel = useMemo(() => {
    const id = toInt(riskLevelId, 0);
    if (!id) return null;
    return riskLevels.find(
      (r) => toInt(r?.risk_level_id ?? r?.riskLevelId, 0) === id
    );
  }, [riskLevelId, riskLevels]);

  const selectedDiseaseName = useMemo(() => {
    if (!selectedRiskLevel) return "";
    const dId = toInt(selectedRiskLevel?.disease_id ?? selectedRiskLevel?.diseaseId, 0);
    return diseaseMap[dId] || (dId ? `โรค #${dId}` : "");
  }, [selectedRiskLevel, diseaseMap]);

  const selectedLevelName = useMemo(() => {
    if (!selectedRiskLevel) return "";
    return (
      selectedRiskLevel?.level_name_th ||
      selectedRiskLevel?.risk_level_name ||
      selectedRiskLevel?.risk_level_name_th ||
      selectedRiskLevel?.riskLevelName ||
      selectedRiskLevel?.levelName ||
      ""
    );
  }, [selectedRiskLevel]);

  const riskLevelOptions = useMemo(() => {
    return riskLevels.map((r) => {
      const id = toInt(r?.risk_level_id ?? r?.riskLevelId, 0);
      const dId = toInt(r?.disease_id ?? r?.diseaseId, 0);
      const dName = diseaseMap[dId] || (dId ? `โรค #${dId}` : "โรค");
      const lvName =
        r?.level_name_th ||
        r?.risk_level_name ||
        r?.risk_level_name_th ||
        r?.riskLevelName ||
        r?.levelName ||
        "";
      return {
        id,
        label: `${dName} - ${lvName || "ระดับ"}`,
      };
    });
  }, [riskLevels, diseaseMap]);

  const planSorted = useMemo(() => {
    const list = [...(plan || [])];
    list.sort((a, b) => {
      const pa = toInt(a?.group_priority ?? a?.priority ?? 9999, 9999);
      const pb = toInt(b?.group_priority ?? b?.priority ?? 9999, 9999);
      if (pa !== pb) return pa - pb;
      return String(a?.moa_code ?? a?.moaCode ?? "").localeCompare(
        String(b?.moa_code ?? b?.moaCode ?? "")
      );
    });
    return list;
  }, [plan]);

  const allowedByGroup = useMemo(() => {
    const map = {};
    for (const r of allowed) {
      const g = r.moaGroupId;
      if (!g) continue;
      if (!map[g]) map[g] = [];
      map[g].push(r);
    }
    for (const gId of Object.keys(map)) {
      map[gId].sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));
    }
    return map;
  }, [allowed]);

  // chemicals shown in dropdown (optionally filter by selected group)
  const chemicalsForSelect = useMemo(() => {
    const gId = toInt(showEdit ? editForm.moaGroupId : addForm.moaGroupId, 0);
    if (!gId) return chemicals;
    // If chemical row has moa_group_id, filter; otherwise, return all
    const hasGroup = chemicals.some((c) =>
      Number.isFinite(Number(c?.moa_group_id ?? c?.moaGroupId))
    );
    if (!hasGroup) return chemicals;
    return chemicals.filter(
      (c) => toInt(c?.moa_group_id ?? c?.moaGroupId, 0) === gId
    );
  }, [chemicals, addForm.moaGroupId, editForm.moaGroupId, showEdit]);

  // -----------------------------
  // actions
  // -----------------------------
  const refresh = async () => {
    if (!riskLevelId) return;
    setLoading(true);
    setError("");
    try {
      const allowedRes = await readRiskLevelMoaChemicals(riskLevelId);
      const allowedList = unwrapList(allowedRes);
      const normAllowed = allowedList.map((r) => ({
        id: toInt(r?.id ?? r?.risk_level_moa_chemical_id ?? r?.mapping_id, 0),
        riskLevelId: toInt(r?.risk_level_id ?? r?.riskLevelId, 0),
        moaGroupId: toInt(r?.moa_group_id ?? r?.moaGroupId, 0),
        moaCode: r?.moa_code ?? r?.moaCode ?? "",
        chemicalId: toInt(r?.chemical_id ?? r?.chemicalId, 0),
        tradeName: r?.trade_name ?? r?.tradeName ?? "",
        activeIngredient: r?.active_ingredient ?? r?.activeIngredient ?? "",
        targetType: r?.target_type ?? r?.targetType ?? "",
        priority: toInt(r?.priority ?? 1, 1),
      }));
      setAllowed(normAllowed);
    } catch (e) {
      setError(e?.message || "รีเฟรชไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setError("");
    setAddForm({ moaGroupId: "", chemicalId: "", priority: 1 });
    setShowAdd(true);
  };

  const openEdit = (row) => {
    setError("");
    setEditForm({
      id: String(row?.id ?? ""),
      moaGroupId: String(row?.moaGroupId ?? ""),
      chemicalId: String(row?.chemicalId ?? ""),
      priority: toInt(row?.priority ?? 1, 1),
    });
    setShowEdit(true);
  };

  const validateDuplicate = ({ id, moaGroupId, chemicalId }) => {
    const rid = toInt(riskLevelId, 0);
    const gid = toInt(moaGroupId, 0);
    const cid = toInt(chemicalId, 0);
    if (!rid || !gid || !cid) return null;

    const same = allowed.find(
      (r) =>
        r.riskLevelId === rid &&
        r.moaGroupId === gid &&
        r.chemicalId === cid &&
        String(r.id) !== String(id || "")
    );
    if (same) return "รายการนี้มีอยู่แล้วในกลุ่มนี้";
    return null;
  };

  const onCreate = async () => {
    setError("");
    if (!riskLevelId) {
      setError("กรุณาเลือกโรค + ระดับความรุนแรง");
      return;
    }

    const dup = validateDuplicate({
      id: "",
      moaGroupId: addForm.moaGroupId,
      chemicalId: addForm.chemicalId,
    });
    if (dup) {
      setError(dup);
      return;
    }

    const payload = {
      risk_level_id: toInt(riskLevelId, 0),
      moa_group_id: toInt(addForm.moaGroupId, 0),
      chemical_id: toInt(addForm.chemicalId, 0),
      priority: toInt(addForm.priority, 1),
    };

    if (!payload.moa_group_id || !payload.chemical_id) {
      setError("กรุณาเลือก MOA Group และ สาร");
      return;
    }

    setLoading(true);
    try {
      await createRiskLevelMoaChemical(payload);
      setShowAdd(false);
      await refresh();
    } catch (e) {
      setError(e?.message || "เพิ่มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const onUpdate = async () => {
    setError("");
    if (!riskLevelId) {
      setError("กรุณาเลือกโรค + ระดับความรุนแรง");
      return;
    }
    if (!editForm.id) {
      setError("ไม่พบ ID รายการที่ต้องแก้ไข");
      return;
    }

    const dup = validateDuplicate({
      id: editForm.id,
      moaGroupId: editForm.moaGroupId,
      chemicalId: editForm.chemicalId,
    });
    if (dup) {
      setError(dup);
      return;
    }

    const payload = {
      id: toInt(editForm.id, 0),
      risk_level_id: toInt(riskLevelId, 0),
      moa_group_id: toInt(editForm.moaGroupId, 0),
      chemical_id: toInt(editForm.chemicalId, 0),
      priority: toInt(editForm.priority, 1),
    };

    if (!payload.id || !payload.moa_group_id || !payload.chemical_id) {
      setError("ข้อมูลไม่ครบ (id/moa_group_id/chemical_id)");
      return;
    }

    setLoading(true);
    try {
      await updateRiskLevelMoaChemical(payload);
      setShowEdit(false);
      await refresh();
    } catch (e) {
      setError(e?.message || "บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (row) => {
    setError("");
    const id = toInt(row?.id, 0);
    if (!id) {
      setError("ไม่พบ ID รายการที่ต้องลบ");
      return;
    }
    const ok = window.confirm("ต้องการลบรายการนี้หรือไม่?");
    if (!ok) return;

    setLoading(true);
    try {
      await deleteRiskLevelMoaChemical(id);
      setAllowed((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e?.message || "ลบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // styles
  // -----------------------------
  const pageStyle = {
    padding: 24,
    background: "#f5f6f8",
    minHeight: "100vh",
  };

  const topRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  };

  const titleStyle = {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
  };

  const cardStyle = {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
    marginBottom: 16,
  };

  const pillBtn = {
    border: "1px solid #ff8a00",
    color: "#ff8a00",
    background: "#fff",
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 700,
    cursor: "pointer",
  };

  const primaryBtn = {
    ...pillBtn,
    background: "#ff8a00",
    color: "#fff",
  };

  const dangerBtn = {
    border: "1px solid #e11d48",
    color: "#fff",
    background: "#e11d48",
    borderRadius: 999,
    padding: "6px 12px",
    fontWeight: 700,
    cursor: "pointer",
  };

  const editBtn = {
    border: "1px solid #ff8a00",
    color: "#fff",
    background: "#ff8a00",
    borderRadius: 999,
    padding: "6px 12px",
    fontWeight: 700,
    cursor: "pointer",
    marginRight: 8,
  };

  const muted = { color: "#6b7280" };

  const tableStyle = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
  };

  const thStyle = {
    textAlign: "left",
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 800,
    padding: "10px 12px",
    borderBottom: "1px solid #eef0f3",
  };

  const tdStyle = {
    padding: "12px",
    borderBottom: "1px solid #f1f2f4",
    verticalAlign: "top",
  };

  const innerTableStyle = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
  };

  const innerThStyle = {
    ...thStyle,
    borderBottom: "1px solid #eef0f3",
    padding: "8px 10px",
    fontSize: 12,
  };

  const innerTdStyle = {
    ...tdStyle,
    borderBottom: "1px solid #f3f4f6",
    padding: "8px 10px",
  };

  // -----------------------------
  // render
  // -----------------------------
  return (
    <div style={pageStyle}>
      <div style={topRowStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            style={pillBtn}
            onClick={() => window.history.back()}
            type="button"
          >
            ← กลับหน้าหลัก
          </button>
          <h1 style={titleStyle}>จัดการสารที่อนุญาตต่อกลุ่ม</h1>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={pillBtn}
            type="button"
            onClick={() => {
              setRiskLevelId("");
              setPlan([]);
              setAllowed([]);
              setError("");
            }}
          >
            รีเซ็ต
          </button>
          <button
            style={pillBtn}
            type="button"
            onClick={refresh}
            disabled={!riskLevelId || loading}
            title={!riskLevelId ? "กรุณาเลือกโรค + ระดับความรุนแรง" : ""}
          >
            รีเฟรช
          </button>
          <button
            style={primaryBtn}
            type="button"
            onClick={openAdd}
            disabled={!riskLevelId || loading}
            title={!riskLevelId ? "กรุณาเลือกโรค + ระดับความรุนแรง" : ""}
          >
            + เพิ่มสารให้กลุ่ม
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            ...cardStyle,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={riskLevelId}
            onChange={(e) => setRiskLevelId(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 14,
            }}
          >
            <option value="">-- เลือกโรค + ระดับความรุนแรง --</option>
            {riskLevelOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {riskLevelId ? (
          <div style={{ marginTop: 10, fontWeight: 800 }}>
            โรค: {selectedDiseaseName || "-"} | ระดับ: {selectedLevelName || "-"} | Risk Level ID: {riskLevelId}
          </div>
        ) : null}

        {loading ? <div style={{ marginTop: 10, ...muted }}>กำลังโหลด...</div> : null}
      </div>

      {riskLevelId ? (
        <div style={cardStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 220 }}>MOA Group</th>
                <th style={thStyle}>สารที่อนุญาต (เรียงตาม priority)</th>
              </tr>
            </thead>
            <tbody>
              {planSorted.map((g) => {
                const gid = toInt(g?.moa_group_id ?? g?.moaGroupId, 0);
                const list = allowedByGroup[gid] || [];
                const moaCode = g?.moa_code ?? g?.moaCode ?? "";
                const groupName = g?.group_name ?? g?.groupName ?? "";

                return (
                  <tr key={gid || moaCode}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 900 }}>{moaCode || "-"}</div>
                      <div style={{ ...muted, marginTop: 2 }}>{groupName || ""}</div>
                    </td>
                    <td style={{ ...tdStyle, padding: 0 }}>
                      {list.length === 0 ? (
                        <div style={{ padding: 12, ...muted }}>— ยังไม่ได้เพิ่มสาร —</div>
                      ) : (
                        <table style={innerTableStyle}>
                          <thead>
                            <tr>
                              <th style={{ ...innerThStyle, width: 90 }}>priority</th>
                              <th style={innerThStyle}>สาร</th>
                              <th style={{ ...innerThStyle, width: 190 }}>จัดการ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((r) => {
                              const chemLabel = r.tradeName || chemicalNameFromRow(
                                chemicals.find(
                                  (c) =>
                                    toInt(c?.chemical_id ?? c?.id ?? c?.chemicalId, 0) ===
                                    toInt(r.chemicalId, 0)
                                )
                              ) || `สาร #${r.chemicalId}`;

                              return (
                                <tr key={r.id}>
                                  <td style={innerTdStyle}>{r.priority ?? "-"}</td>
                                  <td style={innerTdStyle}>
                                    <div style={{ fontWeight: 800 }}>{chemLabel}</div>
                                    {r.activeIngredient ? (
                                      <div style={{ ...muted, marginTop: 2, fontSize: 12 }}>
                                        {r.activeIngredient}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td style={innerTdStyle}>
                                    <button
                                      type="button"
                                      style={editBtn}
                                      onClick={() => openEdit(r)}
                                    >
                                      แก้ไข
                                    </button>
                                    <button
                                      type="button"
                                      style={dangerBtn}
                                      onClick={() => onDelete(r)}
                                    >
                                      ลบ
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 10, ...muted, fontWeight: 700 }}>
            แนะนำ: ใส่สารอย่างน้อย 1 ตัวต่อ 1 กลุ่มในแผน เพื่อให้หน้า Rotation Summary แนะนำ “สารถัดไป” ได้
          </div>
        </div>
      ) : null}

      {/* ADD MODAL */}
      {showAdd ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => (!loading ? setShowAdd(false) : null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 24,
              width: "min(980px, 96vw)",
              maxHeight: "88vh",
              overflow: "auto",
              padding: 18,
              boxShadow: "0 18px 40px rgba(0,0,0,0.20)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, marginBottom: 12, fontSize: 26, fontWeight: 900 }}>
              เพิ่มสารให้กลุ่ม
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>MOA Group</div>
                <select
                  value={addForm.moaGroupId}
                  onChange={(e) =>
                    setAddForm((s) => ({ ...s, moaGroupId: e.target.value, chemicalId: "" }))
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <option value="">-- เลือก MOA Group --</option>
                  {planSorted.map((g) => {
                    const gid = toInt(g?.moa_group_id ?? g?.moaGroupId, 0);
                    const label = `${g?.moa_code ?? g?.moaCode ?? ""} ${g?.group_name ?? g?.groupName ?? ""}`.trim();
                    return (
                      <option key={gid} value={gid}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>สาร</div>
                <select
                  value={addForm.chemicalId}
                  onChange={(e) => setAddForm((s) => ({ ...s, chemicalId: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <option value="">-- เลือกสาร --</option>
                  {chemicalsForSelect.map((c) => {
                    const cid = toInt(c?.chemical_id ?? c?.id ?? c?.chemicalId, 0);
                    const name = chemicalNameFromRow(c) || `สาร #${cid}`;
                    const moa = c?.moa_code ?? c?.moaCode ?? "";
                    return (
                      <option key={cid} value={cid}>
                        {moa ? `[${moa}] ` : ""}{name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>priority</div>
                <input
                  type="number"
                  min={1}
                  value={addForm.priority}
                  onChange={(e) =>
                    setAddForm((s) => ({ ...s, priority: toInt(e.target.value, 1) }))
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button style={pillBtn} type="button" onClick={() => setShowAdd(false)} disabled={loading}>
                ยกเลิก
              </button>
              <button style={primaryBtn} type="button" onClick={onCreate} disabled={loading}>
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* EDIT MODAL */}
      {showEdit ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => (!loading ? setShowEdit(false) : null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 24,
              width: "min(980px, 96vw)",
              maxHeight: "88vh",
              overflow: "auto",
              padding: 18,
              boxShadow: "0 18px 40px rgba(0,0,0,0.20)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, marginBottom: 12, fontSize: 26, fontWeight: 900 }}>
              แก้ไขรายการ
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>MOA Group</div>
                <select
                  value={editForm.moaGroupId}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, moaGroupId: e.target.value, chemicalId: "" }))
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <option value="">-- เลือก MOA Group --</option>
                  {planSorted.map((g) => {
                    const gid = toInt(g?.moa_group_id ?? g?.moaGroupId, 0);
                    const label = `${g?.moa_code ?? g?.moaCode ?? ""} ${g?.group_name ?? g?.groupName ?? ""}`.trim();
                    return (
                      <option key={gid} value={gid}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>สาร</div>
                <select
                  value={editForm.chemicalId}
                  onChange={(e) => setEditForm((s) => ({ ...s, chemicalId: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <option value="">-- เลือกสาร --</option>
                  {chemicalsForSelect.map((c) => {
                    const cid = toInt(c?.chemical_id ?? c?.id ?? c?.chemicalId, 0);
                    const name = chemicalNameFromRow(c) || `สาร #${cid}`;
                    const moa = c?.moa_code ?? c?.moaCode ?? "";
                    return (
                      <option key={cid} value={cid}>
                        {moa ? `[${moa}] ` : ""}{name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>priority</div>
                <input
                  type="number"
                  min={1}
                  value={editForm.priority}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, priority: toInt(e.target.value, 1) }))
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button style={pillBtn} type="button" onClick={() => setShowEdit(false)} disabled={loading}>
                ยกเลิก
              </button>
              <button style={primaryBtn} type="button" onClick={onUpdate} disabled={loading}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
