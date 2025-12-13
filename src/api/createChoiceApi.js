import { API_BASE, fetchJson } from "./apiClient";

export function createChoiceApi(payload) {
  return fetchJson(`${API_BASE}/choices/create_choices.php`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
