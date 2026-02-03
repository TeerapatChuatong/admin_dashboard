// src/api/treatmentEpisodesApi.js
import { apiFetch } from "./_baseApi";

export async function readTreatmentEpisode(episode_id) {
  const qs = new URLSearchParams();
  qs.set("episode_id", String(episode_id));
  return apiFetch(`/treatment_episodes/read_treatment_episodes.php?${qs.toString()}`);
}

export async function readTreatmentEpisodeEvents(episode_id) {
  const qs = new URLSearchParams();
  qs.set("episode_id", String(episode_id));
  return apiFetch(`/treatment_episode_events/read_treatment_episode_events.php?${qs.toString()}`);
}
