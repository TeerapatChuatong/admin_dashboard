import { SCORES_BASE, toJsonOrError } from "./apiClient";

export async function updateScoreApi(payload) {
  const res = await fetch(`${SCORES_BASE}/update_scores.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      disease_id: payload.disease_id,
      question_id: payload.question_id,
      choice_id: payload.choice_id,
      risk_score: payload.risk_score,
      score: payload.risk_score,
      points: payload.risk_score,
    }),
  });

  const data = await toJsonOrError(res, "แก้ไขคะแนนไม่สำเร็จ");
  return data.data || data;
}
