// src/pages/AdminAnswersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

import { API_BASE, toJsonOrError } from "../api/apiClient";

import { readAnswersApi } from "../api/readAnswersApi";
import { searchAnswersApi } from "../api/searchAnswersApi";
import { deleteAnswerApi } from "../api/deleteAnswerApi";
import { readQuestionsApi } from "../api/readQuestionsApi";
import { readDiseasesApi } from "../api/readDiseasesApi";
import { readDiseaseQuestionsApi } from "../api/readDiseaseQuestionsApi";

import CreateAnswerModal from "../components/CreateAnswerModal";
import EditAnswerModal from "../components/EditAnswerModal";

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

async function fetchScoresMap({ disease_id, question_id }) {
  // ✅ ดึงคะแนนจาก scores เพื่อ merge เข้า choices (แก้ปัญหาแสดง 0)
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

function qText(q) {
  return String(q?.question_text ?? q?.question ?? q?.text ?? "");
}

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

  // ✅ คำถามของโรค (จาก pivot disease_questions)
  const questionsForDisease = useMemo(() => {
    if (!selectedDiseaseId) return [];

    const did = String(selectedDiseaseId);
    const qIds = new Set(
      diseaseQuestions
        .filter((r) => String(r.disease_id ?? r.diseaseId) === did)
        .map((r) => String(r.question_id ?? r.questionId))
        .filter(Boolean)
    );

    const filtered = allQuestions.filter((q) =>
      qIds.has(String(q.question_id ?? q.id))
    );

    // sort ตาม sort_order ถ้ามี
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
      allQuestions.find(
        (q) => String(q.question_id ?? q.id) === String(selectedQuestionId)
      ) || null
    );
  }, [allQuestions, selectedQuestionId]);

  const currentQuestionText = currentQuestion ? qText(currentQuestion) : "";

  useEffect(() => {
    (async () => {
      try {
        const [ds, qs, dqs] = await Promise.all([
          readDiseasesApi(),
          readQuestionsApi(),
          readDiseaseQuestionsApi(),
        ]);
        setDiseases(Array.isArray(ds) ? ds : extractList(ds));
        setAllQuestions(Array.isArray(qs) ? qs : extractList(qs));
        setDiseaseQuestions(Array.isArray(dqs) ? dqs : extractList(dqs));
      } catch (err) {
        setError(err?.message || "โหลดข้อมูลเริ่มต้นไม่สำเร็จ");
      }
    })();
  }, []);

  async function loadAnswers(questionId = selectedQuestionId) {
    if (!questionId || !selectedDiseaseId) {
      setAnswers([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1) อ่าน choices ของคำถาม
      const choices = await readAnswersApi(questionId);
      const list = Array.isArray(choices) ? choices : extractList(choices);

      // 2) อ่าน scores แล้ว merge ใส่แต่ละ choice (fix score 0)
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
    } catch (err) {
      setError(err?.message || "โหลดคำตอบไม่สำเร็จ");
      setAnswers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnswers(selectedQuestionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuestionId, selectedDiseaseId]);

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
        const data = await searchAnswersApi({
          keyword: kw,
          question_id: selectedQuestionId,
        });

        const list = Array.isArray(data) ? data : extractList(data);

        // merge scores อีกครั้ง (เพราะ search ก็ต้องโชว์คะแนน)
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

        if (!cancelled) setAnswers(merged);
      } catch (err) {
        if (!cancelled) setError(err?.message || "ค้นหาคำตอบไม่สำเร็จ");
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
    if (!id) {
      alert("ไม่พบ ID ของคำตอบ");
      return;
    }
    if (!window.confirm("ยืนยันลบคำตอบนี้?")) return;

    setError("");
    try {
      await deleteAnswerApi(id);
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
  }

  function handleQuestionChange(e) {
    const value = e.target.value;
    setSelectedQuestionId(value);
    setKeyword("");
  }

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
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        {/* เลือกโรค */}
        <select
          value={selectedDiseaseId}
          onChange={handleDiseaseChange}
          style={{ minWidth: 220 }}
        >
          <option value="">-- เลือกโรค --</option>
          {diseases.map((d) => (
            <option key={d.disease_id} value={d.disease_id}>
              {d.disease_th ||
                d.disease_en ||
                d.name_th ||
                d.name_en ||
                d.disease_slug ||
                d.disease_id}
            </option>
          ))}
        </select>

        {/* เลือกคำถามของโรค */}
        <select
          value={selectedQuestionId}
          onChange={handleQuestionChange}
          style={{ minWidth: 320 }}
          disabled={!selectedDiseaseId}
        >
          <option value="">
            {!selectedDiseaseId
              ? "-- กรุณาเลือกโรคก่อน --"
              : questionsForDisease.length === 0
              ? "-- ยังไม่มีคำถามของโรคนี้ --"
              : "-- เลือกคำถามของโรคนี้ --"}
          </option>

          {questionsForDisease.map((q) => {
            const id = q.question_id ?? q.id;
            return (
              <option key={id} value={id}>
                {qText(q)}
              </option>
            );
          })}
        </select>

        {/* ค้นหา */}
        <input
          placeholder="ค้นหาคำตอบ / ID"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
          disabled={!selectedQuestionId}
        />

        {searching && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>กำลังค้นหา...</span>
        )}

        <button
          className="btn ghost"
          onClick={() => setKeyword("")}
          disabled={!selectedQuestionId}
        >
          รีเซ็ต
        </button>

        <button
          className="btn"
          onClick={() => setOpenCreate(true)}
          disabled={!selectedQuestionId || !selectedDiseaseId}
        >
          + เพิ่มคำตอบ
        </button>
      </div>

      <div className="card">
        {!selectedQuestionId ? (
          <div>กรุณาเลือกโรคและคำถามด้านบนก่อนเพื่อจัดการคำตอบ</div>
        ) : loading ? (
          <div>กำลังโหลด...</div>
        ) : answers.length === 0 ? (
          <div>ไม่พบข้อมูลคำตอบของคำถามนี้</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>คำถาม</th>
                <th>คำตอบ</th>
                <th>คะแนน</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {answers.map((a) => {
                const id = pick(a, ["choice_id", "answer_id", "id"]);
                const text = pick(a, ["choice_label", "answer_text", "answer", "text"]);
                const score = pick(a, ["risk_score", "score_value", "score", "points"], 0);

                return (
                  <tr key={id}>
                    <td>{id}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{currentQuestionText}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{text}</td>
                    <td>{Number(score) || 0}</td>
                    <td>
                      <button className="btn xs" onClick={() => setEditAnswer(a)}>
                        แก้ไข
                      </button>{" "}
                      <button className="btn xs danger" onClick={() => handleDelete(a)}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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
