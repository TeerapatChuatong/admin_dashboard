// src/api/createQuestionApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const QUESTIONS_BASE = `${API_BASE}/questions`;

function normalizeAnswerSource(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  // รองรับชื่อที่อาจหลุดมา
  if (s === "manual") return "manual";
  if (s === "chemicals") return "chemicals";
  if (s === "chemical" || s === "chemical_dropdown") return "chemicals";
  return s; // ส่งตามเดิม เผื่อ backend รองรับค่าอื่น
}

export async function createQuestionApi(form) {
  const url = `${QUESTIONS_BASE}/create_questions.php`;

  const answer_source = normalizeAnswerSource(form?.answer_source);

  // ส่ง multipart ถ้ามี file
  const hasFile = form?.example_image_file instanceof File;

  if (hasFile) {
    const fd = new FormData();

    if (form.question_text != null) fd.append("question_text", String(form.question_text));
    if (form.question_type != null) fd.append("question_type", String(form.question_type));
    if (form.max_score != null) fd.append("max_score", String(form.max_score));
    if (form.sort_order != null) fd.append("sort_order", String(form.sort_order));
    if (form.disease_id != null) fd.append("disease_id", String(form.disease_id));

    // ✅ ส่ง answer_source (ถ้ามี)
    if (answer_source) fd.append("answer_source", String(answer_source));

    // ✅ url รูป (รองรับ schema ใหม่: image_url)
    const urlTrim = String(form.example_image || "").trim();
    if (urlTrim) {
      fd.append("image_url", urlTrim);
      // backward compatible (ถ้า backend ยังใช้ชื่อเดิม)
      fd.append("example_image", urlTrim);
    }

    // ✅ file รูป
    fd.append("image_file", form.example_image_file);
    // backward compatible
    fd.append("example_image_file", form.example_image_file);

    const res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
    return await toJsonOrError(res, "เพิ่มคำถามไม่สำเร็จ");
  }

  // JSON fallback
  const payload = {};
  if (form.question_text != null) payload.question_text = String(form.question_text);
  if (form.question_type != null) payload.question_type = String(form.question_type);
  if (form.max_score != null) payload.max_score = Number(form.max_score);
  if (form.sort_order != null) payload.sort_order = Number(form.sort_order);
  if (form.disease_id != null)
    payload.disease_id = form.disease_id === "" ? null : Number(form.disease_id);

  // ✅ ส่ง answer_source (ถ้ามี)
  if (answer_source) payload.answer_source = answer_source;

  const urlTrim = String(form.example_image || "").trim();
  if (urlTrim) {
    payload.image_url = urlTrim;
    payload.example_image = urlTrim; // backward compatible
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  return await toJsonOrError(res, "เพิ่มคำถามไม่สำเร็จ");
}
