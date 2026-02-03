// src/pages/AdminRiskLevelRulesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import { apiFetch } from "../api/_baseApi";
import {
  readDiseaseRiskLevels,
  updateDiseaseRiskLevelRule,
  deleteDiseaseRiskLevel,
} from "../api/diseaseRiskLevelsApi";

function unwrapOkPayload(res) {
  if (Array.isArray(res)) return res;
  if (res && typeof res === "object") {
    if ("data" in res) return res.data;
    if ("rows" in res) return res.rows;
    if ("items" in res) return res.items;
  }
  return res;
}

function compactThai(s) {
  return String(s || "").replace(/\s+/g, "").trim();
}

function isOrchardQuestionGroupName(name) {
  // กันหลายรูปแบบไว้
  const n = compactThai(name);
  return n.includes(compactThai("คำถามจัดการสวน")) || n.includes(compactThai("จัดการสวน"));
}

function pickDiseaseName(d) {
  return (
    d?.disease_th ||
    d?.name_th ||
    d?.disease_en ||
    d?.name_en ||
    d?.disease_name ||
    d?.disease_slug ||
    d?.slug ||
    d?.name ||
    "-"
  );
}

export default function AdminRiskLevelRulesPage() {
  const navigate = useNavigate();
  const ctx = useAuth();
  const user = ctx?.user ?? ctx?.auth?.user;
  const doLogout = ctx?.logout ?? ctx?.auth?.logout;

  const [rows, setRows] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState(""); // "" = ทุกโรค

  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  // UI แบบหน้า Questions
  const [keyword, setKeyword] = useState("");

  // edit mode
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    sprays_per_product: "",
    max_products_per_group: "",
    max_sprays_per_group: "",
  });

  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function loadDiseases() {
    // NOTE: ใช้ apiFetch ตรง ๆ เพื่อไม่ผูกกับไฟล์ readDiseasesApi.js
    const res = await apiFetch("/diseases/read_diseases.php");
    const list = unwrapOkPayload(res);
    return Array.isArray(list) ? list : [];
  }

  async function loadData() {
    try {
      setLoading(true);
      setErrorText("");

      const [ds, rls] = await Promise.all([loadDiseases(), readDiseaseRiskLevels()]);

      setDiseases(ds);
      setRows(Array.isArray(rls) ? rls : []);
    } catch (e) {
      setErrorText(e?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    try {
      doLogout?.();
    } finally {
      navigate("/");
    }
  }

  function getLevelName(r) {
    return r.risk_level_name || r.level_name || r.level_name_th || r.name || "-";
  }

  const diseaseNameById = useMemo(() => {
    const m = new Map();
    (Array.isArray(diseases) ? diseases : []).forEach((d) => {
      const id = String(d?.disease_id ?? d?.id ?? "");
      if (!id) return;
      m.set(id, pickDiseaseName(d));
    });
    return m;
  }, [diseases]);

  function getDiseaseNameFromRow(r) {
    // เผื่อ API บางตัวส่งชื่อโรคมาด้วย
    const direct =
      r?.disease_th || r?.disease_name || r?.name_th || r?.disease_en || r?.name_en || "";
    if (direct) return String(direct);

    const did = String(r?.disease_id ?? r?.diseaseId ?? "");
    if (!did) return "-";
    return diseaseNameById.get(did) || did;
  }

  const visibleDiseaseOptions = useMemo(() => {
    const list = Array.isArray(diseases) ? diseases : [];
    return list
      .filter((d) => !isOrchardQuestionGroupName(pickDiseaseName(d))) // ✅ ไม่โชว์ “คำถามจัดการสวน”
      .sort((a, b) => Number(a?.disease_id ?? 0) - Number(b?.disease_id ?? 0));
  }, [diseases]);

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const did = String(selectedDiseaseId || "").trim();

    const base = (Array.isArray(rows) ? rows : [])
      // ✅ ไม่โชว์ “คำถามจัดการสวน” ในตารางด้วย (กันกรณีมี risk level ผูกไว้)
      .filter((r) => {
        const diseaseName = getDiseaseNameFromRow(r);
        const diseaseIdStr = String(r?.disease_id ?? r?.diseaseId ?? "");
        if (diseaseIdStr === "0") return false; // กันไว้ เผื่อเคยใช้ 0 เป็นกลุ่มคำถามจัดการสวน
        if (isOrchardQuestionGroupName(diseaseName)) return false;
        return true;
      })
      .filter((r) => {
        if (!did) return true;
        return String(r?.disease_id ?? r?.diseaseId ?? "") === did;
      })
      .filter((r) => {
        if (!kw) return true;
        const idStr = String(r?.risk_level_id ?? "");
        const levelStr = String(getLevelName(r) ?? "").toLowerCase();
        const diseaseStr = String(getDiseaseNameFromRow(r) ?? "").toLowerCase();
        return idStr.includes(kw) || levelStr.includes(kw) || diseaseStr.includes(kw);
      })
      // ✅ เรียง ID จากน้อยไปมาก
      .sort((a, b) => Number(a?.risk_level_id ?? 0) - Number(b?.risk_level_id ?? 0));

    return base;
  }, [rows, keyword, selectedDiseaseId, diseases]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(r) {
    setErrorText("");
    setEditingId(r.risk_level_id);
    setDraft({
      sprays_per_product: r.sprays_per_product ?? "",
      max_products_per_group: r.max_products_per_group ?? "",
      max_sprays_per_group: r.max_sprays_per_group ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({
      sprays_per_product: "",
      max_products_per_group: "",
      max_sprays_per_group: "",
    });
  }

  async function onSave(r) {
    try {
      setSavingId(r.risk_level_id);
      setErrorText("");

      await updateDiseaseRiskLevelRule(r.risk_level_id, {
        sprays_per_product: Number(draft.sprays_per_product ?? 0),
        max_products_per_group: Number(draft.max_products_per_group ?? 0),
        max_sprays_per_group: Number(draft.max_sprays_per_group ?? 0),
      });

      // อัปเดตแถวใน state แบบทันที
      setRows((prev) =>
        prev.map((x) =>
          x.risk_level_id === r.risk_level_id
            ? {
                ...x,
                sprays_per_product: Number(draft.sprays_per_product ?? 0),
                max_products_per_group: Number(draft.max_products_per_group ?? 0),
                max_sprays_per_group: Number(draft.max_sprays_per_group ?? 0),
              }
            : x
        )
      );

      cancelEdit();
    } catch (e) {
      setErrorText(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSavingId(null);
    }
  }

  async function onDelete(r) {
    const id = r.risk_level_id;
    const name = getLevelName(r);

    if (!window.confirm(`ยืนยันลบระดับนี้?\nID: ${id}\nชื่อระดับ: ${name}`)) return;

    try {
      setDeletingId(id);
      setErrorText("");

      await deleteDiseaseRiskLevel(id);

      setRows((prev) => prev.filter((x) => x.risk_level_id !== id));
      if (editingId === id) cancelEdit();
    } catch (e) {
      setErrorText(e?.message || "ลบไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  const centerCell = { textAlign: "center", verticalAlign: "middle" };

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn ghost" onClick={() => navigate("/admin")}>
            ← กลับหน้าหลัก
          </button>
          <h1 style={{ margin: 0 }}>ตั้งค่าพารามิเตอร์กฎต่อ Risk Level</h1>
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

      {/* แถบค้นหา (ให้เหมือนหน้า Questions) */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        <select
          value={selectedDiseaseId}
          onChange={(e) => setSelectedDiseaseId(e.target.value)}
          style={{ minWidth: 240 }}
        >
          <option value="">-- ทุกโรค --</option>
          {visibleDiseaseOptions.map((d) => {
            const id = String(d?.disease_id ?? d?.id ?? "");
            const label = pickDiseaseName(d);
            return (
              <option key={id || label} value={id}>
                {label}
              </option>
            );
          })}
        </select>

        <input
          placeholder="ค้นหา (ID / ชื่อระดับ / ชื่อโรค)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1, minWidth: 240 }}
        />

        <button
          className="btn ghost"
          onClick={() => {
            setKeyword("");
            setSelectedDiseaseId("");
          }}
        >
          รีเซ็ต
        </button>

        <button className="btn ghost" onClick={loadData} disabled={loading}>
          รีเฟรช
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 12 }}>กำลังโหลด...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 90, ...centerCell }}>ID</th>
                  <th style={{ width: 160, ...centerCell }}>ชื่อโรค</th>
                  <th>ชื่อระดับ</th>
                  <th style={{ width: 170, ...centerCell }}>sprays_per_product</th>
                  <th style={{ width: 210, ...centerCell }}>max_products_per_group</th>
                  <th style={{ width: 210, ...centerCell }}>max_sprays_per_group</th>
                  <th style={{ width: 180, ...centerCell }}>จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center" }}>
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => {
                    const isEditing = editingId === r.risk_level_id;
                    const diseaseName = getDiseaseNameFromRow(r);

                    return (
                      <tr key={r.risk_level_id}>
                        <td style={centerCell}>{r.risk_level_id}</td>
                        <td style={centerCell}>{diseaseName}</td>
                        <td style={{ whiteSpace: "pre-wrap" }}>{getLevelName(r)}</td>

                        <td style={centerCell}>
                          {isEditing ? (
                            <input
                              value={draft.sprays_per_product}
                              onChange={(e) =>
                                setDraft((p) => ({ ...p, sprays_per_product: e.target.value }))
                              }
                              style={{ width: "100%" }}
                            />
                          ) : (
                            r.sprays_per_product ?? "-"
                          )}
                        </td>

                        <td style={centerCell}>
                          {isEditing ? (
                            <input
                              value={draft.max_products_per_group}
                              onChange={(e) =>
                                setDraft((p) => ({ ...p, max_products_per_group: e.target.value }))
                              }
                              style={{ width: "100%" }}
                            />
                          ) : (
                            r.max_products_per_group ?? "-"
                          )}
                        </td>

                        <td style={centerCell}>
                          {isEditing ? (
                            <input
                              value={draft.max_sprays_per_group}
                              onChange={(e) =>
                                setDraft((p) => ({ ...p, max_sprays_per_group: e.target.value }))
                              }
                              style={{ width: "100%" }}
                            />
                          ) : (
                            r.max_sprays_per_group ?? "-"
                          )}
                        </td>

                        <td style={centerCell}>
                          {isEditing ? (
                            <>
                              <button
                                className="btn xs"
                                onClick={() => onSave(r)}
                                disabled={savingId === r.risk_level_id}
                              >
                                {savingId === r.risk_level_id ? "กำลังบันทึก..." : "บันทึก"}
                              </button>{" "}
                              <button className="btn xs ghost" onClick={cancelEdit}>
                                ยกเลิก
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="btn xs" onClick={() => startEdit(r)}>
                                แก้ไข
                              </button>{" "}
                              <button
                                className="btn xs danger"
                                onClick={() => onDelete(r)}
                                disabled={deletingId === r.risk_level_id}
                              >
                                {deletingId === r.risk_level_id ? "กำลังลบ..." : "ลบ"}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="muted" style={{ marginTop: 8 }}>
              สูตร: “ใช้กลุ่ม 1A ให้ครบ 2 รอบ แล้วสลับ” → ตั้ง <b>max_sprays_per_group = 2</b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
