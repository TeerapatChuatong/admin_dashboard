// src/api/readDiseaseQuestionsApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const DISEASE_Q_BASE = `${API_BASE}/disease_questions`;

export async function readDiseaseQuestionsApi() {
  const res = await fetch(`${DISEASE_Q_BASE}/read_disease_questions.php`, {
    method: "GET",
    credentials: "include",
  });

  const data = await toJsonOrError(res, "โหลดความเชื่อมโยงโรค-คำถามไม่สำเร็จ");
  return data.data || [];
}
