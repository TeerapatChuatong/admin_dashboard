// src/components/EditAnswerModal.jsx
import React, { useEffect, useState } from "react";
import { updateAnswerApi } from "../api/updateAnswerApi";
import { readQuestionsApi } from "../api/readQuestionsApi";

export default function EditAnswerModal({ answer, onClose, onSuccess }) {
  const [questionsMap, setQuestionsMap] = useState({});
  const [form, setForm] = useState({
    answer_id: null,
    question_id: "",
    answer_text: "",
    score_value: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // โหลดคำถามทั้งหมด → ทำ map จาก question_id → question_text
  useEffect(() => {
    async function loadQuestions() {
      try {
        const data = await readQuestionsApi();
        const arr = Array.isArray(data) ? data : [];
        const map = {};
        arr.forEach((q) => {
          const id = q.question_id ?? q.id;
          const text =
            q.question_text ?? q.question ?? q.text ?? `คำถาม ID ${id}`;
          map[String(id)] = text;
        });
        setQuestionsMap(map);
      } catch (err) {
        console.error("โหลดคำถามไม่สำเร็จ", err);
      }
    }
    loadQuestions();
  }, []);

  // โหลดค่าจาก answer ที่ส่งมา
  useEffect(() => {
    if (!answer) return;
    setForm({
      answer_id: answer.answer_id ?? answer.id,
      question_id: answer.question_id,
      answer_text: answer.answer_text ?? answer.text ?? "",
      score_value: answer.score_value ?? answer.score ?? 0,
    });
  }, [answer]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await updateAnswerApi({
        ...form,
        score_value: Number(form.score_value) || 0,
      });
      onSuccess && onSuccess();
    } catch (err) {
      setError(err.message || "แก้ไขคำตอบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!answer) return null;

  // ข้อความคำถามที่จะแสดง (อ่านจาก map)
  const questionLabel =
    questionsMap[String(form.question_id)] ||
    `รหัสคำถาม: ${form.question_id}`;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>แก้ไขคำตอบ</h2>
        {error && <div className="alert error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          {/* ✅ เปลี่ยนจาก รหัสคำถาม (question_id) → ข้อความคำถาม */}
          <label>
            ข้อความคำถาม
            <textarea value={questionLabel} readOnly rows={2} />
          </label>

          {/* ยังเก็บ question_id ไว้ส่งให้ backend เหมือนเดิม */}
          <input type="hidden" value={form.question_id} />

          <label>
            ข้อความคำตอบ
            <textarea
              rows={3}
              value={form.answer_text}
              onChange={(e) =>
                setForm({ ...form, answer_text: e.target.value })
              }
              required
            />
          </label>

          <label>
            คะแนน (score)
            <input
              type="number"
              min="0"
              value={form.score_value}
              onChange={(e) =>
                setForm({ ...form, score_value: e.target.value })
              }
            />
          </label>

          <div className="form-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={onClose}
              style={{ marginLeft: 4 }}
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
