// src/pages/AdminAnswersPage.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

import { readAnswersApi } from "../api/readAnswersApi";
import { searchAnswersApi } from "../api/searchAnswersApi";
import { deleteAnswerApi } from "../api/deleteAnswerApi";
import { readQuestionsApi } from "../api/readQuestionsApi";
import { readDiseasesApi } from "../api/readDiseasesApi";

import CreateAnswerModal from "../components/CreateAnswerModal";
import EditAnswerModal from "../components/EditAnswerModal";

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
}

/** กรองคำถามตามโรคที่เลือก */
function questionsByDisease(allQuestions, diseaseId) {
  if (!diseaseId) return [];

  const target = String(diseaseId);

  const filtered = allQuestions.filter((q) => {
    // ลองหาจากหลายฟิลด์ที่อาจมี disease_ids
    const diseaseIdsRaw = 
      q.disease_ids ?? 
      q.diseaseIds ?? 
      q.disease_id ?? 
      q.diseaseId ?? 
      "";

    if (!diseaseIdsRaw) return false;

    // แยก disease_ids ที่เป็น comma-separated
    const diseaseArray = String(diseaseIdsRaw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return diseaseArray.includes(target);
  });

  // คืนค่าเฉพาะคำถามที่กรองได้เท่านั้น
  // ถ้ากรองไม่เจอ = แสดงว่าโรคนี้ยังไม่มีคำถาม หรือ backend ยังไม่ส่ง disease_ids
  return filtered;
}

export default function AdminAnswersPage() {
  const { user, logout } = useAuth();

  const [answers, setAnswers] = useState([]);

  const [diseases, setDiseases] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editAnswer, setEditAnswer] = useState(null);

  // กรองคำถามตามโรคที่เลือก
  const questionsForDisease = React.useMemo(
    () => questionsByDisease(allQuestions, selectedDiseaseId),
    [allQuestions, selectedDiseaseId]
  );

  const currentQuestion = React.useMemo(() => {
    if (!selectedQuestionId) return null;
    return (
      allQuestions.find(
        (q) => String(q.question_id ?? q.id) === String(selectedQuestionId)
      ) || null
    );
  }, [allQuestions, selectedQuestionId]);

  const currentQuestionText = currentQuestion
    ? currentQuestion.question_text ||
      currentQuestion.question ||
      currentQuestion.text ||
      ""
    : "";

  // โหลดโรคและคำถามตอนเริ่มต้น
  useEffect(() => {
    (async () => {
      try {
        const [ds, qs] = await Promise.all([
          readDiseasesApi(),
          readQuestionsApi(),
        ]);
        setDiseases(Array.isArray(ds) ? ds : []);
        setAllQuestions(Array.isArray(qs) ? qs : []);
      } catch (err) {
        setError(err.message || "โหลดข้อมูลเริ่มต้นไม่สำเร็จ");
      }
    })();
  }, []);

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

  useEffect(() => {
    loadAnswers(selectedQuestionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuestionId]);

  // ค้นหาคำตอบ
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
        if (!cancelled) {
          setAnswers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "ค้นหาคำตอบไม่สำเร็จ");
        }
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
      setError(err.message || "ลบคำตอบไม่สำเร็จ");
    }
  }

  function handleDiseaseChange(e) {
    const value = e.target.value;
    setSelectedDiseaseId(value);
    setSelectedQuestionId(""); // รีเซ็ตคำถามเมื่อเปลี่ยนโรค
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

        {/* เลือกคำถามของโรค */}
        <select
          value={selectedQuestionId}
          onChange={handleQuestionChange}
          style={{ minWidth: 260 }}
          disabled={!selectedDiseaseId}
        >
          <option value="">
            {selectedDiseaseId
              ? questionsForDisease.length > 0
                ? "-- เลือกคำถามของโรคนี้ --"
                : "-- ไม่มีคำถามสำหรับโรคนี้ --"
              : "-- กรุณาเลือกโรคก่อน --"}
          </option>
          {questionsForDisease.map((q) => {
            const id = q.question_id ?? q.id;
            const text = q.question_text || q.question || q.text || "";
            return (
              <option key={id} value={id}>
                {text}
              </option>
            );
          })}
        </select>

        {/* แสดงจำนวนคำถามที่กรองได้ */}
        {selectedDiseaseId && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            ({questionsForDisease.length} คำถาม)
          </span>
        )}

        {/* ค้นหาในคำตอบของคำถามที่เลือก */}
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
                const text = pick(a, [
                  "choice_label",
                  "answer_text",
                  "answer",
                  "text",
                ]);
                const score = pick(a, ["score", "points"], 0);

                return (
                  <tr key={id}>
                    <td>{id}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>
                      {currentQuestionText}
                    </td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{text}</td>
                    <td>{score}</td>
                    <td>
                      <button
                        className="btn xs"
                        onClick={() => setEditAnswer(a)}
                      >
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