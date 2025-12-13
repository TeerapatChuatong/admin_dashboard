import { CHOICES_BASE, toJsonOrError } from "./apiClient";
import { createScoreApi } from "./createScoreApi";
import { updateScoreApi } from "./updateScoreApi";

function extractChoiceId(any) {
  if (!any) return null;
  if (typeof any === "number") return any;
  if (typeof any === "string" && /^\d+$/.test(any)) return Number(any);

  if (any.choice_id != null) return any.choice_id;
  if (any.id != null) return any.id;

  const nested = any.data || any.choice || any.result;
  if (nested) return extractChoiceId(nested);

  return null;
}

async function upsertScore({ disease_id, question_id, choice_id, risk_score }) {
  try {
    await updateScoreApi({ disease_id, question_id, choice_id, risk_score });
  } catch {
    await createScoreApi({ disease_id, question_id, choice_id, risk_score });
  }
}

export async function createAnswerApi(payload) {
  const res = await fetch(`${CHOICES_BASE}/create_choices.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      question_id: payload.question_id,
      choice_label: payload.choice_label,
      image_url: payload.image_url || null,
    }),
  });

  const data = await toJsonOrError(res, "เพิ่มคำตอบไม่สำเร็จ");
  const choice_id = extractChoiceId(data);

  if (payload.disease_id && choice_id) {
    await upsertScore({
      disease_id: payload.disease_id,
      question_id: payload.question_id,
      choice_id,
      risk_score: Number(payload.risk_score || 0),
    });
  }

  return { ...data, choice_id, risk_score: Number(payload.risk_score || 0) };
}
