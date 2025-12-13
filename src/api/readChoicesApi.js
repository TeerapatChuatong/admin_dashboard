import { API_BASE, fetchJson } from "./apiClient";

export function readChoicesApi(question_id) {
  return fetchJson(
    `${API_BASE}/choices/read_choices.php?question_id=${encodeURIComponent(question_id)}`,
    { method: "GET" }
  );
}
