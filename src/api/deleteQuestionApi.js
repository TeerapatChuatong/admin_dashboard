// src/api/deleteQuestionApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

// ✅ ชี้ไปที่โมดูล questions ตัวใหม่
const QUESTIONS_BASE = `${API_BASE}/questions`;

export async function deleteQuestionApi(questionId) {
  const id = Number(questionId);
  if (!id) {
    throw new Error("ไม่พบ question_id ที่ถูกต้องสำหรับลบคำถาม");
  }

  const res = await fetch(
    `${QUESTIONS_BASE}/delete_questions.php?question_id=${encodeURIComponent(
      id
    )}`,
    {
      method: "DELETE",
      credentials: "include", // ✅ ต้องส่งคุกกี้ session ไปด้วย (require_admin)
    }
  );

  return toJsonOrError(res, "ลบคำถามไม่สำเร็จ");
}
