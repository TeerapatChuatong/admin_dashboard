// src/pages/AdminTreatmentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "http://localhost/crud/api";

// ---------- fetch helper ----------
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return json.data;
}

// ---------- UI helpers ----------
function levelLabel(code) {
  if (code === "low") return "ต่ำ";
  if (code === "medium") return "ปานกลาง";
  if (code === "high") return "มาก";
  return code || "-";
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={onClose}
    >
      <div
        className="card"
        style={{
          width: "min(980px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          borderRadius: 18,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost" onClick={onClose}>
            ปิด
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

// ---------- Form Modal (CREATE/EDIT) ----------
function TreatmentFormModal({
  open,
  title,
  onClose,
  onSaved,
  diseases,
  initial,
  existingItems,
}) {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);

  // ✅ แสดง error หลังจากกดบันทึกเท่านั้น
  const [showErrors, setShowErrors] = useState(false);

  const [form, setForm] = useState({
    disease_id: "",
    level_code: "low",
    min_score: "",
    days: "",
    times: "",
    advice_text: "",
  });

  useEffect(() => {
    if (!open) return;

    // ✅ reset ทุกครั้งที่เปิด modal
    setShowErrors(false);

    if (initial) {
      setForm({
        disease_id: String(initial.disease_id ?? ""),
        level_code: initial.level_code ?? "low",
        min_score:
          initial.min_score === null || initial.min_score === undefined
            ? ""
            : String(initial.min_score),
        days:
          initial.days === null || initial.days === undefined
            ? ""
            : String(initial.days),
        times:
          initial.times === null || initial.times === undefined
            ? ""
            : String(initial.times),
        advice_text: initial.advice_text ?? "",
      });
    } else {
      setForm({
        disease_id: diseases?.[0]?.disease_id
          ? String(diseases[0].disease_id)
          : "",
        level_code: "low",
        min_score: "",
        days: "",
        times: "",
        advice_text: "",
      });
    }
  }, [open, initial, diseases]);

  // ---------- validation ----------
  const errors = useMemo(() => {
    const e = {};

    if (!String(form.disease_id || "").trim()) e.disease_id = "กรุณาเลือกโรค";
    if (!String(form.level_code || "").trim()) e.level_code = "กรุณาเลือกระดับ";

    if (String(form.min_score).trim() === "")
      e.min_score = "กรุณากรอกคะแนนขั้นต่ำ";
    else if (!Number.isFinite(Number(form.min_score)))
      e.min_score = "คะแนนขั้นต่ำต้องเป็นตัวเลข";
    else if (Number(form.min_score) < 0)
      e.min_score = "คะแนนขั้นต่ำต้องไม่ติดลบ";

    if (String(form.days).trim() === "") e.days = "กรุณากรอกวัน";
    else if (!Number.isFinite(Number(form.days))) e.days = "วันต้องเป็นตัวเลข";
    else if (parseInt(form.days, 10) < 1) e.days = "วันต้องอย่างน้อย 1";

    if (String(form.times).trim() === "") e.times = "กรุณากรอกจำนวนครั้ง";
    else if (!Number.isFinite(Number(form.times)))
      e.times = "จำนวนครั้งต้องเป็นตัวเลข";
    else if (parseInt(form.times, 10) < 1) e.times = "จำนวนครั้งต้องอย่างน้อย 1";

    if (!String(form.advice_text || "").trim())
      e.advice_text = "กรุณากรอกคำแนะนำการรักษา";

    return e;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;

  const errTextStyle = { color: "crimson", fontSize: 12, marginTop: 4 };
  const inputStyle = (field) =>
    showErrors && errors[field]
      ? { borderColor: "crimson", outlineColor: "crimson" }
      : undefined;

  async function submit() {
    // ✅ กดบันทึกแล้วค่อยโชว์ error
    setShowErrors(true);

    if (!isValid) return;

    setSaving(true);
    try {
      // ✅ กันเพิ่มซ้ำ โรค+ระดับ (เฉพาะ create)
      if (!isEdit) {
        const dup = (existingItems || []).some(
          (x) =>
            String(x.disease_id) === String(form.disease_id) &&
            String(x.level_code) === String(form.level_code)
        );
        if (dup) {
          alert("โรค + ระดับนี้มีคำแนะนำอยู่แล้ว (ไม่สามารถเพิ่มซ้ำได้)");
          setSaving(false);
          return;
        }
      }

      const payloadCommon = {
        min_score: parseInt(form.min_score, 10),
        days: parseInt(form.days, 10),
        times: parseInt(form.times, 10),
        advice_text: form.advice_text,
      };

      if (!isEdit) {
        const created = await apiFetch("/treatments/create_treatments.php", {
          method: "POST",
          body: JSON.stringify({
            disease_id: Number(form.disease_id),
            level_code: form.level_code,
            ...payloadCommon,
          }),
        });
        await onSaved?.(created, { mode: "create" });
      } else {
        const updated = await apiFetch("/treatments/update_treatments.php", {
          method: "PATCH",
          body: JSON.stringify({
            treatment_id: Number(initial.treatment_id),
            ...payloadCommon,
          }),
        });
        await onSaved?.(updated, { mode: "update" });
      }
    } catch (e) {
      alert(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={saving ? () => {} : onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>โรค</label>
          <select
            className="input"
            style={inputStyle("disease_id")}
            value={form.disease_id}
            onChange={(e) =>
              setForm((s) => ({ ...s, disease_id: e.target.value }))
            }
            disabled={isEdit}
          >
            <option value="">-- เลือกโรค --</option>
            {diseases.map((d) => (
              <option key={d.disease_id} value={d.disease_id}>
                {d.disease_th || d.disease_en || "ไม่ระบุชื่อโรค"}
              </option>
            ))}
          </select>
          {showErrors && errors.disease_id && (
            <div style={errTextStyle}>{errors.disease_id}</div>
          )}
        </div>

        <div>
          <label>ระดับความรุนแรง</label>
          <select
            className="input"
            style={inputStyle("level_code")}
            value={form.level_code}
            onChange={(e) =>
              setForm((s) => ({ ...s, level_code: e.target.value }))
            }
            disabled={isEdit}
          >
            <option value="low">ต่ำ</option>
            <option value="medium">ปานกลาง</option>
            <option value="high">มาก</option>
          </select>
          {showErrors && errors.level_code && (
            <div style={errTextStyle}>{errors.level_code}</div>
          )}
        </div>

        <div>
          <label>คะแนนขั้นต่ำ *</label>
          <input
            className="input"
            style={inputStyle("min_score")}
            type="number"
            value={form.min_score}
            onChange={(e) =>
              setForm((s) => ({ ...s, min_score: e.target.value }))
            }
          />
          {showErrors && errors.min_score && (
            <div style={errTextStyle}>{errors.min_score}</div>
          )}
        </div>

        <div>
          <label>วัน *</label>
          <input
            className="input"
            style={inputStyle("days")}
            type="number"
            value={form.days}
            onChange={(e) => setForm((s) => ({ ...s, days: e.target.value }))}
            placeholder="เช่น 7"
          />
          {showErrors && errors.days && (
            <div style={errTextStyle}>{errors.days}</div>
          )}
        </div>

        <div>
          <label>จำนวนครั้ง *</label>
          <input
            className="input"
            style={inputStyle("times")}
            type="number"
            value={form.times}
            onChange={(e) => setForm((s) => ({ ...s, times: e.target.value }))}
            placeholder="เช่น 2"
          />
          {showErrors && errors.times && (
            <div style={errTextStyle}>{errors.times}</div>
          )}
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label>คำแนะนำการรักษา *</label>
          <textarea
            className="input"
            style={{
              width: "100%",
              whiteSpace: "pre-wrap",
              ...inputStyle("advice_text"),
            }}
            rows={10}
            value={form.advice_text}
            onChange={(e) =>
              setForm((s) => ({ ...s, advice_text: e.target.value }))
            }
          />
          {showErrors && errors.advice_text && (
            <div style={errTextStyle}>{errors.advice_text}</div>
          )}
        </div>

        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            ยกเลิก
          </button>

          {/* ✅ ให้กดได้เสมอ แต่ถ้าไม่ครบจะขึ้น error หลังจากกด */}
          <button className="btn" onClick={submit} disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Page ----------
export default function AdminTreatmentsPage() {
  const nav = useNavigate();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [diseases, setDiseases] = useState([]);
  const [items, setItems] = useState([]);

  const [fDisease, setFDisease] = useState("");
  const [fLevel, setFLevel] = useState("");
  const [fQ, setFQ] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState(null);

  const diseaseMap = useMemo(() => {
    const m = new Map();
    diseases.forEach((d) => m.set(String(d.disease_id), d));
    return m;
  }, [diseases]);

  async function loadAll() {
    setErr("");
    setLoading(true);
    try {
      const ds = await apiFetch("/diseases/read_diseases.php", { method: "GET" });
      setDiseases(Array.isArray(ds) ? ds : []);

      const list = await apiFetch("/treatments/read_treatments.php", { method: "GET" });
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    const q = fQ.trim().toLowerCase();
    return (items || []).filter((r) => {
      if (fDisease && String(r.disease_id) !== String(fDisease)) return false;
      if (fLevel && String(r.level_code) !== String(fLevel)) return false;

      if (q) {
        const name =
          (r.disease_th ||
            diseaseMap.get(String(r.disease_id))?.disease_th ||
            r.disease_en ||
            diseaseMap.get(String(r.disease_id))?.disease_en ||
            "") + "";
        const advice = (r.advice_text || "") + "";
        if (!(name + " " + advice).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, fDisease, fLevel, fQ, diseaseMap]);

  function openEditModal(row) {
    setEditing(row);
    setOpenEdit(true);
  }

  async function onDelete(row) {
    if (!window.confirm(`ลบคำแนะนำนี้? (treatment_id=${row.treatment_id})`)) return;
    try {
      await apiFetch(`/treatments/delete_treatments.php?treatment_id=${row.treatment_id}`, {
        method: "DELETE",
      });
      await loadAll();
    } catch (e) {
      alert(e.message || "ลบไม่สำเร็จ");
    }
  }

  const th = { textAlign: "center" };
  const td = { textAlign: "center", verticalAlign: "top" };

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn ghost" onClick={() => nav("/admin")}>
            ← กลับหน้าหลัก
          </button>
          <h1 style={{ margin: 0 }}>จัดการคำแนะนำการรักษาโรค</h1>
        </div>

        <div className="header-right">
          <span>
            เข้าสู่ระบบเป็น: {user?.username ?? user?.email} ({user?.role})
          </span>
          <button className="btn ghost" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select className="input" value={fDisease} onChange={(e) => setFDisease(e.target.value)}>
          <option value="">ทุกโรค</option>
          {diseases.map((d) => (
            <option key={d.disease_id} value={d.disease_id}>
              {d.disease_th || d.disease_en || "ไม่ระบุชื่อโรค"}
            </option>
          ))}
        </select>

        <select className="input" value={fLevel} onChange={(e) => setFLevel(e.target.value)}>
          <option value="">ทุกระดับ</option>
          <option value="low">ต่ำ</option>
          <option value="medium">ปานกลาง</option>
          <option value="high">มาก</option>
        </select>

        <input
          className="input"
          style={{ minWidth: 280, flex: 1 }}
          placeholder="ค้นหาในคำแนะนำ..."
          value={fQ}
          onChange={(e) => setFQ(e.target.value)}
        />

        <button
          className="btn ghost"
          onClick={() => {
            setFDisease("");
            setFLevel("");
            setFQ("");
          }}
        >
          รีเซ็ต
        </button>

        <button className="btn" onClick={() => setOpenCreate(true)}>
          + เพิ่มคำแนะนำ
        </button>
      </div>

      {err && (
        <div className="card" style={{ border: "1px solid #fecaca", color: "#991b1b" }}>
          {err}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div>กำลังโหลด...</div>
        ) : filteredItems.length === 0 ? (
          <div>ไม่พบข้อมูลตามตัวกรองที่เลือก</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>ID</th>
                  <th style={th}>โรค</th>
                  <th style={th}>ระดับ</th>
                  <th style={th}>คะแนนขั้นต่ำ</th>
                  <th style={th}>วัน</th>
                  <th style={th}>จำนวนครั้ง</th>
                  <th style={{ ...th, textAlign: "left" }}>คำแนะนำ</th>
                  <th style={th}>จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((r) => {
                  const diseaseName =
                    r.disease_th ||
                    diseaseMap.get(String(r.disease_id))?.disease_th ||
                    r.disease_en ||
                    diseaseMap.get(String(r.disease_id))?.disease_en ||
                    `disease_id=${r.disease_id}`;

                  return (
                    <tr key={r.treatment_id}>
                      <td style={td}>{r.treatment_id}</td>
                      <td style={td}>{diseaseName}</td>
                      <td style={td}>{levelLabel(r.level_code)}</td>
                      <td style={td}>{r.min_score}</td>
                      <td style={td}>{r.days ?? "-"}</td>
                      <td style={td}>{r.times ?? "-"}</td>
                      <td
                        style={{
                          ...td,
                          textAlign: "left",
                          minWidth: 420,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {r.advice_text || "-"}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button className="btn xs" onClick={() => openEditModal(r)}>
                            แก้ไข
                          </button>
                          <button className="btn xs danger" onClick={() => onDelete(r)}>
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE */}
      <TreatmentFormModal
        open={openCreate}
        title="เพิ่มคำแนะนำการรักษา"
        diseases={diseases}
        existingItems={items}
        onClose={() => setOpenCreate(false)}
        onSaved={async () => {
          setOpenCreate(false);
          await loadAll();
        }}
      />

      {/* EDIT */}
      <TreatmentFormModal
        open={openEdit}
        title="แก้ไขคำแนะนำการรักษา"
        diseases={diseases}
        existingItems={items}
        initial={editing}
        onClose={() => {
          setOpenEdit(false);
          setEditing(null);
        }}
        onSaved={async () => {
          setOpenEdit(false);
          setEditing(null);
          await loadAll();
        }}
      />
    </div>
  );
}
