import { CHOICES_BASE, toJsonOrError } from "./apiClient";
import { createScoreApi } from "./createScoreApi";
import { updateScoreApi } from "./updateScoreApi";

function getAuthToken() {
  try {
    const u = JSON.parse(localStorage.getItem("auth_user") || "null");
    return u?.token ? String(u.token) : "";
  } catch {
    return "";
  }
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isFileLike(v) {
  if (!v) return false;
  if (typeof File !== "undefined" && v instanceof File) return true;
  if (typeof Blob !== "undefined" && v instanceof Blob) return true;
  // Fallback (in case something wraps File)
  return (
    typeof v === "object" &&
    typeof v.size === "number" &&
    typeof v.type === "string" &&
    typeof v.name === "string"
  );
}

function cleanStr(v) {
  return String(v ?? "").trim();
}

function extractChoiceId(any) {
  if (!any) return null;
  if (typeof any === "number") return any;
  if (typeof any === "string" && /^\d+$/.test(any)) return Number(any);

  if (any.choice_id != null) return Number(any.choice_id);
  if (any.id != null) return Number(any.id);

  const nested = any.data || any.choice || any.result;
  if (nested) return extractChoiceId(nested);

  return null;
}

async function upsertScore({ disease_id, question_id, choice_id, risk_score, score_id }) {
  try {
    await updateScoreApi({ disease_id, question_id, choice_id, risk_score, score_id });
  } catch {
    await createScoreApi({ disease_id, question_id, choice_id, risk_score });
  }
}

async function createOneChoice({
  question_id,
  choice_label,
  choices_text,
  image_url,
  image_file,
}) {
  const hasFile = isFileLike(image_file);
  const cleanUrl = cleanStr(image_url);

  let res;
  if (hasFile) {
    const fd = new FormData();
    fd.append("question_id", String(question_id));
    fd.append("choice_label", String(choice_label));
    fd.append("choices_text", String(choices_text ?? ""));
    if (cleanUrl) fd.append("image_url", cleanUrl);
    fd.append("image_file", image_file);

    res = await fetch(`${CHOICES_BASE}/create_choices.php`, {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      body: fd,
    });
  } else {
    res = await fetch(`${CHOICES_BASE}/create_choices.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({
        question_id,
        choice_label,
        choices_text: String(choices_text ?? ""),
        image_url: cleanUrl || null,
      }),
    });
  }

  const data = await toJsonOrError(res, "เพิ่มคำตอบไม่สำเร็จ");
  const choice_id = extractChoiceId(data);

  return { data, choice_id };
}

async function updateOneChoice({
  choice_id,
  choice_label,
  choices_text,
  image_url,
  image_file,
}) {
  const hasFile = isFileLike(image_file);
  const cleanUrl = cleanStr(image_url);

  let res;

  // IMPORTANT: PHP จะอ่าน multipart ได้ดีสุดเมื่อ method = POST
  if (hasFile) {
    const fd = new FormData();
    fd.append("choice_id", String(choice_id));
    fd.append("choice_label", String(choice_label));
    fd.append("choices_text", String(choices_text ?? ""));
    // ส่ง field นี้เสมอ เพื่อให้ user "ลบรูป" ได้เมื่อเคลียร์ช่อง
    fd.append("image_url", cleanUrl);
    fd.append("image_file", image_file);

    res = await fetch(`${CHOICES_BASE}/update_choices.php`, {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      body: fd,
    });
  } else {
    res = await fetch(`${CHOICES_BASE}/update_choices.php`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({
        choice_id,
        choice_label,
        choices_text: String(choices_text ?? ""),
        // ส่ง field นี้เสมอ เพื่อให้ user "ลบรูป" ได้เมื่อเคลียร์ช่อง
        image_url: cleanUrl || null,
      }),
    });
  }

  const data = await toJsonOrError(res, "แก้ไขคำตอบไม่สำเร็จ");
  return data.data || data;
}

function normalizeOptionsFromPayload(payload) {
  if (Array.isArray(payload?.options)) {
    return payload.options.map((o) => ({
      choice_id: o.choice_id ?? null,
      choice_label: cleanStr(o.choice_text ?? o.choice_label ?? ""),
      choices_text: cleanStr(o.choices_text ?? ""),
      risk_score: Number(o.score ?? o.risk_score ?? 0),
      image_url: cleanStr(o.image_url ?? ""),
      image_file: o.image_file ?? null,
      score_id: o.score_id ?? null,
    }));
  }

  return [
    {
      choice_id: payload?.choice_id ?? null,
      choice_label: cleanStr(payload?.choice_text ?? payload?.choice_label ?? ""),
      choices_text: cleanStr(payload?.choices_text ?? ""),
      risk_score: Number(payload?.score ?? payload?.risk_score ?? 0),
      image_url: cleanStr(payload?.image_url ?? ""),
      image_file: payload?.image_file ?? null,
      score_id: payload?.score_id ?? null,
    },
  ];
}

export async function updateAnswerApi(payload) {
  const question_id = Number(payload?.question_id);
  const disease_id =
    payload?.disease_id != null && payload?.disease_id !== ""
      ? Number(payload.disease_id)
      : null;

  const options = normalizeOptionsFromPayload(payload);
  const wantSingleReturn = !Array.isArray(payload?.options);

  const results = [];

  for (const opt of options) {
    let choice_id = opt.choice_id ? Number(opt.choice_id) : null;
    let data;

    if (choice_id) {
      data = await updateOneChoice({
        choice_id,
        choice_label: opt.choice_label,
        choices_text: opt.choices_text,
        image_url: opt.image_url,
        image_file: opt.image_file,
      });
    } else {
      const created = await createOneChoice({
        question_id,
        choice_label: opt.choice_label,
        choices_text: opt.choices_text,
        image_url: opt.image_url,
        image_file: opt.image_file,
      });
      data = created.data;
      choice_id = created.choice_id;
    }

    if (disease_id && question_id && choice_id) {
      await upsertScore({
        disease_id,
        question_id,
        choice_id,
        risk_score: Number(opt.risk_score || 0),
        score_id: opt.score_id,
      });
    }

    results.push({
      choice_id,
      choice_label: opt.choice_label,
      choices_text: opt.choices_text,
      risk_score: Number(opt.risk_score || 0),
      image_url: opt.image_url || null,
      data,
    });
  }

  if (wantSingleReturn) {
    const first = results[0] || {};
    return first.data || first;
  }

  return { ok: true, results };
}
