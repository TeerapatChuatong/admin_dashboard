// src/api/searchAnswersApi.js
import { API_BASE, toJsonOrError } from "./apiClient";

const CHOICES_BASE = `${API_BASE}/choices`;

function extractChoices(data) {
  if (Array.isArray(data)) return data;
  return data.data || data.choices || [];
}

// รองรับทั้งเรียกแบบ searchAnswersApi('คำค้น')
// และแบบส่ง object: searchAnswersApi({ keyword, question_id })
export async function searchAnswersApi(arg) {
  let keyword = "";
  let questionId;

  if (typeof arg === "string") {
    keyword = arg;
  } else if (arg && typeof arg === "object") {
    keyword = arg.keyword || "";
    questionId = arg.question_id ?? arg.questionId;
  }

  const params = new URLSearchParams();
  if (keyword) params.set("q", keyword); // ✅ ชื่อตัวแปรที่ PHP ใช้
  if (questionId != null && questionId !== "") {
    params.set("question_id", String(questionId));
  }

  const qs = params.toString();
  const url = qs
    ? `${CHOICES_BASE}/search_choices.php?${qs}`
    : `${CHOICES_BASE}/search_choices.php`;

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  const data = await toJsonOrError(res, "ค้นหาตัวเลือกคำตอบไม่สำเร็จ");
  return extractChoices(data);
}
