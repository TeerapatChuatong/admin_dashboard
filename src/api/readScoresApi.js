// src/api/readScoresApi.js
import { SCORES_BASE, toJsonOrError } from "./apiClient";

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  return data?.data || data?.scores || data?.items || [];
}

export async function readScoresApi({ disease_id, question_id } = {}) {
  const params = new URLSearchParams();
  if (disease_id) params.set("disease_id", String(disease_id));
  if (question_id) params.set("question_id", String(question_id));

  const url =
    params.toString().length > 0
      ? `${SCORES_BASE}/read_scores.php?${params.toString()}`
      : `${SCORES_BASE}/read_scores.php`;

  const res = await fetch(url, { credentials: "include" });
  const data = await toJsonOrError(res, "โหลดคะแนนไม่สำเร็จ");
  return normalizeArray(data);
}
