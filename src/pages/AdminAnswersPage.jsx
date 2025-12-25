// src/pages/AdminAnswersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

import { API_BASE, toJsonOrError } from "../api/apiClient";

import CreateAnswerModal from "../components/CreateAnswerModal";
import EditAnswerModal from "../components/EditAnswerModal";

// ---------------- helpers ----------------
function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
}

function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function getAuthToken() {
  try {
    const u = JSON.parse(localStorage.getItem("auth_user") || "null");
    return u?.token ? String(u.token) : "";
  } catch {
    return "";
  }
}

async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}

async function apiGet(url, errMsg) {
  const res = await authFetch(url, { method: "GET" });
  return toJsonOrError(res, errMsg);
}

async function apiDelete(url, errMsg) {
  const res = await authFetch(url, { method: "DELETE" });
  return toJsonOrError(res, errMsg);
}

async function readDiseases() {
  const data = await apiGet(`${API_BASE}/diseases/read_diseases.php`, "โหลดโรคไม่สำเร็จ");
  return extractList(data);
}

async function readQuestions() {
  const data = await apiGet(`${API_BASE}/questions/read_questions.php`, "โหลดคำถามไม่สำเร็จ");
  return extractList(data);
}

async function readDiseaseQuestions() {
  const data = await apiGet(
    `${API_BASE}/disease_questions/read_disease_questions.php`,
    "โหลดคำถามของโรคไม่สำเร็จ"
  );
  return extractList(data);
}

async function readChoices(question_id) {
  const url = `${API_BASE}/choices/read_choices.php?question_id=${encodeURIComponent(question_id)}`;
  const data = await apiGet(url, "โหลดคำตอบไม่สำเร็จ");
  return extractList(data);
}

async function searchChoices({ keyword, question_id }) {
  const url = `${API_BASE}/choices/search_choices.php?q=${encodeURIComponent(
    keyword
  )}&question_id=${encodeURIComponent(question_id)}`;
  const data = await apiGet(url, "ค้นหาคำตอบไม่สำเร็จ");
  return extractList(data);
}

async function deleteChoice(choice_id) {
  const url = `${API_BASE}/choices/delete_choices.php?choice_id=${encodeURIComponent(choice_id)}`;
  return apiDelete(url, "ลบคำตอบไม่สำเร็จ");
}

async function fetchScoresMap({ disease_id, question_id }) {
  if (!disease_id || !question_id) return new Map();

  const url = `${API_BASE}/scores/read_scores.php?disease_id=${encodeURIComponent(
    disease_id
  )}&question_id=${encodeURIComponent(question_id)}`;

  const data = await apiGet(url, "โหลดคะแนนไม่สำเร็จ");
  const list = extractList(data);

  const map = new Map(); // choice_id -> scoreRow
  for (const s of list) {
    const cid = String(s.choice_id ?? s.choiceId ?? "");
    if (!cid) continue;
    map.set(cid, s);
  }
  return map;
}

function qText(q) {
  return String(q?.question_text ?? q?.question ?? q?.text ?? "");
}

// ✅ ดึง max_score แบบกันได้หลายชื่อฟิลด์
function qMax(q) {
  const v = q?.max_score ?? q?.maxScore ?? q?.max ?? null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null; // null = ไม่กำหนดเพดาน
}

function calcSummaryFromScoreMap(scoreMap, maxScore) {
  let total = 0;
  for (const s of scoreMap.values()) {
    const v = Number(s?.score_value ?? s?.risk_score ?? s?.score ?? 0) || 0;
    total += v;
  }

  const max = maxScore != null ? Number(maxScore) : null;
  const hasMax = Number.isFinite(max) && max > 0;
  const remaining = hasMax ? max - total : null;
  const exceed = hasMax ? total > max : false;

  return {
    total,
    max_score: hasMax ? max : null,
    remaining,
    exceed,
  };
}

// ---------------- page ----------------
export default function AdminAnswersPage() {
  const { user, logout } = useAuth();

  const [answers, setAnswers] = useState([]);

  const [diseases, setDiseases] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [diseaseQuestions, setDiseaseQuestions] = useState([]); // pivot rows

  const [selectedDiseaseId, setSelectedDiseaseId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editAnswer, setEditAnswer] = useState(null);

  // ✅ summary คะแนนรวม/คงเหลือ
  const [scoreSummary, setScoreSummary] = useState({
    total: 0,
    max_score: null,
    remaining: null,
    exceed: false,
  });

  const filteredQuestions = useMemo(() => {
    if (!selectedDiseaseId) return [];

    const did = String(selectedDiseaseId);
    const qIds = new Set(
      diseaseQuestions
        .filter((r) => String(r.disease_id ?? r.diseaseId) === did)
        .map((r) => String(r.question_id ?? r.questionId))
        .filter(Boolean)
    );

    const filtered = allQuestions.filter((q) => qIds.has(String(q.question_id ?? q.id)));

    filtered.sort((a, b) => {
      const ao = Number(a.sort_order ?? a.order_index ?? 0);
      const bo = Number(b.sort_order ?? b.order_index ?? 0);
      if (ao !== bo) return ao - bo;
      return Number(a.question_id ?? a.id ?? 0) - Number(b.question_id ?? b.id ?? 0);
    });

    return filtered;
  }, [allQuestions, diseaseQuestions, selectedDiseaseId]);

  const currentQuestion = useMemo(() => {
    if (!selectedQuestionId) return null;
    return (
      allQuestions.find((q) => String(q.question_id ?? q.id) === String(selectedQuestionId)) ||
      null
    );
  }, [allQuestions, selectedQuestionId]);

  const currentQuestionText = currentQuestion ? qText(currentQuestion) : "";
  const currentMaxScore = currentQuestion ? qMax(currentQuestion) : null;

  // ✅ NEW: ปิดปุ่มเพิ่มคำตอบ เมื่อ remaining <= 0 (มี max_score)
  const addDisabled =
    !selectedQuestionId ||
    !selectedDiseaseId ||
    (scoreSummary?.max_score != null && Number(scoreSummary?.remaining ?? 999999) <= 0);

  const addDisabledTitle =
    !selectedDiseaseId
      ? "กรุณาเลือกโรคก่อน"
      : !selectedQuestionId
      ? "กรุณาเลือกคำถามก่อน"
      : scoreSummary?.max_score != null && Number(scoreSummary?.remaining ?? 0) <= 0
      ? "คะแนนคงเหลือเป็น 0 (เต็มแล้ว) จึงไม่สามารถเพิ่มคำตอบใหม่ได้"
      : "";

  useEffect(() => {
    (async () => {
      try {
        const [ds, qs, dqs] = await Promise.all([
          readDiseases(),
          readQuestions(),
          readDiseaseQuestions(),
        ]);
        setDiseases(ds);
        setAllQuestions(qs);
        setDiseaseQuestions(dqs);
      } catch (err) {
        setError(err?.message || "โหลดข้อมูลเริ่มต้นไม่สำเร็จ");
      }
    })();
  }, []);

  async function loadAnswers(questionId = selectedQuestionId) {
    if (!questionId || !selectedDiseaseId) {
      setAnswers([]);
      setScoreSummary({ total: 0, max_score: null, remaining: null, exceed: false });
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1) choices
      const list = await readChoices(questionId);

      // 2) scores map
      const scoreMap = await fetchScoresMap({
        disease_id: selectedDiseaseId,
        question_id: questionId,
      });

      const merged = list.map((c) => {
        const cid = String(c.choice_id ?? c.id ?? "");
        const s = scoreMap.get(cid);

        const risk_score =
          s?.risk_score ??
          s?.score_value ??
          s?.score ??
          c?.risk_score ??
          c?.score_value ??
          c?.score ??
          0;

        return {
          ...c,
          risk_score,
          _score_id: s?.score_id ?? s?.id ?? null,
        };
      });

      setAnswers(merged);

      // ✅ summary คะแนนรวม/คงเหลือ
      const summary = calcSummaryFromScoreMap(scoreMap, currentMaxScore);
      setScoreSummary(summary);
    } catch (err) {
      setError(err?.message || "โหลดคำตอบไม่สำเร็จ");
      setAnswers([]);
      setScoreSummary({
        total: 0,
        max_score: currentMaxScore ?? null,
        remaining: null,
        exceed: false,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnswers(selectedQuestionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuestionId, selectedDiseaseId]);

  // search
  useEffect(() => {
    let cancelled = false;
    if (!selectedQuestionId || !selectedDiseaseId) return;

    const kw = String(keyword ?? "").trim();
    if (!kw) {
      loadAnswers(selectedQuestionId);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const list = await searchChoices({ keyword: kw, question_id: selectedQuestionId });

        const scoreMap = await fetchScoresMap({
          disease_id: selectedDiseaseId,
          question_id: selectedQuestionId,
        });

        const merged = list.map((c) => {
          const cid = String(c.choice_id ?? c.id ?? "");
          const s = scoreMap.get(cid);

          const risk_score =
            s?.risk_score ??
            s?.score_value ??
            s?.score ??
            c?.risk_score ??
            c?.score_value ??
            c?.score ??
            0;

          return {
            ...c,
            risk_score,
            _score_id: s?.score_id ?? s?.id ?? null,
          };
        });

        if (!cancelled) {
          setAnswers(merged);

          // ✅ summary ต้องเป็นทั้งคำถาม ไม่ใช่เฉพาะผลค้นหา
          const summary = calcSummaryFromScoreMap(scoreMap, currentMaxScore);
          setScoreSummary(summary);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "ค้นหาไม่สำเร็จ");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, selectedQuestionId, selectedDiseaseId]);

  async function handleDelete(a) {
    const id = pick(a, ["choice_id", "answer_id", "id"]);
    if (!id) return alert("ไม่พบ ID ของคำตอบ");
    if (!window.confirm("ยืนยันลบคำตอบนี้?")) return;

    setError("");
    try {
      await deleteChoice(id);
      await loadAnswers();
    } catch (err) {
      setError(err?.message || "ลบคำตอบไม่สำเร็จ");
    }
  }

  function handleDiseaseChange(e) {
    const value = e.target.value;
    setSelectedDiseaseId(value);
    setSelectedQuestionId("");
    setKeyword("");
    setAnswers([]);
    setScoreSummary({ total: 0, max_score: null, remaining: null, exceed: false });
  }

  function handleQuestionChange(e) {
    const value = e.target.value;
    setSelectedQuestionId(value);
    setKeyword("");
  }

  // auto pick first question when choose disease
  useEffect(() => {
    if (!selectedDiseaseId) return;
    if (selectedQuestionId) return;

    const first = filteredQuestions[0];
    if (first) setSelectedQuestionId(String(first.question_id ?? first.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiseaseId, filteredQuestions]);

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/admin" className="btn ghost">
            ← กลับหน้าหลัก
          </a>
          <h1 style={{ margin: 0 }}>จัดการคำตอบ</h1>
        </div>

        <div className="header-right">
          <span>
            เข้าสู่ระบบเป็น: {user?.username ?? user?.email} ({user?.role})
          </span>
          <button className="btn ghost" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <div
        className="card"
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
      >
        {/* เลือกโรค */}
        <select value={selectedDiseaseId} onChange={handleDiseaseChange} style={{ minWidth: 220 }}>
          <option value="">-- เลือกโรค --</option>
          {diseases.map((d) => (
            <option key={d.disease_id} value={d.disease_id}>
              {d.disease_th ||
                d.disease_en ||
                d.name_th ||
                d.name_en ||
                d.disease_name ||
                d.disease_slug ||
                d.disease_id}
            </option>
          ))}
        </select>

        {/* เลือกคำถามของโรค */}
        <select
          value={selectedQuestionId}
          onChange={handleQuestionChange}
          style={{ minWidth: 320, flex: 1 }}
          disabled={!selectedDiseaseId}
        >
          <option value="">-- เลือกคำถาม --</option>
          {filteredQuestions.map((q) => (
            <option key={q.question_id ?? q.id} value={q.question_id ?? q.id}>
              {String(qText(q)).slice(0, 80)}
            </option>
          ))}
        </select>

        {/* ค้นหา */}
        <input
          placeholder="ค้นหาคำตอบ..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
          disabled={!selectedQuestionId}
        />

        {searching && <span style={{ fontSize: 12, color: "#6b7280" }}>กำลังค้นหา...</span>}

        <button className="btn ghost" onClick={() => setKeyword("")} disabled={!selectedQuestionId}>
          รีเซ็ต
        </button>

        {/* ✅ ปุ่มเพิ่มคำตอบ: ปิดเมื่อ remaining <= 0 */}
        <button
          className="btn"
          onClick={() => setOpenCreate(true)}
          disabled={addDisabled}
          title={addDisabledTitle}
        >
          + เพิ่มคำตอบ
        </button>
      </div>

      {/* สรุปคะแนนรวม/คงเหลือ */}
      {selectedDiseaseId && selectedQuestionId && (
        <div className="card" style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>สรุปคะแนนของคำถาม</div>

          <div style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>
            <b>คำถาม:</b> {currentQuestionText || "-"}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>คะแนนรวมของคำตอบทั้งหมด</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{scoreSummary.total}</div>
            </div>

            {scoreSummary.max_score ? (
              <>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>คะแนนสูงสุด (max_score)</div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{scoreSummary.max_score}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>คะแนนคงเหลือ</div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{scoreSummary.remaining}</div>
                </div>

                {scoreSummary.exceed && (
                  <div className="alert error" style={{ margin: 0 }}>
                    คะแนนรวมเกินกำหนด (เกิน {Math.abs(scoreSummary.remaining)} คะแนน)
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                (ยังไม่ได้กำหนด max_score สำหรับคำถามนี้)
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>รายการคำตอบ</h3>
          {loading && <span style={{ fontSize: 12, color: "#6b7280" }}>กำลังโหลด...</span>}
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>ID</th>
                <th>คำตอบ</th>
                <th style={{ width: 140 }}>คะแนน</th>
                <th style={{ width: 220 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {answers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: "#6b7280" }}>
                    {selectedQuestionId ? "ไม่มีคำตอบ" : "กรุณาเลือกโรคและคำถาม"}
                  </td>
                </tr>
              ) : (
                answers.map((a) => {
                  const id = pick(a, ["choice_id", "answer_id", "id"], "-");
                  const label = pick(a, ["choice_label", "answer_text", "label"], "-");
                  const score = pick(a, ["risk_score", "score_value", "score"], 0);

                  return (
                    <tr key={String(id)}>
                      <td>{id}</td>
                      <td style={{ whiteSpace: "pre-wrap" }}>{label}</td>
                      <td>{score}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn" onClick={() => setEditAnswer(a)}>
                            แก้ไข
                          </button>
                          <button className="btn danger" onClick={() => handleDelete(a)}>
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openCreate && (
        <CreateAnswerModal
          question={currentQuestion}
          diseaseId={selectedDiseaseId}
          onClose={() => setOpenCreate(false)}
          onSuccess={async () => {
            setOpenCreate(false);
            await loadAnswers();
          }}
        />
      )}

      {editAnswer && (
        <EditAnswerModal
          answer={editAnswer}
          question={currentQuestion}
          diseaseId={selectedDiseaseId}
          onClose={() => setEditAnswer(null)}
          onSuccess={async () => {
            setEditAnswer(null);
            await loadAnswers();
          }}
        />
      )}
    </div>
  );
}
