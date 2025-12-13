// src/api/readAnswersApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const CHOICES_BASE = `${API_BASE}/choices`;

function extractChoices(data) {
  if (Array.isArray(data)) return data;
  return data.data || data.choices || [];
}

// ถ้าส่ง questionId เข้ามา จะดึงเฉพาะ choices ของคำถามนั้น
export async function readAnswersApi(questionId) {
  const params = new URLSearchParams();
  if (questionId != null && questionId !== "") {
    params.set("question_id", String(questionId));
  }

  const qs = params.toString();
  const url = qs
    ? `${CHOICES_BASE}/read_choices.php?${qs}`
    : `${CHOICES_BASE}/read_choices.php`;

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  const data = await toJsonOrError(res, "โหลดรายการตัวเลือกคำตอบไม่สำเร็จ");
  return extractChoices(data);
}
