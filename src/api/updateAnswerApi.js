import { CHOICES_BASE, toJsonOrError } from "./apiClient";
import { createScoreApi } from "./createScoreApi";
import { updateScoreApi } from "./updateScoreApi";

async function upsertScore({ disease_id, question_id, choice_id, risk_score, score_id }) {
  try {
    await updateScoreApi({ disease_id, question_id, choice_id, risk_score, score_id });
  } catch {
    await createScoreApi({ disease_id, question_id, choice_id, risk_score });
  }
}

export async function updateAnswerApi(payload) {
  const res = await fetch(`${CHOICES_BASE}/update_choices.php`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await toJsonOrError(res, "แก้ไขคำตอบไม่สำเร็จ");

  if (payload.disease_id && payload.question_id && payload.choice_id) {
    await upsertScore({
      disease_id: payload.disease_id,
      question_id: payload.question_id,
      choice_id: payload.choice_id,
      risk_score: Number(payload.risk_score || 0),
      score_id: payload.score_id,
    });
  }

  return data.data || data;
}
