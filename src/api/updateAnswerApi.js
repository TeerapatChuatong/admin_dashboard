// src/api/updateAnswerApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const CHOICES_BASE = `${API_BASE}/choices`;

export async function updateAnswerApi(form) {
  // map id เดิมมาเป็น choice_id
  const choiceId = Number(
    form.choice_id ?? form.answer_id ?? form.id
  );

  if (!choiceId) {
    throw new Error("ไม่พบ choice_id/answer_id สำหรับแก้ไขตัวเลือกคำตอบ");
  }

  const payload = {
    choice_id: choiceId,

    // alias เดิม เผื่อที่อื่นยังอ้างถึง
    answer_id: form.answer_id,
    id: form.id ?? form.answer_id ?? form.choice_id,
  };

  // ถ้ามีเปลี่ยน question_id ให้ส่งไปด้วย
  if (form.question_id != null || form.qid != null) {
    payload.question_id = Number(form.question_id ?? form.qid);
  }

  // ข้อความตัวเลือกคำตอบ
  if (
    form.choice_label != null ||
    form.answer_text != null ||
    form.answer != null
  ) {
    const label = (
      form.choice_label ?? form.answer_text ?? form.answer
    ).trim();

    payload.choice_label = label;
    payload.answer_text = label; // alias เดิม
    payload.answer = label;
  }

  // ถ้ามี image_url ให้ส่งไปด้วย
  if (form.image_url != null) {
    payload.image_url = (form.image_url ?? "").trim();
  }

  // คะแนน (ถ้ามี) แนบไปด้วยเฉย ๆ backend choices ไม่ใช้
  if (form.score != null) {
    payload.score = Number(form.score);
    payload.points = Number(form.score);
  }

  const res = await fetch(`${CHOICES_BASE}/update_choices.php`, {
    method: "PATCH", // ตรงกับ PHP ที่ require PATCH
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  return toJsonOrError(res, "แก้ไขตัวเลือกคำตอบไม่สำเร็จ");
}
