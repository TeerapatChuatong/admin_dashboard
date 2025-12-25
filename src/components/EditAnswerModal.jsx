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
function qMax(q) {
  const v = q?.max_score ?? q?.maxScore ?? q?.max ?? null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function typeLabel(type) {
  const t = String(type || "");
  if (t === "yes_no") return "ใช่/ไม่ใช่";
  if (t === "numeric") return "ตัวเลข";
  if (t === "multi") return "หลายตัวเลือก";
  return t || "-";
}

function getAnyToken() {
  try {
    const raw = localStorage.getItem("auth_user");
    if (raw) {
      const u = JSON.parse(raw);
      if (u?.token) return String(u.token);
    }
  } catch {}
  const t = localStorage.getItem("auth_token");
  return t ? String(t) : "";
}

async function fetchScoresList({ disease_id, question_id }) {
  if (!disease_id || !question_id) return [];

  const url = `${API_BASE}/scores/read_scores.php?disease_id=${encodeURIComponent(
    disease_id
  )}&question_id=${encodeURIComponent(question_id)}`;

  const token = getAnyToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { credentials: "include", headers });
  const data = await toJsonOrError(res, "โหลดคะแนนไม่สำเร็จ");
  return extractList(data);
}

export default function EditAnswerModal({
  answer,
  question,
  diseaseId,
  onClose,
  onSuccess,
}) {
  const questionId = useMemo(() => String(qId(question) || ""), [question]);
  const questionText = useMemo(() => qText(question), [question]);
  const questionType = useMemo(() => qType(question), [question]);
  const maxScore = useMemo(() => qMax(question), [question]);

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

  // ✅ รวมคะแนนในระบบ
  const [baseTotal, setBaseTotal] = useState(0);
  const [scoreMap, setScoreMap] = useState(new Map());

  useEffect(() => {
    setLabel(String(answer?.choice_label ?? answer?.answer_text ?? "").trim());
    const v =
      answer?.risk_score ??
      answer?.score_value ??
      answer?.score ??
      answer?.points ??
      0;
    setScore(Number(v) || 0);
    setScoreId(answer?._score_id ?? null);
    setError("");
  }, [answer]);

  // โหลด scores เพื่อคำนวณ baseTotal และหา score_id ของตัวนี้
  useEffect(() => {
    (async () => {
      try {
        if (!diseaseId || !questionId) return;

        const list = await fetchScoresList({
          disease_id: diseaseId,
          question_id: questionId,
        });

        const m = new Map();
        let sum = 0;
        for (const s of list) {
          const cid = String(s.choice_id ?? "");
          if (!cid) continue;
          const v = Number(s.score_value ?? s.risk_score ?? 0) || 0;
          m.set(cid, { ...s, _v: v });
          sum += v;
        }

        setScoreMap(m);
        setBaseTotal(sum);

        const row = m.get(String(choiceId));
        if (row?.score_id) setScoreId(row.score_id);
      } catch {
        setScoreMap(new Map());
        setBaseTotal(0);
      }
    })();
  }, [diseaseId, questionId, choiceId]);

  const oldScore = useMemo(() => {
    const row = scoreMap.get(String(choiceId));
    if (row && row._v != null) return Number(row._v) || 0;
    return Number(initialScore) || 0;
  }, [scoreMap, choiceId, initialScore]);

  const predictedTotal = useMemo(() => {
    return (Number(baseTotal) || 0) - (Number(oldScore) || 0) + (Number(score) || 0);
  }, [baseTotal, oldScore, score]);

  const remaining = useMemo(() => {
    if (!maxScore) return null;
    return maxScore - (Number(predictedTotal) || 0);
  }, [maxScore, predictedTotal]);

  const exceed = useMemo(() => {
    if (!maxScore) return false;
    return (Number(predictedTotal) || 0) > maxScore;
  }, [maxScore, predictedTotal]);

  async function upsertScore({ disease_id, question_id, choice_id, risk_score }) {
    // scoreId มี → update, ไม่มี → create
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
    await createScoreApi({ disease_id, question_id, choice_id, risk_score });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!choiceId) return setError("ไม่พบ choice_id");
    if (!questionId) return setError("ไม่พบ question_id");
    if (!diseaseId) return setError("ไม่พบ disease_id (กรุณาเลือกโรคก่อน)");

    // ✅ กันตั้งแต่ก่อนยิง API
    if (maxScore && exceed) {
      return setError(
        `คะแนนรวมหลังบันทึก (${predictedTotal}) เกินคะแนนสูงสุดของคำถาม (${maxScore})`
      );
    }

    setLoading(true);
    try {
      await updateAnswerApi({
        choice_id: Number(choiceId),
        question_id: Number(questionId),
        choice_label: String(label ?? "").trim(),
      });

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

        {/* ✅ คะแนนรวม/คงเหลือ แบบเรียลไทม์ */}
        {maxScore && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>สรุปคะแนนของคำถาม</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>คะแนนสูงสุด</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{maxScore}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>คะแนนหลังบันทึก</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{predictedTotal}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>คะแนนคงเหลือ</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{remaining}</div>
              </div>
            </div>

            {exceed && (
              <div className="alert error" style={{ marginTop: 10 }}>
                คะแนนรวมเกินกำหนด (เกิน {Math.abs(remaining)} คะแนน)
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {questionType === "yes_no" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setLabel("ใช่")}>ใช่</button>
              <button type="button" className="btn ghost" onClick={() => setLabel("ไม่ใช่")}>ไม่ใช่</button>
              <button type="button" className="btn ghost" onClick={() => setLabel("พบ")}>พบ</button>
              <button type="button" className="btn ghost" onClick={() => setLabel("ไม่พบ")}>ไม่พบ</button>
              <button type="button" className="btn ghost" onClick={() => setLabel("เคยใช้")}>เคยใช้</button>
              <button type="button" className="btn ghost" onClick={() => setLabel("ไม่เคยใช้")}>ไม่เคยใช้</button>
              <button type="button" className="btn ghost" onClick={() => setLabel("เคยตัด")}>เคยตัด</button>
              <button type="button" className="btn ghost" onClick={() => setLabel("ไม่เคยตัด")}>ไม่เคยตัด</button>
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
            min="0"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            style={{ width: "100%" }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
              ยกเลิก
            </button>
            <button type="submit" className="btn" disabled={loading || (maxScore && exceed)}>
              {loading ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
