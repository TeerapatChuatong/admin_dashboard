// src/components/EditAnswerModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, toJsonOrError } from "../api/apiClient";

import { updateAnswerApi } from "../api/updateAnswerApi";
import { createScoreApi } from "../api/createScoreApi";
import { updateScoreApi } from "../api/updateScoreApi";

function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function qId(q) {
  return q?.question_id ?? q?.id ?? "";
}
function qText(q) {
  return String(q?.question_text ?? q?.question ?? q?.text ?? "");
}
function qType(q) {
  return String(q?.question_type ?? q?.type ?? "").trim();
}
function typeLabel(type) {
  const t = String(type || "");
  if (t === "yes_no") return "ใช่/ไม่ใช่";
  if (t === "numeric") return "ตัวเลข";
  if (t === "multi") return "หลายตัวเลือก";
  return t || "-";
}

async function fetchScoresMap({ disease_id, question_id }) {
  if (!disease_id || !question_id) return new Map();

  const url = `${API_BASE}/scores/read_scores.php?disease_id=${encodeURIComponent(
    disease_id
  )}&question_id=${encodeURIComponent(question_id)}`;

  const res = await fetch(url);
  const data = await toJsonOrError(res, "โหลดคะแนนไม่สำเร็จ");
  const list = extractList(data);

  const map = new Map(); // choice_id -> scoreRow
  for (const s of list) {
    const cid = String(s.choice_id ?? s.choiceId ?? "");
    if (!cid) continue;
    map.set(cid, s);
  }
  return map;
}

export default function EditAnswerModal({ answer, question, diseaseId, onClose, onSuccess }) {
  const questionId = useMemo(() => String(qId(question) || ""), [question]);
  const questionText = useMemo(() => qText(question), [question]);
  const questionType = useMemo(() => qType(question), [question]);

  const choiceId = useMemo(
    () => String(answer?.choice_id ?? answer?.id ?? ""),
    [answer]
  );

  const initialLabel = useMemo(
    () => String(answer?.choice_label ?? answer?.answer_text ?? "").trim(),
    [answer]
  );

  const initialScore = useMemo(() => {
    const v =
      answer?.risk_score ??
      answer?.score_value ??
      answer?.score ??
      answer?.points ??
      0;
    return Number(v) || 0;
  }, [answer]);

  const [label, setLabel] = useState(initialLabel);
  const [score, setScore] = useState(initialScore);
  const [scoreId, setScoreId] = useState(answer?._score_id ?? null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ หา score_id จาก scores จริง (กันกรณี list ยังไม่ส่งมา)
  useEffect(() => {
    (async () => {
      try {
        if (!diseaseId || !questionId || !choiceId) return;
        const scoreMap = await fetchScoresMap({
          disease_id: diseaseId,
          question_id: questionId,
        });
        const row = scoreMap.get(String(choiceId));
        if (row?.score_id) setScoreId(row.score_id);
      } catch {
        // ignore
      }
    })();
  }, [diseaseId, questionId, choiceId]);

  async function upsertScore({ disease_id, question_id, choice_id, risk_score }) {
    // ถ้ามี score_id → update
    if (scoreId) {
      await updateScoreApi({
        score_id: scoreId,
        disease_id,
        question_id,
        choice_id,
        risk_score,
      });
      return;
    }

    // ไม่มี → create
    await createScoreApi({ disease_id, question_id, choice_id, risk_score });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!choiceId) {
      setError("ไม่พบ choice_id");
      return;
    }
    if (!questionId) {
      setError("ไม่พบ question_id");
      return;
    }
    if (!diseaseId) {
      setError("ไม่พบ disease_id (กรุณาเลือกโรคก่อน)");
      return;
    }

    setLoading(true);
    try {
      // ✅ update choice
      await updateAnswerApi({
        choice_id: Number(choiceId),
        question_id: Number(questionId),
        choice_label: String(label ?? "").trim(),
      });

      // ✅ upsert score ลง scores
      await upsertScore({
        disease_id: Number(diseaseId),
        question_id: Number(questionId),
        choice_id: Number(choiceId),
        risk_score: Number(score) || 0,
      });

      onSuccess?.();
    } catch (err) {
      setError(err?.message || "บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 640, maxWidth: "94vw" }}>
        <h2 style={{ marginTop: 0 }}>แก้ไขคำตอบ</h2>

        {error && <div className="alert error">{error}</div>}

        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>คำถามที่เลือก</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{questionText || "-"}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
            ประเภทคำถาม: {typeLabel(questionType)}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ตัวช่วยสำหรับ yes_no: ใส่ preset label ได้เร็ว */}
          {questionType === "yes_no" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setLabel("ใช่")}>
                ใช่
              </button>
              <button type="button" className="btn ghost" onClick={() => setLabel("ไม่ใช่")}>
                ไม่ใช่
              </button>
              <button type="button" className="btn ghost" onClick={() => setLabel("พบ")}>
                พบ
              </button>
              <button type="button" className="btn ghost" onClick={() => setLabel("ไม่พบ")}>
                ไม่พบ
              </button>
            </div>
          )}

          <label>คำตอบ</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <label>คะแนน</label>
          <input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            style={{ width: "100%" }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
              ยกเลิก
            </button>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
