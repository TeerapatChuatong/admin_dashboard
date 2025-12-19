// src/api/createQuestionApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const QUESTIONS_BASE = `${API_BASE}/questions`;

export async function createQuestionApi(form) {
  const payload = {
    disease_id: Number(form.disease_id), // ✅ ส่งไปให้ backend ทำ pivot disease_questions
    question_text: (form.question_text || "").trim(),
    question_type: form.question_type,
    sort_order: Number(form.sort_order ?? form.order_no ?? 0) || 0,
  };

  const res = await fetch(`${QUESTIONS_BASE}/create_questions.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  return toJsonOrError(res, "เพิ่มคำถามไม่สำเร็จ");
}
