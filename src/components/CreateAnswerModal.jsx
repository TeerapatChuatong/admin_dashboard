// src/components/CreateAnswerModal.jsx
import React, { useEffect, useState } from "react";
import { createAnswerApi } from "../api/createAnswerApi";

export default function CreateAnswerModal({
  question,        // 👈 ได้มาจากหน้า AdminAnswersPage (ส่งทั้ง object)
  onClose,
  onSuccess,
}) {
  // ดึงข้อมูลจาก question object
  const questionId = question?.question_id ?? question?.id ?? "";
  const questionText = question?.question_text ?? question?.question ?? question?.text ?? "";

  const [form, setForm] = useState({
    question_id: questionId,
    answer_text: "",
    score: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ถ้า question เปลี่ยน ให้ sync เข้า state
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      question_id: questionId,
    }));
  }, [questionId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!form.question_id) {
        throw new Error("ไม่พบรหัสคำถาม (question_id)");
      }

      await createAnswerApi({
        question_id: form.question_id,
        answer_text: form.answer_text,
        score: Number(form.score) || 0,
      });

      onSuccess && onSuccess();
    } catch (err) {
      setError(err.message || "เพิ่มคำตอบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>เพิ่มคำตอบ</h2>
        {error && <div className="alert error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          {/* แสดงข้อความคำถาม (อ่านอย่างเดียว) */}
          <label>
            ข้อความคำถาม
            <textarea
              value={questionText || ""}
              readOnly
              rows={2}
              style={{ backgroundColor: "#f9fafb" }}
            />
          </label>

          {/* เก็บ question_id ไว้ใน state สำหรับส่ง API ไม่ต้องแสดงให้ผู้ใช้เห็น */}
          {/* <input type="hidden" value={form.question_id} /> */}

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
              value={form.score}
              onChange={(e) =>
                setForm({ ...form, score: e.target.value })
              }
            />
          </label>

          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "เพิ่มคำตอบ"}
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