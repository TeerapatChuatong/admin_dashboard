import React, { useEffect, useState } from "react";
import { updateQuestionApi } from "../api/updateQuestionApi";
import { readDiseasesApi } from "../api/readDiseasesApi";

const QUESTION_TYPES = [
  { value: "yes_no", label: "ใช่ / ไม่ใช่" },
  { value: "multi", label: "ตัวเลือก" },
  { value: "numeric", label: "ตัวเลข" },
];

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function EditQuestionModal({ question, onClose, onSuccess }) {
  const [diseases, setDiseases] = useState([]);

  const firstDiseaseId =
    Array.isArray(question?.disease_ids) && question.disease_ids.length > 0
      ? question.disease_ids[0]
      : question?.disease_id || "";

  const [form, setForm] = useState({
    question_id: question?.question_id,
    disease_id: firstDiseaseId,
    question_text: question?.question_text || "",
    question_type: question?.question_type || "yes_no",

    // ✅ เพิ่ม
    max_score: toInt(question?.max_score ?? 5, 5),

    sort_order: toInt(question?.sort_order ?? 0, 0),
    is_active: toInt(question?.is_active ?? 1, 1),
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    readDiseasesApi()
      .then((arr) => setDiseases(Array.isArray(arr) ? arr : []))
      .catch((e) => setError(e.message || "โหลดโรคไม่สำเร็จ"));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await updateQuestionApi({
        ...form,
        question_id: Number(form.question_id),
        disease_id: Number(form.disease_id),
        max_score: Number(form.max_score),
        sort_order: Number(form.sort_order) || 0,
        is_active: Number(form.is_active),
        order_no: Number(form.sort_order) || 0, // เผื่อ backend เก่า
      });

      onSuccess && onSuccess();
    } catch (err) {
      setError(err.message || "แก้ไขคำถามไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

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
              onChange={(e) => setForm({ ...form, disease_id: e.target.value })}
              required
            >
              <option value="" disabled>
                -- เลือกโรค --
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

          {/* ✅ เพิ่มคะแนนสูงสุด */}
          <label>
            คะแนนสูงสุดของคำถาม
            <input
              type="number"
              min="1"
              value={form.max_score}
              onChange={(e) => setForm({ ...form, max_score: e.target.value })}
              required
            />
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
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
          </label>

          {/* สถานะคำถาม */}
          <div className="status-field">
            <span className="status-label">
              <h3>สถานะคำถาม</h3>
            </span>
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
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button className="btn ghost" type="button" onClick={onClose}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
