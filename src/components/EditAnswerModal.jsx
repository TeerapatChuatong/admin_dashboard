import React, { useEffect, useState } from "react";
import { updateAnswerApi } from "../api/updateAnswerApi";

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
}

function getQuestionText(q) {
  return q?.question_text ?? q?.question ?? q?.text ?? "";
}

export default function EditAnswerModal({ answer, question, diseaseId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    choice_id: "",
    choice_label: "",
    score: 0,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!answer) return;

    const id = pick(answer, ["choice_id", "answer_id", "id"], "");
    const label = pick(answer, ["choice_label", "answer_text", "answer", "text"], "");
    const score = pick(answer, ["risk_score", "score", "points"], 0);

    setForm({
      choice_id: id,
      choice_label: String(label ?? ""),
      score: Number(score) || 0,
    });
  }, [answer]);

  if (!answer) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await updateAnswerApi({
        // ส่งให้ครบ เผื่อ backend ใช้
        disease_id: diseaseId,
        choice_id: form.choice_id,
        choice_label: String(form.choice_label ?? "").trim(),
        risk_score: Number(form.score) || 0,
        score: Number(form.score) || 0,
      });

      onSuccess && onSuccess();
    } catch (err) {
      setError(err.message || "แก้ไขคำตอบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>แก้ไขคำตอบ</h2>
        {error && <div className="alert error">{error}</div>}

        {/* แสดงคำถามที่เลือก */}
        <div className="card" style={{ padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>คำถามที่เลือก</div>
          <div style={{ whiteSpace: "pre-wrap" }}>
            {getQuestionText(question) || "-"}
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            คำตอบ
            <input
              value={form.choice_label}
              onChange={(e) => setForm({ ...form, choice_label: e.target.value })}
              required
            />
          </label>

          <label>
            คะแนน
            <input
              type="number"
              value={form.score}
              onChange={(e) => setForm({ ...form, score: e.target.value })}
            />
          </label>

          <div className="form-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
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
