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

function defaultsByMode(mode) {
  switch (mode) {
    case "found":
      return ["พบ", "ไม่พบ"];
    case "used":
      return ["เคยใช้", "ไม่เคยใช้"];
    case "cut":
      return ["เคยตัด", "ไม่เคยตัด"];
    case "yesno":
    default:
      return ["ใช่", "ไม่ใช่"];
  }
}

export default function CreateAnswerModal({ question, diseaseId, onClose, onSuccess }) {
  const questionId = useMemo(() => String(qId(question) || ""), [question]);
  const questionText = useMemo(() => qText(question), [question]);
  const questionType = useMemo(() => qType(question), [question]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [existingChoices, setExistingChoices] = useState([]);

  // ✅ ยังมี dropdown แต่ช่องคำตอบพิมพ์ได้
  const [yesNoMode, setYesNoMode] = useState("yesno"); // yesno | found | used | cut
  const [opt1Id, setOpt1Id] = useState(null);
  const [opt2Id, setOpt2Id] = useState(null);

  const [opt1Label, setOpt1Label] = useState("ใช่");
  const [opt2Label, setOpt2Label] = useState("ไม่ใช่");

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

        // ✅ ถ้ามี choice เดิม -> ใช้ 2 ตัวแรก (ตาม choice_id) มาเป็นค่าเริ่มต้น
        const getCid = (c) => c?.choice_id ?? c?.id ?? c?.choiceId ?? null;
        const sorted = [...list].sort(
          (a, b) => Number(getCid(a) || 0) - Number(getCid(b) || 0)
        );

        if (sorted[0]) {
          setOpt1Id(getCid(sorted[0]));
          setOpt1Label(String(sorted[0].choice_label ?? "").trim() || "ใช่");
        } else {
          const [a] = defaultsByMode(yesNoMode);
          setOpt1Id(null);
          setOpt1Label(a);
        }

        if (sorted[1]) {
          setOpt2Id(getCid(sorted[1]));
          setOpt2Label(String(sorted[1].choice_label ?? "").trim() || "ไม่ใช่");
        } else {
          const [, b] = defaultsByMode(yesNoMode);
          setOpt2Id(null);
          setOpt2Label(b);
        }

        // โหลดคะแนนเดิมของ 2 choice (ถ้ามี)
        if (diseaseId && (sorted[0] || sorted[1])) {
          const scoreMap = await fetchScoresMap({
            disease_id: diseaseId,
            question_id: questionId,
          });

          if (sorted[0]) {
            const row = scoreMap.get(String(getCid(sorted[0])));
            if (row) setYesScore(Number(row.risk_score ?? row.score_value ?? 0) || 0);
          }
          if (sorted[1]) {
            const row = scoreMap.get(String(getCid(sorted[1])));
            if (row) setNoScore(Number(row.risk_score ?? row.score_value ?? 0) || 0);
          }
        }
      } catch {
        // ไม่ต้อง block UI
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, diseaseId]);

  function onChangeMode(mode) {
    setYesNoMode(mode);
    const [a, b] = defaultsByMode(mode);
    // ✅ เปลี่ยนเป็นค่าตามโหมด แต่ยังพิมพ์แก้ได้
    setOpt1Label(a);
    setOpt2Label(b);
  }

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

    await createScoreApi({ disease_id, question_id, choice_id, risk_score });
  }

  async function ensureChoice({ choice_label }) {
    const found = existingChoices.find(
      (c) => String(c.choice_label ?? "").trim() === String(choice_label).trim()
    );
    if (found) return found;

    const created = await createAnswerApi({
      question_id: Number(questionId),
      choice_label: String(choice_label),
    });

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
    const label1 = String(opt1Label ?? "").trim();
    const label2 = String(opt2Label ?? "").trim();

    if (!label1 || !label2) throw new Error("กรุณากรอกคำตอบทั้ง 2 ช่อง");
    if (label1 === label2) throw new Error("คำตอบทั้ง 2 ช่องต้องไม่ซ้ำกัน");

    const getCid = (c) => c?.choice_id ?? c?.id ?? c?.choiceId ?? null;

    // หา choice ตาม id ก่อน ถ้าไม่เจอค่อยหาโดย label
    let c1 =
      (opt1Id ? existingChoices.find((c) => String(getCid(c)) === String(opt1Id)) : null) ||
      existingChoices.find((c) => String(c.choice_label ?? "").trim() === label1) ||
      null;

    let c2 =
      (opt2Id ? existingChoices.find((c) => String(getCid(c)) === String(opt2Id)) : null) ||
      existingChoices.find((c) => String(c.choice_label ?? "").trim() === label2) ||
      null;

    if (!c1) c1 = await ensureChoice({ choice_label: label1 });
    if (!c2) c2 = await ensureChoice({ choice_label: label2 });

    const cid1 = getCid(c1);
    const cid2 = getCid(c2);

    // update label ให้ตรงกับที่พิมพ์
    if (String(c1.choice_label ?? "").trim() !== label1) {
      await updateAnswerApi({
        choice_id: Number(cid1),
        question_id: Number(questionId),
        choice_label: label1,
      });
    }

    if (String(c2.choice_label ?? "").trim() !== label2) {
      await updateAnswerApi({
        choice_id: Number(cid2),
        question_id: Number(questionId),
        choice_label: label2,
      });
    }

    setOpt1Id(cid1);
    setOpt2Id(cid2);

    // upsert score
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

              {/* ✅ พิมพ์ได้ทั้ง 2 ช่อง */}
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
