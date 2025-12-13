// src/api/updateQuestionApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const QUESTIONS_BASE = `${API_BASE}/questions`;

export async function updateQuestionApi(form) {
  const payload = {
    question_id: Number(form.question_id),
  };

  if (form.question_text != null) {
    payload.question_text = form.question_text.trim();
  }
  if (form.question_type != null) {
    payload.question_type = form.question_type;
  }
  if (form.sort_order != null || form.order_no != null) {
    payload.sort_order = Number(form.sort_order ?? form.order_no) || 0;
  }

  const res = await fetch(`${QUESTIONS_BASE}/update_questions.php`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  return toJsonOrError(res, "แก้ไขคำถามไม่สำเร็จ");
}
