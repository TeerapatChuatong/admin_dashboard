import { API_BASE, fetchJson } from "./apiClient";

export function readScoresApi({ disease_id, question_id }) {
  const qs =
    `?disease_id=${encodeURIComponent(disease_id)}` +
    `&question_id=${encodeURIComponent(question_id)}`;

  return fetchJson(`${API_BASE}/scores/read_scores.php${qs}`, { method: "GET" });
}
