import { API_BASE, fetchJson } from "./apiClient";

export function updateChoiceApi(payload) {
  return fetchJson(`${API_BASE}/choices/update_choices.php`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
