// src/pages/AdminQuestionsPage.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { readQuestionsApi } from "../api/readQuestionsApi";
import { searchQuestionsApi } from "../api/searchQuestionsApi";
import { deleteQuestionApi } from "../api/deleteQuestionApi";
import { readDiseasesApi } from "../api/readDiseasesApi";
import { readDiseaseQuestionsApi } from "../api/readDiseaseQuestionsApi";
import { API_BASE } from "../api/apiClient";

import CreateQuestionModal from "../components/CreateQuestionModal";
import EditQuestionModal from "../components/EditQuestionModal";

// map slug → ชื่อโรคภาษาไทย (กรณีต้อง fallback จาก slug)
const DISEASE_NAME_MAP = {
  canker: "โรคแคงเกอร์",
  hlb: "โรคกรีนนิ่ง (HLB)",
  greening: "โรคกรีนนิ่ง (HLB)",
  melanose: "โรคเมลาโนส",
  melanose_greasy: "โรคเมลาโนส",
  sooty_mold: "ราดำ (Sooty mold)",
  anthracnose: "โรคแอนแทรคโนส",
  leaf_miner: "หนอนชอนใบ",
  healthy: "ใบปกติ",
};

// label ประเภทคำถาม (ต้องตรง enum: yes_no / multi / numeric)
const QUESTION_TYPE_LABELS = {
  yes_no: "ใช่ / ไม่ใช่",
  multi: "ตัวเลือก",
  numeric: "ตัวเลข",
};

// ✅ root ของ backend สำหรับแปลง path รูปให้เป็น URL
const BACKEND_ROOT = String(API_BASE || "").replace(/\/api\/?$/, "");

function resolveBackendUrl(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";

  // normalize windows backslashes
  const normalized = s.replace(/\\/g, "/");

  // ถ้าเป็น URL เต็มอยู่แล้ว
  if (/^https?:\/\//i.test(normalized)) return normalized;

  // ถ้าเป็น absolute path เช่น /crud/uploads/... หรือ /uploads/...
  if (normalized.startsWith("/")) {
    // เคส /uploads/... ให้ชี้ใต้ /crud/uploads/...
    if (normalized.startsWith("/uploads/")) return `${BACKEND_ROOT}${normalized}`;
    // เคส /crud/uploads/... หรือ path อื่น ๆ → ใช้ origin ของ BACKEND_ROOT
    try {
      return new URL(normalized, BACKEND_ROOT + "/").href;
    } catch {
      return normalized;
    }
  }

  // relative เช่น uploads/question_images/xxx.jpg
  if (normalized.startsWith("uploads/")) return `${BACKEND_ROOT}/${normalized}`;

  // เผื่อเก็บมาแค่ชื่อไฟล์/โฟลเดอร์ย่อย
  return `${BACKEND_ROOT}/uploads/${normalized}`;
}

function getId(q) {
  return q.question_id ?? q.id ?? 0;
}

function getOrder(q) {
  // DB ใหม่ใช้ sort_order
  return q.sort_order ?? q.order_no ?? q.order_index ?? q.order ?? 0;
}

function getActive(q) {
  const v = q.is_active ?? q.active ?? 1;
  return String(v) === "1" ? 1 : 0;
}

function getQuestionType(q) {
  return q.question_type ?? q.type ?? "yes_no";
}

function getQuestionTypeLabel(q) {
  const key = String(getQuestionType(q) || "").toLowerCase();
  return QUESTION_TYPE_LABELS[key] || key || "-";
}

function sortByIdAsc(list) {
  return [...list].sort((a, b) => Number(getId(a)) - Number(getId(b)));
}

// ใช้ตอน filter ตามโรค (รองรับ pivot disease_ids และ legacy disease_id)
function matchesDisease(q, diseaseId) {
  // ไม่กรอง
  if (diseaseId === "" || diseaseId === null || diseaseId === undefined) return true;

  const target = String(diseaseId);

  // 1) แบบใหม่: disease_ids (จาก pivot disease_questions) เช่น "1,2,3"
  const raw = q.disease_ids ?? q.diseaseIds ?? "";
  const ids = raw
    ? String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // 2) แบบเดิม: disease_id เดี่ยว
  const legacy = q.disease_id ?? q.diseaseId;
  const legacyStr =
    legacy === null || legacy === undefined || legacy === "" ? "" : String(legacy);

  return ids.includes(target) || (legacyStr && legacyStr === target);
}

function filterQuestions(baseList, diseaseId) {
  const list = Array.isArray(baseList) ? baseList : [];
  return sortByIdAsc(list.filter((q) => matchesDisease(q, diseaseId)));
}

// ✅ แปลง disease_ids ใน question → ชื่อโรค โดยใช้ข้อมูลจากตาราง diseases
function getDiseaseNamesFromIds(q, diseases) {
  const rawIds = q.disease_ids ?? q.diseaseIds ?? "";
  if (!rawIds) return "-";

  const ids = String(rawIds)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const labels = ids.map((id) => {
    const found = diseases.find((d) => String(d.disease_id) === String(id));

    if (found) {
      return (
        found.disease_th ||
        found.disease_en ||
        found.name_th ||
        found.name_en ||
        found.disease_slug ||
        id
      );
    }

    // เผื่อบางเคสเก็บ slug เช่น canker ไว้ใน disease_ids
    const key = String(id).toLowerCase();
    return DISEASE_NAME_MAP[key] || id;
  });

  return labels.join(", ");
}

// ✅ เอา questions + disease_questions มารวมกัน → เติม field disease_ids ให้แต่ละคำถาม
function attachDiseaseIds(questions, diseaseQuestions) {
  const dqList = Array.isArray(diseaseQuestions) ? diseaseQuestions : [];
  const qList = Array.isArray(questions) ? questions : [];

  const map = new Map(); // question_id -> Set<disease_id>

  dqList.forEach((dq) => {
    const qid = dq.question_id;
    const did = dq.disease_id;
    // ✅ อย่าตัด disease_id = 0 (เคยพลาดเพราะ 0 เป็น falsy)
    if (qid === null || qid === undefined || String(qid).trim() === "") return;
    if (did === null || did === undefined || String(did).trim() === "") return;

    const key = String(qid);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(String(did));
  });

  return qList.map((q) => {
    const key = String(q.question_id ?? q.id);
    const set = map.get(key);
    const disease_ids = set ? Array.from(set).join(",") : "";
    return { ...q, disease_ids };
  });
}

/* ---------------- helpers สำหรับแตกคำถามเป็นแถวต่อโรค ---------------- */

// หา "ชื่อโรค" จาก disease_id โดยอิงจากตาราง diseases
function lookupDiseaseName(id, diseases) {
  const found = diseases.find((d) => String(d.disease_id) === String(id));
  if (found) {
    return (
      found.disease_th ||
      found.disease_en ||
      found.name_th ||
      found.name_en ||
      found.disease_slug ||
      id
    );
  }
  const key = String(id).toLowerCase();
  return DISEASE_NAME_MAP[key] || id;
}

// แปลง questions -> rows สำหรับแสดงในตาราง
// ถ้า selectedDiseaseId ว่าง → แตกหลายแถว (คำถาม × โรค/กลุ่ม)
// ถ้าเลือกโรค → แถวละคำถามเดียวของโรคนั้น
function buildDisplayRows(questions, diseases, selectedDiseaseId) {
  const rows = [];
  const qList = Array.isArray(questions) ? questions : [];
  const selected = selectedDiseaseId !== "" ? String(selectedDiseaseId) : "";

  for (const q of qList) {
    const rawIds = q.disease_ids ?? q.diseaseIds ?? "";
    const ids = String(rawIds)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // ✅ fallback: ถ้าไม่ได้ผูกผ่าน pivot ให้ดู disease_id เดี่ยว
    const legacy = q.disease_id ?? q.diseaseId;
    const legacyStr =
      legacy === null || legacy === undefined || legacy === "" ? "" : String(legacy);

    // เลือกชุด id ที่จะใช้แสดงผล
    const effectiveIds = ids.length > 0 ? ids : legacyStr ? [legacyStr] : [];

    // ยังไม่ผูกโรคเลยจริง ๆ
    if (effectiveIds.length === 0) {
      if (selected) continue;
      rows.push({
        q,
        diseaseId: null,
        diseaseName: "-",
      });
      continue;
    }

    if (selected) {
      if (!effectiveIds.includes(selected)) continue;
      rows.push({
        q,
        diseaseId: selected,
        diseaseName: lookupDiseaseName(selected, diseases),
      });
    } else {
      // โหมด "ทุกโรค" → แตกหลายแถว แถวละ 1 โรค/กลุ่มคำถาม
      effectiveIds.forEach((id) => {
        rows.push({
          q,
          diseaseId: id,
          diseaseName: lookupDiseaseName(id, diseases),
        });
      });
    }
  }

  return rows;
}

/* ---------------- component หลัก ---------------- */

export default function AdminQuestionsPage() {
  const { user, logout } = useAuth();

  // ✅ จัดกลาง: ใช้กับ ID/ชื่อโรค/ประเภทคำถาม/คะแนนสูงสุด/ลำดับ/สถานะ
  const centerCell = { textAlign: "center", verticalAlign: "middle" };

  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [diseaseQuestions, setDiseaseQuestions] = useState([]);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState("");

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editQuestion, setEditQuestion] = useState(null);

  // ✅ NEW: ให้ sort_order ต่อจากลำดับล่าสุดอัตโนมัติ
  // - ถ้าเลือกโรคอยู่ → ต่อจากคำถามล่าสุดของโรคนั้น
  // - ถ้าไม่เลือกโรค → ต่อจากล่าสุดทั้งหมด
  function getNextSortOrderForDisease(diseaseId) {
    const did = String(diseaseId || "");
    const base = Array.isArray(allQuestions) ? allQuestions : [];
    const list = did ? base.filter((q) => matchesDisease(q, did)) : base;

    let max = 0;
    for (const q of list) {
      const v = Number(getOrder(q) || 0);
      if (Number.isFinite(v) && v > max) max = v;
    }
    return max + 1;
  }

  // โหลดคำถาม + ตารางเชื่อม disease_questions แล้วรวมกัน
  async function loadQuestions(diseaseId = selectedDiseaseId) {
    setLoading(true);
    setError("");
    try {
      const [qRes, dqRes] = await Promise.all([
        readQuestionsApi(),
        readDiseaseQuestionsApi(),
      ]);

      const qs = Array.isArray(qRes) ? qRes : [];
      const dqs = Array.isArray(dqRes) ? dqRes : [];

      const enriched = attachDiseaseIds(qs, dqs);

      setDiseaseQuestions(dqs);
      setAllQuestions(enriched);
      setQuestions(filterQuestions(enriched, diseaseId));
    } catch (err) {
      console.error(err);
      setError(err.message || "โหลดคำถามไม่สำเร็จ");
      setDiseaseQuestions([]);
      setAllQuestions([]);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  // โหลดครั้งแรก
  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // โหลดรายชื่อโรคไว้ให้เลือก filter
  useEffect(() => {
    (async () => {
      try {
        const ds = await readDiseasesApi();
        setDiseases(Array.isArray(ds) ? ds : []);
      } catch (err) {
        console.error("โหลดรายชื่อโรคไม่สำเร็จ", err);
      }
    })();
  }, []);

  // เวลา keyword หรือ โรคที่เลือกเปลี่ยน → ค้นหา + กรองตามโรค
  useEffect(() => {
    let cancelled = false;

    if (!keyword.trim()) {
      setQuestions(filterQuestions(allQuestions, selectedDiseaseId));
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchQuestionsApi(keyword.trim());
        const arr = Array.isArray(data) ? data : [];
        const enriched = attachDiseaseIds(arr, diseaseQuestions);

        if (!cancelled) {
          setQuestions(filterQuestions(enriched, selectedDiseaseId));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "ค้นหาคำถามไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword, selectedDiseaseId, allQuestions, diseaseQuestions]);

  async function handleDelete(q) {
    const id = getId(q);
    if (!window.confirm("ยืนยันลบคำถามนี้?")) return;

    setError("");
    try {
      await deleteQuestionApi(id);
      await loadQuestions();
    } catch (err) {
      setError(err.message || "ลบคำถามไม่สำเร็จ");
    }
  }

  function handleDiseaseChange(e) {
    const value = e.target.value;
    setSelectedDiseaseId(value);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/admin" className="btn ghost">
            ← กลับหน้าหลัก
          </a>
          <h1 style={{ margin: 0 }}>จัดการคำถาม</h1>
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

      {/* แถบ filter ด้านบน: เลือกโรค + ค้นหา */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        <select
          value={selectedDiseaseId}
          onChange={handleDiseaseChange}
          style={{ minWidth: 200 }}
        >
          <option value="">-- ทุกโรค --</option>

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

        <input
          placeholder="ค้นหาคำถาม"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        {searching && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>กำลังค้นหา...</span>
        )}
        <button className="btn ghost" onClick={() => setKeyword("")}>
          รีเซ็ต
        </button>
        <button className="btn" onClick={() => setOpenCreate(true)}>
          + เพิ่มคำถาม
        </button>
      </div>

      {/* ตารางคำถาม */}
      <div className="card">
        {loading ? (
          <div>กำลังโหลด...</div>
        ) : questions.length === 0 ? (
          <div>ไม่พบข้อมูลคำถาม</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={centerCell}>ID</th>
                <th style={centerCell}>ชื่อโรค</th>
                <th style={centerCell}>ประเภทคำถาม</th>
                <th>คำถาม</th>

                {/* ✅ เพิ่มคอลัมน์รูป */}
                <th style={centerCell}>รูป</th>

                {/* ✅ คะแนนสูงสุดถัดจากคำถาม */}
                <th style={centerCell}>คะแนนสูงสุด</th>

                <th style={centerCell}>ลำดับ</th>
                <th style={centerCell}>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {buildDisplayRows(questions, diseases, selectedDiseaseId).map(
                (row, idx) => {
                  const q = row.q;
                  const id = getId(q);

                  // ชื่อโรค/กลุ่มคำถาม
                  const diseaseName =
                    row.diseaseName ||
                    getDiseaseNamesFromIds(q, diseases) ||
                    "-";

                  const questionTypeLabel = getQuestionTypeLabel(q);
                  const text =
                    q.question_text || q.question || q.text || "(ไม่ระบุ)";

                  // ✅ max_score (ถ้า API ส่งมา)
                  const maxScore = q.max_score ?? q.maxScore ?? q.max ?? "-";

                  const order = getOrder(q);
                  const active = getActive(q);

                  // ✅ รูป (ใช้ image_url เป็นหลัก)
                  const rawImg =
                    q.image_url ??
                    q.imageUrl ??
                    q.example_image ??
                    q.exampleImage ??
                    "";
                  const imgSrc = resolveBackendUrl(rawImg);

                  return (
                    <tr key={`${id}-${row.diseaseId ?? "none"}-${idx}`}>
                      <td style={centerCell}>{id}</td>
                      <td style={centerCell}>{diseaseName}</td>
                      <td style={centerCell}>{questionTypeLabel}</td>

                      <td style={{ whiteSpace: "pre-wrap" }}>{text}</td>

                      {/* ✅ cell แสดงรูป */}
                      <td style={centerCell}>
                        {imgSrc ? (
                          <a href={imgSrc} target="_blank" rel="noreferrer">
                            <img
                              src={imgSrc}
                              alt={`q-${id}`}
                              style={{
                                width: 56,
                                height: 56,
                                objectFit: "cover",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.08)",
                                display: "block",
                                margin: "0 auto",
                              }}
                            />
                          </a>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>-</span>
                        )}
                      </td>

                      <td style={centerCell}>{maxScore}</td>

                      <td style={centerCell}>{order}</td>
                      <td style={centerCell}>{active === 1 ? "เปิด" : "ปิด"}</td>

                      <td>
                        <button
                          className="btn xs"
                          onClick={() => setEditQuestion(q)}
                        >
                          แก้ไข
                        </button>{" "}
                        <button
                          className="btn xs danger"
                          onClick={() => handleDelete(q)}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        )}
      </div>

      {openCreate && (
        <CreateQuestionModal
          initialDiseaseId={selectedDiseaseId}
          initialSortOrder={getNextSortOrderForDisease(selectedDiseaseId)}
          getNextSortOrder={getNextSortOrderForDisease}
          onClose={() => setOpenCreate(false)}
          onSuccess={async () => {
            setOpenCreate(false);
            await loadQuestions();
          }}
        />
      )}

      {editQuestion && (
        <EditQuestionModal
          question={editQuestion}
          onClose={() => setEditQuestion(null)}
          onSuccess={async () => {
            setEditQuestion(null);
            await loadQuestions();
          }}
        />
      )}
    </div>
  );
}
