// src/components/CreateAnswerModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, toJsonOrError } from "../api/apiClient";

import { readAnswersApi } from "../api/readAnswersApi";
import { createAnswerApi } from "../api/createAnswerApi";
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

// ✅ ดึง token ได้ทั้ง 2 แบบ (กันของเดิม/ใหม่)
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

  const res = await fetch(url, {
    credentials: "include",
    headers,
  });

  const data = await toJsonOrError(res, "โหลดคะแนนไม่สำเร็จ");
  return extractList(data);
}

export default function CreateAnswerModal({
  diseaseId,
  question,
  onClose,
  onSuccess,
}) {
  const questionId = useMemo(() => String(qId(question) || ""), [question]);
  const questionText = useMemo(() => qText(question), [question]);
  const questionType = useMemo(() => qType(question), [question]);
  const maxScore = useMemo(() => qMax(question), [question]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // yes/no mode
  const [yesNoMode, setYesNoMode] = useState("yesno");
  const [opt1Label, setOpt1Label] = useState("ใช่");
  const [opt2Label, setOpt2Label] = useState("ไม่ใช่");
  const [yesScore, setYesScore] = useState(0);
  const [noScore, setNoScore] = useState(0);

  const [existingChoices, setExistingChoices] = useState([]);
  const [opt1Id, setOpt1Id] = useState(null);
  const [opt2Id, setOpt2Id] = useState(null);

  // multi/numeric rows
  const [rows, setRows] = useState([{ label: "", score: 0 }]);

  // ✅ scores ในระบบ (เพื่อคำนวณคะแนนรวม/คงเหลือ)
  const [baseTotal, setBaseTotal] = useState(0);
  const [scoreMap, setScoreMap] = useState(new Map()); // choice_id -> score_value

  useEffect(() => {
    // reset เมื่อเปิด modal ใหม่
    setError("");
    setYesNoMode("yesno");
    setOpt1Label("ใช่");
    setOpt2Label("ไม่ใช่");
    setYesScore(0);
    setNoScore(0);
    setRows([{ label: "", score: 0 }]);
    setExistingChoices([]);
    setOpt1Id(null);
    setOpt2Id(null);
    setBaseTotal(0);
    setScoreMap(new Map());
  }, [questionId, diseaseId]);

  // โหลด answers ที่มีอยู่ (ใช้หา opt1Id/opt2Id กรณี yes_no)
  useEffect(() => {
    (async () => {
      try {
        if (!questionId) return;
        const choices = await readAnswersApi(Number(questionId));
        setExistingChoices(Array.isArray(choices) ? choices : []);
      } catch {
        setExistingChoices([]);
      }
    })();
  }, [questionId]);

  // โหลดคะแนนในระบบ เพื่อทำคะแนนรวม
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
          m.set(cid, v);
          sum += v;
        }
        setScoreMap(m);
        setBaseTotal(sum);
      } catch {
        setScoreMap(new Map());
        setBaseTotal(0);
      }
    })();
  }, [diseaseId, questionId]);

  // เมื่ออยู่โหมด yes_no: หา choice_id ของ 2 ตัวเลือก (ถ้ามี)
  useEffect(() => {
    if (questionType !== "yes_no") return;
    const findByLabel = (lab) =>
      existingChoices.find(
        (c) => String(c.choice_label ?? c.label ?? "").trim() === String(lab).trim()
      );

    const c1 = findByLabel(opt1Label);
    const c2 = findByLabel(opt2Label);

    setOpt1Id(c1?.choice_id ?? c1?.id ?? null);
    setOpt2Id(c2?.choice_id ?? c2?.id ?? null);
  }, [questionType, existingChoices, opt1Label, opt2Label]);

  function onChangeMode(mode) {
    setYesNoMode(mode);
    if (mode === "yesno") {
      setOpt1Label("ใช่");
      setOpt2Label("ไม่ใช่");
    } else if (mode === "found") {
      setOpt1Label("พบ");
      setOpt2Label("ไม่พบ");
    } else if (mode === "used") {
      setOpt1Label("เคยใช้");
      setOpt2Label("ไม่เคยใช้");
    } else if (mode === "cut") {
      setOpt1Label("เคยตัด");
      setOpt2Label("ไม่เคยตัด");
    }
  }

  function addRow() {
    setRows((prev) => [...prev, { label: "", score: 0 }]);
  }
  function removeRow(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateRow(i, patch) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  // ✅ คำนวณคะแนนรวมหลังบันทึก (คาดการณ์)
  const predictedTotal = useMemo(() => {
    const base = Number(baseTotal) || 0;

    if (questionType === "yes_no") {
      const old1 = opt1Id ? Number(scoreMap.get(String(opt1Id)) || 0) : 0;
      const old2 = opt2Id ? Number(scoreMap.get(String(opt2Id)) || 0) : 0;

      const next1 = Number(yesScore) || 0;
      const next2 = Number(noScore) || 0;

      return base - old1 - old2 + next1 + next2;
    }

    // multi/numeric: เพิ่มใหม่ทั้งหมด → base + sum(new rows)
    const addSum = rows.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    return base + addSum;
  }, [baseTotal, questionType, opt1Id, opt2Id, yesScore, noScore, rows, scoreMap]);

  const remaining = useMemo(() => {
    if (!maxScore) return null;
    return maxScore - (Number(predictedTotal) || 0);
  }, [maxScore, predictedTotal]);

  const exceed = useMemo(() => {
    if (!maxScore) return false;
    return (Number(predictedTotal) || 0) > maxScore;
  }, [maxScore, predictedTotal]);

  async function upsertScore({ disease_id, question_id, choice_id, risk_score }) {
    try {
      await updateScoreApi({ disease_id, question_id, choice_id, risk_score });
    } catch {
      await createScoreApi({ disease_id, question_id, choice_id, risk_score });
    }
  }

  async function saveYesNo() {
    // หา/สร้าง choices 2 ตัว
    let c1 = existingChoices.find(
      (c) => String(c.choice_label ?? "").trim() === String(opt1Label).trim()
    );
    let c2 = existingChoices.find(
      (c) => String(c.choice_label ?? "").trim() === String(opt2Label).trim()
    );

    if (!c1) c1 = await createAnswerApi({ question_id: Number(questionId), choice_label: opt1Label });
    if (!c2) c2 = await createAnswerApi({ question_id: Number(questionId), choice_label: opt2Label });

    const cid1 = c1?.choice_id ?? c1?.id ?? c1?.data?.choice_id ?? c1?.data?.id ?? null;
    const cid2 = c2?.choice_id ?? c2?.id ?? c2?.data?.choice_id ?? c2?.data?.id ?? null;

    if (!cid1 || !cid2) throw new Error("สร้างคำตอบสำเร็จ แต่ไม่พบ choice_id");

    await upsertScore({
      disease_id: Number(diseaseId),
      question_id: Number(questionId),
      choice_id: Number(cid1),
      risk_score: Number(yesScore) || 0,
    });

    await upsertScore({
      disease_id: Number(diseaseId),
      question_id: Number(questionId),
      choice_id: Number(cid2),
      risk_score: Number(noScore) || 0,
    });
  }

  async function saveMultiOrNumeric() {
    const items = rows
      .map((r) => ({
        label: String(r.label ?? "").trim(),
        score: Number(r.score) || 0,
      }))
      .filter((r) => r.label.length > 0);

    if (items.length === 0) throw new Error("กรุณากรอกคำตอบอย่างน้อย 1 ข้อ");

    for (const it of items) {
      const created = await createAnswerApi({
        question_id: Number(questionId),
        choice_label: it.label,
      });

      const cid =
        created?.choice_id ??
        created?.id ??
        created?.data?.choice_id ??
        created?.data?.id ??
        null;

      if (!cid) throw new Error("สร้างคำตอบสำเร็จ แต่ไม่พบ choice_id");

      await upsertScore({
        disease_id: Number(diseaseId),
        question_id: Number(questionId),
        choice_id: Number(cid),
        risk_score: it.score,
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!questionId) return setError("ไม่พบ question_id");
    if (!diseaseId) return setError("ไม่พบ disease_id (กรุณาเลือกโรคก่อน)");

    // ✅ กันตั้งแต่ก่อนยิง API (กัน partial insert)
    if (maxScore && exceed) {
      return setError(
        `คะแนนรวมหลังบันทึก (${predictedTotal}) เกินคะแนนสูงสุดของคำถาม (${maxScore})`
      );
    }

    setLoading(true);
    try {
      if (questionType === "yes_no") await saveYesNo();
      else await saveMultiOrNumeric();

      onSuccess?.();
    } catch (err) {
      setError(err?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 640, maxWidth: "94vw" }}>
        <h2 style={{ marginTop: 0 }}>เพิ่มคำตอบ</h2>

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
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {remaining}
                </div>
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
          {questionType === "yes_no" ? (
            <>
              <label style={{ display: "block", marginBottom: 6 }}>
                รูปแบบคำตอบ
              </label>
              <select
                value={yesNoMode}
                onChange={(e) => onChangeMode(e.target.value)}
                style={{ width: "100%", marginBottom: 10 }}
              >
                <option value="yesno">ใช่ / ไม่ใช่</option>
                <option value="found">พบ / ไม่พบ</option>
                <option value="used">เคยใช้ / ไม่เคยใช้</option>
                <option value="cut">เคยตัด / ไม่เคยตัด</option>
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
                <div>
                  <label>คำตอบ</label>
                  <input
                    value={opt1Label}
                    onChange={(e) => setOpt1Label(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label>คะแนน</label>
                  <input
                    type="number"
                    min="0"
                    value={yesScore}
                    onChange={(e) => setYesScore(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label>คำตอบ</label>
                  <input
                    value={opt2Label}
                    onChange={(e) => setOpt2Label(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label>คะแนน</label>
                  <input
                    type="number"
                    min="0"
                    value={noScore}
                    onChange={(e) => setNoScore(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                เพิ่มคำตอบ ({questionType || "multi"})
              </div>

              {rows.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 140px auto",
                    gap: 10,
                    marginBottom: 10,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label>คำตอบ</label>
                    <input
                      value={r.label}
                      onChange={(e) => updateRow(idx, { label: e.target.value })}
                      placeholder={questionType === "numeric" ? "เช่น 1, 2, 3..." : "พิมพ์คำตอบ"}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label>คะแนน</label>
                    <input
                      type="number"
                      min="0"
                      value={r.score}
                      onChange={(e) => updateRow(idx, { score: e.target.value })}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length <= 1}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              ))}

              <button type="button" className="btn ghost" onClick={addRow}>
                + เพิ่มคำตอบอีก 1 ข้อ
              </button>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
              ยกเลิก
            </button>
            <button type="submit" className="btn" disabled={loading || (maxScore && exceed)}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
