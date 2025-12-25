// src/api/updateQuestionApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const QUESTIONS_BASE = `${API_BASE}/questions`;

export async function updateQuestionApi(form) {
  const payload = {
    question_id: Number(form.question_id),
    // ✅ แก้โรคของคำถาม (pivot)
    disease_id: Number(form.disease_id),
  };

  if (form.question_text != null) payload.question_text = String(form.question_text).trim();
  if (form.question_type != null) payload.question_type = form.question_type;
  if (form.sort_order != null) {
    payload.sort_order = Number(form.sort_order) || 0;
    payload.order_no = Number(form.sort_order) || 0; // เผื่อ backend เก่า
  }

  // ✅ เพิ่ม max_score
  if (form.max_score != null) payload.max_score = Number(form.max_score);

  // (ไม่บังคับ) รองรับ is_active ถ้า backend มีคอลัมน์
  if (form.is_active != null) payload.is_active = Number(form.is_active);

  const res = await fetch(`${QUESTIONS_BASE}/update_questions.php`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  return toJsonOrError(res);
}
