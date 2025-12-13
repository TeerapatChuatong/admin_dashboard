// src/api/readQuestionsApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

// ✅ ชี้ไปที่โมดูล questions
const QUESTIONS_BASE = `${API_BASE}/questions`;

export async function readQuestionsApi() {
  const res = await fetch(`${QUESTIONS_BASE}/read_questions.php`, {
    method: "GET",
    credentials: "include", // กันกรณี endpoint ในอนาคต require_admin
  });

  const data = await toJsonOrError(res, "โหลดคำถามไม่สำเร็จ");

  // read_questions.php คืน { ok: true, data: [...] }
  const list = data.data || data.questions || data || [];
  return Array.isArray(list) ? list : [];
}
