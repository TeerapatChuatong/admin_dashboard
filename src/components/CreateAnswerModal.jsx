// src/components/CreateAnswerModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, toJsonOrError } from "../api/apiClient";

import { readAnswersApi } from "../api/readAnswersApi";
import { createAnswerApi } from "../api/createAnswerApi";
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

export default function CreateAnswerModal({ question, diseaseId, onClose, onSuccess }) {
  const questionId = useMemo(() => String(qId(question) || ""), [question]);
  const questionText = useMemo(() => qText(question), [question]);
  const questionType = useMemo(() => qType(question), [question]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // โหลด choices เดิม (ใช้สำหรับ yes_no เพื่อไม่สร้างซ้ำ + toggle ใช่/ไม่ใช่ ↔ พบ/ไม่พบ)
  const [existingChoices, setExistingChoices] = useState([]);

  // yes_no settings
  const [yesNoMode, setYesNoMode] = useState("yesno"); // yesno | found
  const [yesScore, setYesScore] = useState(0);
  const [noScore, setNoScore] = useState(0);

  // multi/numeric rows
  const [rows, setRows] = useState([{ label: "", score: 0 }]);

  useEffect(() => {
    (async () => {
      try {
        if (!questionId) return;
        const data = await readAnswersApi(questionId);
        const list = Array.isArray(data) ? data : extractList(data);
        setExistingChoices(list);

        // auto detect โหมด ถ้ามี "พบ/ไม่พบ" อยู่แล้ว
        const hasFound = list.some((c) => String(c.choice_label ?? "").trim() === "พบ");
        const hasNotFound = list.some((c) => String(c.choice_label ?? "").trim() === "ไม่พบ");
        if (hasFound || hasNotFound) setYesNoMode("found");
      } catch {
        // ไม่ต้อง block UI
      }
    })();
  }, [questionId]);

  function addRow() {
    setRows((prev) => [...prev, { label: "", score: 0 }]);
  }

  function updateRow(idx, patch) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function upsertScore({ disease_id, question_id, choice_id, risk_score }) {
    // ✅ update ถ้ามี score แล้ว ไม่งั้น create
    const scoreMap = await fetchScoresMap({ disease_id, question_id });
    const existing = scoreMap.get(String(choice_id));

    if (existing?.score_id) {
      await updateScoreApi({
        score_id: existing.score_id,
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

  async function ensureChoice({ choice_label }) {
    // หา choice เดิมก่อน
    const found = existingChoices.find(
      (c) => String(c.choice_label ?? "").trim() === String(choice_label).trim()
    );
    if (found) return found;

    // ไม่เจอ → create
    const created = await createAnswerApi({
      question_id: Number(questionId),
      choice_label: String(choice_label),
    });

    // createAnswerApi อาจคืนหลายรูปแบบ → เดา id ให้ได้
    const cid =
      created?.choice_id ??
      created?.id ??
      created?.data?.choice_id ??
      created?.data?.id ??
      null;

    if (!cid) throw new Error("สร้างคำตอบสำเร็จ แต่ไม่พบ choice_id");

    const newObj = { choice_id: cid, question_id: questionId, choice_label };
    setExistingChoices((prev) => [...prev, newObj]);
    return newObj;
  }

  async function saveYesNo() {
    const yesLabel = yesNoMode === "found" ? "พบ" : "ใช่";
    const noLabel = yesNoMode === "found" ? "ไม่พบ" : "ไม่ใช่";

    // ✅ ถ้ามี choice เป็นอีกโหมดอยู่แล้ว ให้ reuse แล้วเปลี่ยน label เพื่อไม่สร้างซ้ำ
    const anyYes = existingChoices.find((c) =>
      ["ใช่", "พบ"].includes(String(c.choice_label ?? "").trim())
    );
    const anyNo = existingChoices.find((c) =>
      ["ไม่ใช่", "ไม่พบ"].includes(String(c.choice_label ?? "").trim())
    );

    let yesChoice = anyYes;
    let noChoice = anyNo;

    if (!yesChoice) yesChoice = await ensureChoice({ choice_label: yesLabel });
    if (!noChoice) noChoice = await ensureChoice({ choice_label: noLabel });

    // ถ้า label ไม่ตรงโหมดที่เลือก → update label (toggle โหมดได้)
    if (String(yesChoice.choice_label ?? "").trim() !== yesLabel) {
      await updateAnswerApi({
        choice_id: yesChoice.choice_id,
        question_id: Number(questionId),
        choice_label: yesLabel,
      });
    }
    if (String(noChoice.choice_label ?? "").trim() !== noLabel) {
      await updateAnswerApi({
        choice_id: noChoice.choice_id,
        question_id: Number(questionId),
        choice_label: noLabel,
      });
    }

    // ✅ upsert score ลงตาราง scores
    await upsertScore({
      disease_id: Number(diseaseId),
      question_id: Number(questionId),
      choice_id: Number(yesChoice.choice_id),
      risk_score: Number(yesScore) || 0,
    });

    await upsertScore({
      disease_id: Number(diseaseId),
      question_id: Number(questionId),
      choice_id: Number(noChoice.choice_id),
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

    if (items.length === 0) {
      throw new Error("กรุณากรอกคำตอบอย่างน้อย 1 ข้อ");
    }

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
      if (questionType === "yes_no") {
        await saveYesNo();
      } else {
        await saveMultiOrNumeric();
      }

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

        <form onSubmit={handleSubmit}>
          {questionType === "yes_no" ? (
            <>
              <label style={{ display: "block", marginBottom: 6 }}>
                รูปแบบคำตอบ
              </label>
              <select
                value={yesNoMode}
                onChange={(e) => setYesNoMode(e.target.value)}
                style={{ width: "100%", marginBottom: 10 }}
              >
                <option value="yesno">ใช่ / ไม่ใช่</option>
                <option value="found">พบ / ไม่พบ</option>
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
                <div>
                  <label>คำตอบ</label>
                  <input
                    value={yesNoMode === "found" ? "พบ" : "ใช่"}
                    disabled
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label>คะแนน</label>
                  <input
                    type="number"
                    value={yesScore}
                    onChange={(e) => setYesScore(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <input
                    value={yesNoMode === "found" ? "ไม่พบ" : "ไม่ใช่"}
                    disabled
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <input
                    type="number"
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
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
