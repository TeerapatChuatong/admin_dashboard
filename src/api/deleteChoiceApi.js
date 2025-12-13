import { API_BASE, fetchJson } from "./apiClient";

export function deleteChoiceApi(choice_id) {
  return fetchJson(
    `${API_BASE}/choices/delete_choices.php?choice_id=${encodeURIComponent(choice_id)}`,
    { method: "DELETE" }
  );
}
