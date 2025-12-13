// src/api/createAnswerApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const CHOICES_BASE = `${API_BASE}/choices`;

export async function createAnswerApi(form) {
  const questionId = Number(form.question_id ?? form.qid);
  const label = (form.choice_label ?? form.answer_text ?? "").trim();

  if (!questionId) {
    throw new Error("กรุณาเลือกคำถาม (question_id) ให้ถูกต้อง");
  }
  if (!label) {
    throw new Error("กรุณากรอกข้อความตัวเลือกคำตอบ");
  }

  const payload = {
    // ฟิลด์ที่ backend choices ใช้จริง
    question_id: questionId,
    choice_label: label,

    // ✅ เก็บ alias เดิมเผื่อที่อื่นยังอ้างถึงค่าเหล่านี้
    qid: questionId,
    answer_text: label,
    answer: label,
    score: form.score != null ? Number(form.score) : undefined,
    points: form.score != null ? Number(form.score) : undefined,
  };

  const res = await fetch(`${CHOICES_BASE}/create_choices.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  return toJsonOrError(res, "เพิ่มตัวเลือกคำตอบไม่สำเร็จ");
}
