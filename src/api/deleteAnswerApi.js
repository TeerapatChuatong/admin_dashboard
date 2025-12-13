// src/api/deleteAnswerApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const CHOICES_BASE = `${API_BASE}/choices`;

export async function deleteAnswerApi(id) {
  const choiceId = Number(id);
  if (!choiceId) {
    throw new Error("ไม่พบ choice_id/answer_id สำหรับลบตัวเลือกคำตอบ");
  }

  const res = await fetch(
    `${CHOICES_BASE}/delete_choices.php?choice_id=${encodeURIComponent(
      choiceId
    )}`,
    {
      method: "DELETE",          // ตรงกับ PHP
      credentials: "include",
    }
  );

  return toJsonOrError(res, "ลบตัวเลือกคำตอบไม่สำเร็จ");
}
