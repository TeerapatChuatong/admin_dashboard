// src/api/updateQuestionApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const QUESTIONS_BASE = `${API_BASE}/questions`;

function normalizeAnswerSource(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s === "manual") return "manual";
  if (s === "chemicals") return "chemicals";
  if (s === "chemical" || s === "chemical_dropdown") return "chemicals";
  return s;
}

export async function updateQuestionApi(form) {
  const url = `${QUESTIONS_BASE}/update_questions.php`;

  const answer_source = normalizeAnswerSource(form?.answer_source);

  const hasFile = form?.example_image_file instanceof File;

  if (hasFile) {
    const fd = new FormData();

    if (form.question_id != null) fd.append("question_id", String(form.question_id));
    if (form.question_text != null) fd.append("question_text", String(form.question_text));
    if (form.question_type != null) fd.append("question_type", String(form.question_type));
    if (form.max_score != null) fd.append("max_score", String(form.max_score));
    if (form.sort_order != null) fd.append("sort_order", String(form.sort_order));
    if (form.disease_id != null) fd.append("disease_id", String(form.disease_id));

    // ✅ ส่ง answer_source (ถ้ามี)
    if (answer_source) fd.append("answer_source", String(answer_source));

    const urlTrim = String(form.example_image || "").trim();
    if (urlTrim) {
      fd.append("image_url", urlTrim);
      fd.append("example_image", urlTrim);
    }

    fd.append("image_file", form.example_image_file);
    fd.append("example_image_file", form.example_image_file);

    const res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
    return await toJsonOrError(res, "แก้ไขคำถามไม่สำเร็จ");
  }

  const payload = {};
  if (form.question_id != null) payload.question_id = Number(form.question_id);
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
    payload.example_image = urlTrim;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  return await toJsonOrError(res, "แก้ไขคำถามไม่สำเร็จ");
}
