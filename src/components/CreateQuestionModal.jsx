// CreateQuestionModal.jsx
import React, { useEffect, useState } from "react";
import { createQuestionApi } from "../api/createQuestionApi";
import { readDiseasesApi } from "../api/readDiseasesApi";

const QUESTION_TYPES = [
  { value: "yes_no", label: "ใช่ / ไม่ใช่" },
  { value: "multi", label: "ตัวเลือก" },
  { value: "numeric", label: "ตัวเลข" },
];

// ✅ เพิ่ม: แหล่งคำตอบ (ใช้เฉพาะคำถาม disease_id=8)
const ANSWER_SOURCES = [
  { value: "manual", label: "เพิ่มคำตอบเอง (กรอกเองในหน้าจัดการคำตอบ)" },
  { value: "chemicals", label: "ดรอปดาวน์จากตารางสารเคมี" },
];

// ✅ FIX: ให้ modal-card เลื่อนขึ้นลงได้เมื่อมีรูป/เนื้อหาเยอะ (คง UI เดิม)
const modalCardScrollStyle = {
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch"};

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function CreateQuestionModal({
  initialDiseaseId = "",
  initialSortOrder = 0,
  getNextSortOrder,
  onClose,
  onSuccess}) {
  const [diseases, setDiseases] = useState([]);

  // ✅ preview รูปจากไฟล์
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");

  const [form, setForm] = useState({
    disease_id: initialDiseaseId ?? "",
    question_text: "",
    question_type: "yes_no",

    // ✅ answer_source (manual|chemicals)
    answer_source: "manual",

    // ✅ meta (ยังคงไว้ ไม่เปลี่ยนโครงเดิม)
    answer_scope: "scan",
    purpose: "severity",

    // ✅ รูปประกอบ
    example_image: "",
    example_image_file: null,

    // ✅ เดิมบังคับ >=1 แต่มีเคส max_score=0 ได้ (เช่นคำถามสารเคมี)
    max_score: 0,

    sort_order: toInt(initialSortOrder, 0),
    is_active: 1});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    readDiseasesApi()
      .then((arr) => setDiseases(Array.isArray(arr) ? arr : []))
      .catch((e) => setError(e.message || "โหลดโรคไม่สำเร็จ"));
  }, []);

  // ✅ ทำ preview เมื่อเลือกไฟล์
  useEffect(() => {
    if (!(form.example_image_file instanceof File)) {
      setLocalPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(form.example_image_file);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.example_image_file]);

  // ✅ enforce: ถ้าไม่ใช่ disease_id=8 → answer_source ต้องเป็น manual
  // ✅ enforce: ถ้าเลือก chemicals → question_type เป็น multi
  useEffect(() => {
    const did = Number(form.disease_id);
    if (did !== 8) {
      if (form.answer_source !== "manual") {
        setForm((prev) => ({ ...prev, answer_source: "manual" }));
      }
      return;
    }
    if (form.answer_source === "chemicals" && form.question_type !== "multi") {
      setForm((prev) => ({ ...prev, question_type: "multi" }));
    }
  }, [form.disease_id, form.answer_source, form.question_type]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (String(form.disease_id) === "") throw new Error("กรุณาเลือก (ทั้งสวน/โรค)");
      if (!String(form.question_text || "").trim()) throw new Error("กรุณากรอกข้อความคำถาม");

      const maxScoreNum = Number(form.max_score);
      if (!Number.isFinite(maxScoreNum) || maxScoreNum < 0) {
        throw new Error("คะแนนสูงสุดต้องไม่ติดลบ");
      }

      let sortOrderNum = Number(form.sort_order);
      if (!Number.isFinite(sortOrderNum) || sortOrderNum < 0) sortOrderNum = 0;

      // ถ้ามีฟังก์ชันคำนวณลำดับให้ใช้ (คง logic เดิม)
      if (typeof getNextSortOrder === "function") {
        sortOrderNum = toInt(getNextSortOrder(form.disease_id), sortOrderNum);
      }

      const example_image_trim = String(form.example_image || "").trim();

      const did = Number(form.disease_id);
      const answer_source = did === 8 ? String(form.answer_source || "manual") : "manual";

      await createQuestionApi({
        ...form,
        disease_id: did,
        question_text: String(form.question_text),
        question_type: answer_source === "chemicals" ? "multi" : String(form.question_type),
        answer_source,
        example_image: example_image_trim ? example_image_trim : null,
        max_score: Number(maxScoreNum),
        sort_order: Number(sortOrderNum) || 0,
        is_active: Number(form.is_active),
        order_no: Number(sortOrderNum) || 0});

      onSuccess && onSuccess();
    } catch (err) {
      setError(err.message || "เพิ่มคำถามไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={modalCardScrollStyle}>
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
                -- เลือก (ทั้งสวน/โรค) --
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

          {/* ✅ เฉพาะ disease_id=8: เลือก answer_source */}
          {Number(form.disease_id) === 8 && (
            <label>
              รูปแบบคำตอบ (เฉพาะคำถามสารเคมี)
              <select
                value={form.answer_source}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    answer_source: v,
                    question_type: v === "chemicals" ? "multi" : prev.question_type}));
                }}
              >
                {ANSWER_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {String(form.answer_source) === "chemicals" && (
                <div style={{ marginTop: 6, color: "#9ca3af" }}>
                  คำถามนี้จะดึงรายการสารเคมีจากตารางสารเคมี (ไม่ต้องเพิ่มคำตอบในหน้าจัดการคำตอบ)
                </div>
              )}
            </label>
          )}

          {/* ✅ รูปประกอบ: URL + เลือกไฟล์ */}
          <label>
            รูปประกอบ (URL)
            <input
              type="text"
              placeholder="วางลิงก์รูป (ไม่ใส่ก็ได้)"
              value={form.example_image}
              onChange={(e) => setForm({ ...form, example_image: e.target.value })}
            />

            <div style={{ marginTop: 8 }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                  setForm({ ...form, example_image_file: f });
                }}
              />

              {form.example_image_file && (
                <button
                  type="button"
                  className="btn ghost"
                  style={{ marginTop: 8 }}
                  onClick={() => setForm({ ...form, example_image_file: null })}
                >
                  ลบไฟล์ที่เลือก
                </button>
              )}
            </div>

            {localPreviewUrl ? (
              <div style={{ marginTop: 8 }}>
                <img
                  src={localPreviewUrl}
                  alt="ตัวอย่างรูปคำถาม"
                  style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8 }}
                />
              </div>
            ) : (
              String(form.example_image || "").trim() && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={String(form.example_image).trim()}
                    alt="ตัวอย่างรูปคำถาม"
                    style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8 }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )
            )}
          </label>

          <label>
            คะแนนสูงสุดของคำถาม
            <input
              type="number"
              min="0"
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
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
          </label>

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

          <div className="formActions">
            <button className="btnBase btnSave" type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button className="btnBase btnCancel" type="button" onClick={onClose}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
