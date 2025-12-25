// src/api/createQuestionApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

// ✅ ชี้ไปที่โมดูล questions
const QUESTIONS_BASE = `${API_BASE}/questions`;

export async function createQuestionApi(form) {
  const payload = {
    disease_id: Number(form.disease_id), // ✅ ส่งไปให้ backend ทำ pivot disease_questions
    question_text: (form.question_text || "").trim(),
    question_type: form.question_type,
    sort_order: Number(form.sort_order) || 0,
    order_no: Number(form.sort_order) || 0, // เผื่อ backend เก่า
  };

  // ✅ เพิ่ม max_score
  if (form.max_score != null) payload.max_score = Number(form.max_score);

  // (ไม่บังคับ) รองรับ is_active ถ้า backend มีคอลัมน์
  if (form.is_active != null) payload.is_active = Number(form.is_active);

  const res = await fetch(`${QUESTIONS_BASE}/create_questions.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  return toJsonOrError(res);
}
