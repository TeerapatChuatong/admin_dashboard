// src/pages/AdminAnswersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

import { API_BASE, toJsonOrError } from "../api/apiClient";
import { deleteAnswerApi } from "../api/deleteAnswerApi";
import CreateAnswerModal from "../components/CreateAnswerModal";
import EditAnswerModal from "../components/EditAnswerModal";

function getAuthToken() {
  try {
    const u = JSON.parse(localStorage.getItem("auth_user") || "null");
    return u?.token ? String(u.token) : "";
  } catch {
    return "";
  }
}

async function authFetch(url, opts = {}) {
  const token = getAuthToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "")
      return obj[k];
  }
  return fallback;
}

async function readDiseases() {
  const res = await authFetch(`${API_BASE}/diseases/read_diseases.php`);
  const data = await toJsonOrError(res, "โหลดรายชื่อโรคไม่สำเร็จ");
  const rows = data?.data || data || [];
  return Array.isArray(rows) ? rows : [];
}

async function readDiseaseQuestions(diseaseId) {
  const res = await authFetch(
    `${API_BASE}/disease_questions/read_disease_questions.php?disease_id=${encodeURIComponent(
      diseaseId
    )}`
  );
  const data = await toJsonOrError(res, "โหลดคำถามของโรคไม่สำเร็จ");
  const rows = data?.data || data || [];
  return Array.isArray(rows) ? rows : [];
}

async function readQuestionsByIds(questionIds = []) {
  if (!questionIds.length) return [];
  const res = await authFetch(`${API_BASE}/questions/read_questions.php`);
  const data = await toJsonOrError(res, "โหลดรายการคำถามไม่สำเร็จ");
  const rows = data?.data || data || [];
  const set = new Set(questionIds.map(String));
  return (Array.isArray(rows) ? rows : []).filter((q) =>
    set.has(String(q.question_id ?? q.id))
  );
}

async function readChoices(questionId) {
  const res = await authFetch(
    `${API_BASE}/choices/read_choices.php?question_id=${encodeURIComponent(
      questionId
    )}`
  );
  const data = await toJsonOrError(res, "โหลดคำตอบไม่สำเร็จ");
  const rows = data?.data || data || [];
  return Array.isArray(rows) ? rows : [];
}

async function fetchScoresMap({ disease_id, question_id }) {
  const res = await authFetch(
    `${API_BASE}/scores/read_scores.php?disease_id=${encodeURIComponent(
      disease_id
    )}&question_id=${encodeURIComponent(question_id)}`
  );
  const data = await toJsonOrError(res, "โหลดคะแนนไม่สำเร็จ");
  const rows = data?.data || data || [];
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const cid = String(r.choice_id ?? r.id ?? "");
    if (!cid) return;
    map.set(cid, r);
  });
  return map;
}

const centerCell = {
  textAlign: "center",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};
const btnCell = { display: "flex", gap: 8, justifyContent: "center" };

function questionTypeLabel(type) {
  const t = String(type || "");
  if (t === "yes_no") return "ใช่ / ไม่ใช่";
  if (t === "numeric") return "ตัวเลข";
  if (t === "multi") return "ตัวเลือก";
  return t || "-";
}

export default function AdminAnswersPage() {
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [diseases, setDiseases] = useState([]);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState("");

  const [questions, setQuestions] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");

  const [answers, setAnswers] = useState([]); // all (merged with score)
  const [keyword, setKeyword] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editOptions, setEditOptions] = useState([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const ds = await readDiseases();
        if (!alive) return;
        setDiseases(ds);
        if (!selectedDiseaseId && ds.length) {
          setSelectedDiseaseId(String(ds[0].disease_id ?? ds[0].id));
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDiseaseId) return;
    let alive = true;
    setLoading(true);
    setError("");
    setQuestions([]);
    setSelectedQuestionId("");
    setAnswers([]);
    (async () => {
      try {
        const dq = await readDiseaseQuestions(selectedDiseaseId);
        const qids = dq
          .map((x) => x.question_id ?? x.id)
          .filter((x) => x !== undefined && x !== null)
          .map(String);

        const qs = await readQuestionsByIds(qids);

        const byId = new Map(qs.map((q) => [String(q.question_id ?? q.id), q]));
        const merged = dq
          .map((x) => {
            const qid = String(x.question_id ?? x.id ?? "");
            const q = byId.get(qid) || {};
            return {
              ...x,
              question_id: qid,
              question_text: x.question_text ?? q.question_text ?? q.text ?? "",
              question_type: x.question_type ?? q.question_type ?? "multi",
              max_score: x.max_score ?? q.max_score ?? null,
            };
          })
          .filter((x) => x.question_id);

        if (!alive) return;
        setQuestions(merged);

        if (merged.length) {
          setSelectedQuestionId(String(merged[0].question_id));
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedDiseaseId]);

  const selectedDiseaseName = useMemo(() => {
    const d = diseases.find(
      (x) => String(x.disease_id ?? x.id) === String(selectedDiseaseId)
    );
    return (
      d?.disease_name ??
      d?.name ??
      d?.disease_th ??
      d?.disease_en ??
      (selectedDiseaseId ? `Disease ${selectedDiseaseId}` : "-")
    );
  }, [diseases, selectedDiseaseId]);

  const currentQuestion = useMemo(() => {
    if (!selectedQuestionId) return null;
    return (
      questions.find((q) => String(q.question_id) === String(selectedQuestionId)) ||
      null
    );
  }, [questions, selectedQuestionId]);

  const currentMaxScore = useMemo(() => {
    const ms = currentQuestion?.max_score;
    const n = Number(ms);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [currentQuestion]);

  // ✅ สรุปคะแนน: รวม / สูงสุด / คงเหลือ
  const scoreSummary = useMemo(() => {
    const total = answers.reduce((sum, a) => {
      const v = Number(pick(a, ["risk_score", "score_value", "score"], 0) || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const max = currentMaxScore ?? null;
    const remain = max == null ? null : Math.max(0, max - total);
    return { total, max, remain };
  }, [answers, currentMaxScore]);

  const filteredAnswers = useMemo(() => {
    const kw = String(keyword || "").trim().toLowerCase();
    if (!kw) return answers;
    return answers.filter((a) => {
      const t = String(
        pick(a, ["choice_text", "choice_label", "answer_text", "label"], "") || ""
      ).toLowerCase();
      return t.includes(kw);
    });
  }, [answers, keyword]);

  async function loadAnswers() {
    if (!selectedDiseaseId || !selectedQuestionId) {
      setAnswers([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const list = await readChoices(selectedQuestionId);
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

      setAnswers(merged);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnswers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuestionId]);

  async function handleDelete(a) {
    const id = pick(a, ["choice_id", "answer_id", "id"], null);
    if (!id) return;
    const ok = window.confirm("ยืนยันลบคำตอบนี้?");
    if (!ok) return;

    setLoading(true);
    setError("");
    try {
      await deleteAnswerApi({ choice_id: Number(id) });
      await loadAnswers();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function openEditModal() {
    if (!selectedQuestionId || !selectedDiseaseId) return;

    setError("");
    try {
      const list = await readChoices(selectedQuestionId);

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

      setEditOptions(
        merged.map((c) => ({
          choice_id: c.choice_id ?? c.id ?? null,
          choice_label: String(c.choice_label ?? c.label ?? ""),
          choice_text: String(c.choice_text ?? ""),
          choices_text: String(c.choices_text ?? ""),
          score_value: Number(c.risk_score ?? 0),
          image_url: c.image_url ?? "",
          score_id: c._score_id ?? null,
        }))
      );

      setOpenEdit(true);
    } catch (err) {
      setError(err?.message || "โหลดคำตอบไม่สำเร็จ");
    }
  }

  function handleResetSearch() {
    setKeyword("");
  }

  const addDisabled = useMemo(() => {
    if (!selectedQuestionId || !selectedDiseaseId) return true;
    if (scoreSummary.max == null) return false;
    return scoreSummary.remain <= 0;
  }, [selectedQuestionId, selectedDiseaseId, scoreSummary]);

  const summaryText = useMemo(() => {
    const qType = questionTypeLabel(currentQuestion?.question_type);
    const total = scoreSummary.total ?? 0;
    const max = scoreSummary.max == null ? "-" : scoreSummary.max;
    const remain = scoreSummary.remain == null ? "-" : scoreSummary.remain;
    return { qType, total, max, remain };
  }, [currentQuestion, scoreSummary]);

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

      {/* แถบ filter ด้านบน: เลือกโรค + เลือกคำถาม + ค้นหา */}
      <div
        className="card"
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
      >
        <select
          value={selectedDiseaseId}
          onChange={(e) => setSelectedDiseaseId(e.target.value)}
          style={{ minWidth: 200 }}
        >
          {diseases.map((d) => {
            const id = String(d.disease_id ?? d.id);
            const name =
              d.disease_name ?? d.name ?? d.disease_th ?? d.disease_en ?? `Disease ${id}`;
            return (
              <option key={id} value={id}>
                {name}
              </option>
            );
          })}
        </select>

        <select
          value={selectedQuestionId}
          onChange={(e) => setSelectedQuestionId(e.target.value)}
          style={{ minWidth: 260, flex: "1 1 420px" }}
        >
          {questions.map((q) => {
            const id = String(q.question_id ?? q.id);
            const text = q.question_text || `Question ${id}`;
            return (
              <option key={id} value={id}>
                {text}
              </option>
            );
          })}
        </select>

        <input
          placeholder="ค้นหาคำตอบ"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1, minWidth: 260 }}
        />

        <button className="btn ghost" onClick={handleResetSearch}>
          รีเซ็ต
        </button>

        <button
          className="btn"
          onClick={() => setOpenCreate(true)}
          disabled={addDisabled || loading}
          title={addDisabled ? "คะแนนคงเหลือไม่พอ หรือยังไม่ได้เลือกโรค/คำถาม" : ""}
        >
          + เพิ่มคำตอบ
        </button>

        {/* ✅ เพิ่มแถบสรุปคะแนน "เหมือนแนวหน้า Questions" */}
        <div
          className="t-body"
          style={{
            width: "100%",
            marginTop: 6,
            color: "#222",
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            alignItems: "center",
          }}
        >
          <span>
            <b>โรค:</b> {selectedDiseaseName}
          </span>
          <span>
            <b>ประเภทคำถาม:</b> {summaryText.qType}
          </span>
          <span>
            <b>คะแนนรวม:</b> {summaryText.total}
          </span>
          <span>
            <b>คะแนนสูงสุด:</b> {summaryText.max}
          </span>
          <span>
            <b>คงเหลือ:</b> {summaryText.remain}
          </span>
        </div>
      </div>

      {/* ตาราง */}
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={centerCell}>ID</th>
              <th style={centerCell}>ชื่อโรค</th>
              <th style={centerCell}>คำถาม</th>
              <th>คำตอบ</th>
              <th>คำแนะนำ</th>
              <th style={centerCell}>รูป</th>
              <th style={centerCell}>คะแนน</th>
              <th style={centerCell} className="actionsHeader">จัดการ</th>
            </tr>
          </thead>

          <tbody>
            {filteredAnswers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 16 }}>
                  {selectedQuestionId
                    ? answers.length
                      ? "ไม่พบคำตอบที่ค้นหา"
                      : "ไม่มีคำตอบ"
                    : "กรุณาเลือกโรคและคำถาม"}
                </td>
              </tr>
            ) : (
              filteredAnswers.map((a, idx) => {
                const id = pick(a, ["choice_id", "answer_id", "id"], "-");
                const label = pick(a, ["choice_label", "answer_text", "label"], "-");
                const advice = pick(a, ["choices_text", "choice_text"], "-");
                const score = pick(a, ["risk_score", "score_value", "score"], 0);
                const imgSrc = pick(a, ["image_url", "imageUrl"], "");

                return (
                  <tr key={`${id}-${idx}`}>
                    <td style={centerCell}>{id}</td>
                    <td style={centerCell}>{selectedDiseaseName}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>
                      {currentQuestion?.question_text || "-"}
                    </td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{label}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{advice}</td>

                    <td style={centerCell}>
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={`ans-${id}`}
                          style={{
                            width: 56,
                            height: 56,
                            objectFit: "cover",
                            borderRadius: 10,
                            border: "1px solid #eee",
                          }}
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      ) : (
                        "-"
                      )}
                    </td>

                    <td style={centerCell}>{score}</td>

                    <td style={centerCell} className="actionsCell">
                      <div className="actionButtons">
                        <button className="btn btn-edit" onClick={openEditModal}>
                          แก้ไข
                        </button>
                        <button className="btn btn-delete" onClick={() => handleDelete(a)}>
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

      {/* Modals */}
      {openCreate && (
        <CreateAnswerModal
          open={openCreate}
          question={currentQuestion}
          diseaseId={selectedDiseaseId}
          onClose={() => setOpenCreate(false)}
          onCreated={async () => {
            setOpenCreate(false);
            await loadAnswers();
          }}
        />
      )}

      {openEdit && (
        <EditAnswerModal
          open={openEdit}
          question={currentQuestion}
          diseaseId={selectedDiseaseId}
          existingOptions={editOptions}
          onClose={() => setOpenEdit(false)}
          onUpdated={async () => {
            setOpenEdit(false);
            await loadAnswers();
          }}
        />
      )}
    </div>
  );
}