// src/api/createQuestionApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

// ✅ ชี้ไปที่ module questions ใหม่
const QUESTIONS_BASE = `${API_BASE}/questions`;

export async function createQuestionApi(form) {
  const payload = {
    question_text: (form.question_text || "").trim(),
    // ต้องตรงกับ enum ใน DB เช่น 'yes_no' | 'multi' | 'numeric'
    question_type: form.question_type,
    // ใช้ sort_order แทน order_no (map จากฟอร์มหากยังใช้ชื่อเดิม)
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
