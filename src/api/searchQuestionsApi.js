// src/api/searchQuestionsApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

// ✅ โมดูล questions ใหม่
const QUESTIONS_BASE = `${API_BASE}/questions`;

export async function searchQuestionsApi(q) {
  const keyword = (q ?? "").trim();

  const url = `${QUESTIONS_BASE}/search_questions.php?q=${encodeURIComponent(
    keyword
  )}`;

  const res = await fetch(url, {
    method: "GET",
    credentials: "include", // ✅ search_questions.php ใช้ require_admin()
  });

  const data = await toJsonOrError(res, "ค้นหาคำถามไม่สำเร็จ");

  const list = data.data || data.questions || data || [];
  return Array.isArray(list) ? list : [];
}
