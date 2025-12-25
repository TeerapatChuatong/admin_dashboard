// src/components/CreateQuestionModal.jsx
import React, { useEffect, useState } from "react";
import { createQuestionApi } from "../api/createQuestionApi";
import { readDiseasesApi } from "../api/readDiseasesApi";

const QUESTION_TYPES = [
  { value: "yes_no", label: "ใช่ / ไม่ใช่" },
  { value: "multi", label: "ตัวเลือก" },
  { value: "numeric", label: "ตัวเลข" },
];

export default function CreateQuestionModal({ onClose, onSuccess }) {
  const [diseases, setDiseases] = useState([]);

  // ✅ เก็บ type ให้ชัด: disease_id เป็น string (เพราะมาจาก select)
  // ✅ max_score / sort_order เป็น number จริง
  const [form, setForm] = useState({
    disease_id: "",
    question_text: "",
    question_type: "yes_no",
    max_score: 5,
    sort_order: 0,
    is_active: 1,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    readDiseasesApi()
      .then((res) => {
        // ✅ รองรับทั้งกรณี API คืนเป็น array ตรง ๆ หรือ { data: [...] }
        const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setDiseases(arr);
      })
      .catch((e) => setError(e?.message || "โหลดโรคไม่สำเร็จ"));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const disease_id_num = Number(form.disease_id);
      const sort_order_num = Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : 0;
      const max_score_num = Number.isFinite(Number(form.max_score)) ? Number(form.max_score) : NaN;

      const question_text_trim = String(form.question_text || "").trim();

      if (!disease_id_num) {
        throw new Error("กรุณาเลือกโรค");
      }
      if (!question_text_trim) {
        throw new Error("กรุณากรอกข้อความคำถาม");
      }

      // ✅ ตอนนี้ตั้ง UI min=1 (บังคับต้องกำหนดเพดานคะแนน)
      // ถ้าอยากให้ 0 = ไม่จำกัด ให้แก้ input min เป็น 0 และแก้เงื่อนไขนี้เป็น max_score_num >= 0
      if (!Number.isFinite(max_score_num) || max_score_num < 1) {
        throw new Error("คะแนนสูงสุดของคำถามต้องเป็นตัวเลขตั้งแต่ 1 ขึ้นไป");
      }

      await createQuestionApi({
        ...form,
        disease_id: disease_id_num, // ✅ ส่งเป็น number ชัด ๆ
        question_text: question_text_trim, // ✅ trim กันช่องว่างล้วน
        max_score: max_score_num,
        sort_order: sort_order_num,
        order_no: sort_order_num, // เผื่อ backend เก่า
      });

      onSuccess && onSuccess();
    } catch (err) {
      setError(err?.message || "เพิ่มคำถามไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>เพิ่มคำถาม</h2>
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
              onChange={(e) => setForm({ ...form, question_type: e.target.value })}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {/* ✅ คะแนนสูงสุด */}
          <label>
            คะแนนสูงสุดของคำถาม
            <input
              type="number"
              min="1"
              value={form.max_score}
              onChange={(e) =>
                setForm({
                  ...form,
                  max_score: parseInt(e.target.value || "0", 10),
                })
              }
              required
            />
          </label>

          <label>
            ข้อความคำถาม
            <textarea
              rows={3}
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
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
                setForm({
                  ...form,
                  sort_order: parseInt(e.target.value || "0", 10),
                })
              }
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
              {saving ? "กำลังบันทึก..." : "เพิ่มคำถาม"}
            </button>
            <button className="btn ghost" type="button" onClick={onClose} disabled={saving}>
              ยกเลิก
            </button>
          </div>
        </form>

        {/* ถ้าคุณอยากให้ 0 = ไม่จำกัด:
            1) เปลี่ยน input max_score min="0"
            2) เปลี่ยน validation เป็น max_score_num >= 0
        */}
      </div>
    </div>
  );
}
