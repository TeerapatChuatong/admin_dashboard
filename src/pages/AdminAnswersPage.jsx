// src/pages/AdminAnswersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

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

function getQuestionId(q) {
  return q?.question_id ?? q?.id ?? "";
}

function getQuestionText(q) {
  return q?.question_text ?? q?.question ?? q?.text ?? "";
}

// สร้าง map: disease_id -> Set(question_id)
function buildDiseaseToQuestionIds(dqList) {
  const map = new Map();
  const arr = Array.isArray(dqList) ? dqList : [];

  arr.forEach((row) => {
    const did = String(row?.disease_id ?? row?.diseaseId ?? "").trim();
    const qid = String(row?.question_id ?? row?.questionId ?? "").trim();
    if (!did || !qid) return;

    if (!map.has(did)) map.set(did, new Set());
    map.get(did).add(qid);
  });

  return map;
}

export default function AdminAnswersPage() {
  const { user, logout } = useAuth();

  const [answers, setAnswers] = useState([]);

  const [diseases, setDiseases] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [diseaseQuestions, setDiseaseQuestions] = useState([]);

  const [selectedDiseaseId, setSelectedDiseaseId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editAnswer, setEditAnswer] = useState(null);

  // โหลดข้อมูลพื้นฐาน: โรค + คำถาม + pivot disease_questions
  useEffect(() => {
    (async () => {
      try {
        setError("");
        const [ds, qs, dqs] = await Promise.all([
          readDiseasesApi(),
          readQuestionsApi(),
          readDiseaseQuestionsApi(),
        ]);

        setDiseases(Array.isArray(ds) ? ds : []);
        setAllQuestions(Array.isArray(qs) ? qs : []);
        setDiseaseQuestions(Array.isArray(dqs) ? dqs : []);
      } catch (err) {
        setError(err.message || "โหลดข้อมูลเริ่มต้นไม่สำเร็จ");
        setDiseases([]);
        setAllQuestions([]);
        setDiseaseQuestions([]);
      }
    })();
  }, []);

  const diseaseToQids = useMemo(
    () => buildDiseaseToQuestionIds(diseaseQuestions),
    [diseaseQuestions]
  );

  // ✅ ถ้ายังไม่เลือกโรค -> ไม่แสดงคำถาม
  // ✅ ถ้าเลือกโรคแล้ว -> แสดงเฉพาะคำถามที่อยู่ใน disease_questions ของโรคนั้น
  const questionsForDisease = useMemo(() => {
    if (!selectedDiseaseId) return [];

    const set = diseaseToQids.get(String(selectedDiseaseId));
    if (!set || set.size === 0) return [];

    const list = allQuestions
      .filter((q) => set.has(String(getQuestionId(q))))
      .sort((a, b) => {
        const ao = Number(a.sort_order ?? a.order_no ?? 0);
        const bo = Number(b.sort_order ?? b.order_no ?? 0);
        if (ao !== bo) return ao - bo;
        return Number(getQuestionId(a)) - Number(getQuestionId(b));
      });

    return list;
  }, [selectedDiseaseId, allQuestions, diseaseToQids]);

  const currentQuestion = useMemo(() => {
    if (!selectedQuestionId) return null;
    return (
      allQuestions.find(
        (q) => String(getQuestionId(q)) === String(selectedQuestionId)
      ) || null
    );
  }, [allQuestions, selectedQuestionId]);

  const currentQuestionText = getQuestionText(currentQuestion);

  // โหลดคำตอบของคำถามที่เลือก
  async function loadAnswers(questionId = selectedQuestionId) {
    if (!questionId) {
      setAnswers([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await readAnswersApi(questionId);
      setAnswers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "โหลดคำตอบไม่สำเร็จ");
      setAnswers([]);
    } finally {
      setLoading(false);
    }
  }

  // เมื่อเลือกคำถาม → โหลดคำตอบ
  useEffect(() => {
    loadAnswers(selectedQuestionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuestionId]);

  // ค้นหาเฉพาะในคำถามที่เลือก
  useEffect(() => {
    let cancelled = false;

    if (!selectedQuestionId) return;

    if (!keyword.trim()) {
      loadAnswers(selectedQuestionId);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchAnswersApi({
          keyword: keyword.trim(),
          question_id: selectedQuestionId,
        });
        if (!cancelled) setAnswers(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "ค้นหาคำตอบไม่สำเร็จ");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, selectedQuestionId]);

  async function handleDelete(a) {
    const id = pick(a, ["choice_id", "answer_id", "id"]);
    if (!id) return alert("ไม่พบ ID ของคำตอบ");
    if (!window.confirm("ยืนยันลบคำตอบนี้?")) return;

    setError("");
    try {
      await deleteAnswerApi(id);
      await loadAnswers();
    } catch (err) {
      setError(err.message || "ลบคำตอบไม่สำเร็จ");
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

      {/* แถบเลือกโรค + คำถาม + ค้นหา */}
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
          style={{ minWidth: 200 }}
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

        {/* เลือกคำถาม: ถ้ายังไม่เลือกโรค -> disable */}
        <select
          value={selectedQuestionId}
          onChange={handleQuestionChange}
          style={{ minWidth: 360 }}
          disabled={!selectedDiseaseId}
        >
          <option value="">
            {!selectedDiseaseId
              ? "-- กรุณาเลือกโรคก่อน --"
              : questionsForDisease.length === 0
              ? "-- โรคนี้ยังไม่มีคำถาม --"
              : "-- เลือกคำถามของโรคนี้ --"}
          </option>

          {questionsForDisease.map((q) => {
            const id = getQuestionId(q);
            const text = getQuestionText(q);
            return (
              <option key={id} value={id}>
                {text}
              </option>
            );
          })}
        </select>

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
          disabled={!selectedQuestionId}
        >
          + เพิ่มคำตอบ
        </button>
      </div>

      {/* ตารางคำตอบ */}
      <div className="card">
        {!selectedDiseaseId ? (
          <div>กรุณาเลือกโรคก่อน</div>
        ) : !selectedQuestionId ? (
          <div>กรุณาเลือกคำถามของโรคที่เลือกก่อนเพื่อจัดการคำตอบ</div>
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
                const text = pick(a, [
                  "choice_label",
                  "answer_text",
                  "answer",
                  "text",
                ]);
                const score = pick(a, ["risk_score", "score", "points"], 0);

                return (
                  <tr key={id}>
                    <td>{id}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>
                      {currentQuestionText}
                    </td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{text}</td>
                    <td>{score}</td>
                    <td>
                      <button className="btn xs" onClick={() => setEditAnswer(a)}>
                        แก้ไข
                      </button>{" "}
                      <button
                        className="btn xs danger"
                        onClick={() => handleDelete(a)}
                      >
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
