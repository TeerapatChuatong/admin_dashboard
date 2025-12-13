import React, { useEffect, useMemo, useState } from "react";
import { createAnswerApi } from "../api/createAnswerApi";

function getQuestionText(q) {
  return q?.question_text ?? q?.question ?? q?.text ?? "";
}

function getQuestionType(q) {
  return String(q?.question_type ?? q?.type ?? "multi").toLowerCase();
}

const TYPE_LABEL = {
  yes_no: "ใช่ / ไม่ใช่",
  numeric: "ตัวเลข",
  multi: "ตัวเลือก",
};

export default function CreateAnswerModal({ question, diseaseId, onClose, onSuccess }) {
  const questionId = question?.question_id ?? question?.id ?? "";
  const questionText = getQuestionText(question);
  const questionType = getQuestionType(question);

  const isYesNo = questionType === "yes_no";
  const isNumeric = questionType === "numeric";
  const isMulti = questionType === "multi";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // rows: { label, score } หรือ numeric จะใช้ { label: "123", score }
  const [rows, setRows] = useState([]);

  useEffect(() => {
    setError("");
    if (!questionId) {
      setRows([]);
      return;
    }

    if (isYesNo) {
      setRows([
        { label: "ใช่", score: 0 },
        { label: "ไม่ใช่", score: 0 },
      ]);
    } else {
      setRows([{ label: "", score: 0 }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, questionType]);

  const canAddRemove = useMemo(() => isNumeric || isMulti, [isNumeric, isMulti]);

  function updateRow(i, patch) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { label: "", score: 0 }]);
  }

  function removeRow(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function validate() {
    if (!questionId) return "ไม่พบคำถามที่เลือก";
    if (!diseaseId) return "กรุณาเลือกโรคก่อน";
    if (!rows.length) return "กรุณาเพิ่มคำตอบอย่างน้อย 1 รายการ";

    for (const r of rows) {
      const label = String(r.label ?? "").trim();
      if (!label) return "กรุณากรอกคำตอบให้ครบ";
      if (isNumeric && isNaN(Number(label))) return "numeric ต้องเป็นตัวเลขเท่านั้น";
      if (isNaN(Number(r.score))) return "คะแนนต้องเป็นตัวเลข";
    }
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setSaving(true);
    setError("");

    try {
      // สร้างหลายคำตอบทีละรายการ
      for (const r of rows) {
        await createAnswerApi({
          // ส่งให้ครบเผื่อ backend ใช้
          disease_id: diseaseId,
          question_id: questionId,
          choice_label: String(r.label).trim(),
          risk_score: Number(r.score) || 0,
          score: Number(r.score) || 0,
        });
      }

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

        {/* แสดงคำถามที่เลือก */}
        <div className="card" style={{ padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>คำถามที่เลือก</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{questionText || "-"}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
            ประเภทคำถาม: {TYPE_LABEL[questionType] || questionType}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* แสดงฟอร์มตาม question_type */}
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((r, idx) => (
              <div
                key={idx}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                {isYesNo ? (
                  <input value={r.label} disabled />
                ) : (
                  <input
                    placeholder={isNumeric ? "ตัวเลข (เช่น 1, 2, 3)" : "คำตอบ"}
                    value={r.label}
                    onChange={(e) => updateRow(idx, { label: e.target.value })}
                    required
                    style={{ flex: 1 }}
                  />
                )}

                <input
                  type="number"
                  placeholder="คะแนน"
                  value={r.score}
                  onChange={(e) => updateRow(idx, { score: e.target.value })}
                  style={{ width: 120 }}
                />

                {canAddRemove && rows.length > 1 && (
                  <button
                    type="button"
                    className="btn ghost xs"
                    onClick={() => removeRow(idx)}
                  >
                    ลบ
                  </button>
                )}
              </div>
            ))}

            {canAddRemove && (
              <div>
                <button type="button" className="btn ghost" onClick={addRow}>
                  + เพิ่มคำตอบอีก 1 ข้อ
                </button>
              </div>
            )}
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
