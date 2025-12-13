import React, { useEffect, useState } from "react";
import { updateQuestionApi } from "../api/updateQuestionApi";
import { readDiseasesApi } from "../api/readDiseasesApi";

const QUESTION_TYPES = [
  { value: "yes_no",  label: "ใช่ / ไม่ใช่" },
  { value: "multi",   label: "ตัวเลือก" },
  { value: "numeric", label: "ตัวเลข" },
];

export default function EditQuestionModal({ question, onClose, onSuccess }) {
  const [diseases, setDiseases] = useState([]);
  const [form, setForm] = useState({
    question_id: null,
    disease_id: "",
    question_text: "",
    question_type: "yes_no",
    sort_order: 0,
    is_active: 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    readDiseasesApi()
      .then((arr) => setDiseases(Array.isArray(arr) ? arr : []))
      .catch((e) => setError(e.message || "โหลดโรคไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    if (!question) return;

    const ids = String(question.disease_ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setForm({
      question_id: question.question_id ?? question.id,
      disease_id: ids[0] || "",
      question_text:
        question.question_text ?? question.question ?? question.text ?? "",
      question_type: question.question_type || "yes_no",
      sort_order: question.sort_order ?? question.order_no ?? 0,
      is_active:
        Number(question.is_active ?? question.active ?? 1) === 1 ? 1 : 0,
    });
  }, [question]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await updateQuestionApi({
        ...form,
        order_no: Number(form.sort_order) || 0,
      });
      onSuccess && onSuccess();
    } catch (err) {
      setError(err.message || "แก้ไขคำถามไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!question) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>แก้ไขคำถาม</h2>
        {error && <div className="alert error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            โรค / กลุ่มคำถาม
            <select
              value={form.disease_id}
              onChange={(e) =>
                setForm({ ...form, disease_id: e.target.value })
              }
              required
            >
              <option value="" disabled>
                -- เลือกโรค (ไม่บังคับ) --
              </option>
              {diseases.map((d) => (
                <option key={d.disease_id} value={d.disease_id}>
                  {d.disease_th ||
                    d.disease_en ||
                    d.name_th ||
                    d.name_en ||
                    d.disease_slug ||
                    d.disease_id}
                </option>
              ))}
            </select>
          </label>

          <label>
            ประเภทคำถาม
            <select
              value={form.question_type}
              onChange={(e) =>
                setForm({ ...form, question_type: e.target.value })
              }
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            ข้อความคำถาม
            <textarea
              rows={3}
              value={form.question_text}
              onChange={(e) =>
                setForm({ ...form, question_text: e.target.value })
              }
              required
            />
          </label>

          <label>
            ลำดับการแสดงผล
            <input
              type="number"
              min="0"
              value={form.sort_order}
              onChange={(e) =>
                setForm({ ...form, sort_order: e.target.value })
              }
            />
          </label>

          {/* สถานะคำถาม */}
          <div className="status-field">
            <span className="status-label"><h3>สถานะคำถาม</h3></span>
            <div className="status-row">
              <label className="status-option">
                <input
                  type="radio"
                  name="is_active"
                  value={1}
                  checked={Number(form.is_active) === 1}
                  onChange={() => setForm({ ...form, is_active: 1 })}
                />
                <span>เปิดใช้งานคำถาม</span>
              </label>

              <label className="status-option">
                <input
                  type="radio"
                  name="is_active"
                  value={0}
                  checked={Number(form.is_active) === 0}
                  onChange={() => setForm({ ...form, is_active: 0 })}
                />
                <span>ปิดใช้งานคำถาม</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={onClose}
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
