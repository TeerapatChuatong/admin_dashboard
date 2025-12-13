// src/api/readAnswersApi.js
import { CHOICES_BASE, toJsonOrError } from "./apiClient";
import { readScoresApi } from "./readScoresApi";

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  return data?.data || data?.choices || data?.answers || data?.items || [];
}

export async function readAnswersApi(arg1, arg2) {
  let question_id, disease_id;

  if (typeof arg1 === "object") {
    question_id = arg1.question_id;
    disease_id = arg1.disease_id;
  } else {
    question_id = arg1;
    disease_id = arg2;
  }

  if (!question_id) return [];

  const res = await fetch(
    `${CHOICES_BASE}/read_choices.php?question_id=${encodeURIComponent(question_id)}`,
    { credentials: "include" }
  );

  const data = await toJsonOrError(res, "โหลดคำตอบไม่สำเร็จ");
  const choices = normalizeArray(data);

  if (!disease_id) return choices;

  let scores = [];
  try {
    scores = await readScoresApi({ disease_id, question_id });
  } catch (e) {
    console.warn("readScoresApi failed → fallback choices only", e);
    return choices;
  }

  const scoreMap = new Map();
  scores.forEach((s) => {
    const cid = String(s.choice_id ?? "");
    if (cid) scoreMap.set(cid, Number(s.risk_score ?? s.score ?? 0));
  });

  return choices.map((c) => {
    const cid = String(c.choice_id ?? c.id ?? "");
    return {
      ...c,
      risk_score: scoreMap.has(cid) ? scoreMap.get(cid) : Number(c.risk_score ?? 0),
      score_id: c.score_id ?? null,
    };
  });
}
