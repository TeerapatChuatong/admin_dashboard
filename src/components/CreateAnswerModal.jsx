import React, { useEffect, useMemo, useState } from "react";

import { createAnswerApi } from "../api/createAnswerApi";
import { readAnswersApi } from "../api/readAnswersApi";
import { readChemicalsApi } from "../api/chemicalsApi";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(16,185,129,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: 20};

const modalStyle = {
  width: "min(980px, 96vw)",
  maxHeight: "92vh",
  background: "var(--surface)",
  borderRadius: 20,
  overflow: "hidden",
  boxShadow: "0 10px 25px -5px rgba(16,185,129,0.15)",
  display: "flex",
  flexDirection: "column"};

const headerStyle = {
  padding: 18,
  borderBottom: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12};

const bodyStyle = {
  padding: 18,
  overflow: "auto",
  WebkitOverflowScrolling: "touch",
  flex: "1 1 auto"};

const footerStyle = {
  padding: 18,
  borderTop: "none",
  display: "flex",
  justifyContent: "flex-end",
  gap: 12};

function newOption() {
  return {
    choice_text: "",
    choices_text: "",
    score: 0,
    image_url: "",
    image_file: null,
    chemical_id: "",
    _preview: ""};
}

function revokePreview(opt) {
  if (opt && opt._preview) {
    try {
      URL.revokeObjectURL(opt._preview);
    } catch {}
  }
}

export default function CreateAnswerModal({
  open,
  onClose,
  question,
  diseaseId,
  onCreated}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const questionType = question?.question_type || "multi";

  // ✅ สำหรับคำถามเกี่ยวกับสารเคมี (disease_id=8): ให้เลือกกรอกเอง หรือเลือกจากตารางสารเคมี
  const isChemicalDisease = Number(diseaseId) === 8;
  const canUseChemicalDropdown = isChemicalDisease && questionType !== "yes_no";
  const [useChemicalDropdown, setUseChemicalDropdown] = useState(false);
  const [chemicals, setChemicals] = useState([]);
  const [chemLoading, setChemLoading] = useState(false);
  const [chemErr, setChemErr] = useState("");

  // default: ถ้าเป็น disease_id=8 และไม่ใช่ yes_no ให้เปิดโหมดดรอปดาวน์อัตโนมัติ
  useEffect(() => {
    if (!open) return;
    setUseChemicalDropdown(canUseChemicalDropdown);
  }, [open, canUseChemicalDropdown, question?.question_id]);

  // โหลดรายการสารเคมีเมื่อเปิดโหมดดรอปดาวน์
  useEffect(() => {
    if (!open || !useChemicalDropdown) return;
    let alive = true;
    setChemErr("");
    setChemLoading(true);
    readChemicalsApi()
      .then((data) => {
        if (!alive) return;
        setChemicals(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!alive) return;
        setChemicals([]);
        setChemErr(e?.message || String(e));
      })
      .finally(() => {
        if (!alive) return;
        setChemLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, useChemicalDropdown]);

  // ถ้ามีข้อความคำตอบเดิม ตรงกับ trade_name ให้ map chemical_id ให้เอง (ช่วยตอนแก้ไข/สลับโหมด)
  useEffect(() => {
    if (!open || !useChemicalDropdown) return;
    if (!Array.isArray(chemicals) || chemicals.length < 1) return;
    setOptions((prev) =>
      prev.map((o) => {
        if (o?.chemical_id) return o;
        const t = String(o?.choice_text || "").trim();
        if (!t) return o;
        const hit = chemicals.find(
          (c) => String(c?.trade_name || "").trim() === t
        );
        if (!hit) return o;
        return { ...o, chemical_id: String(hit.chemical_id) };
      })
    );
  }, [open, useChemicalDropdown, chemicals]);

  // (ไม่จำเป็นต้องใช้ res แต่คงไว้ตามโค้ดเดิมของคุณ)
  useEffect(() => {
    if (!open) return;
    readAnswersApi?.().catch(() => {});
  }, [open]);

  const [yesNoSet, setYesNoSet] = useState("yes_no");
  const yesNoLabels = useMemo(() => {
    if (yesNoSet === "found_notfound") return ["พบ", "ไม่พบ"];
    return ["ใช่", "ไม่ใช่"];
  }, [yesNoSet]);

  // ✅ FIX: เริ่มต้น 1 คำตอบ (ยกเว้น yes_no จะถูก set ใน effect)
  const [options, setOptions] = useState([newOption()]);

  // init เมื่อเปิด modal / เปลี่ยนชนิดคำถาม
  useEffect(() => {
    if (!open) return;

    setErr("");
    setLoading(false);

    // เคลียร์ preview เดิม (ถ้ามี)
    setOptions((prev) => {
      prev.forEach(revokePreview);
      return [];
    });

    if (questionType === "yes_no") {
      setYesNoSet("yes_no");
      setOptions([
        { ...newOption(), choice_text: yesNoLabels[0] },
        { ...newOption(), choice_text: yesNoLabels[1] },
      ]);
    } else {
      setOptions([newOption()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question?.question_id, questionType]);

  const setOpt = (idx, patch) => {
    setOptions((prev) => {
      const next = [...prev];
      const old = next[idx];
      if (patch.image_file && old?._preview) revokePreview(old);
      next[idx] = { ...old, ...patch };
      return next;
    });
  };

  const addOption = () => setOptions((prev) => [...prev, newOption()]);

  const removeOption = (idx) => {
    setOptions((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      revokePreview(removed);
      return next.length ? next : [newOption()];
    });
  };

  const handlePickFile = (idx, file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOpt(idx, { image_file: file, _preview: url });
  };

  const validate = () => {
    if (!question?.question_id) return "ไม่พบ question_id";
    if (!diseaseId) return "ไม่พบ diseaseId";
    if (!Array.isArray(options) || options.length < 1)
      return "ต้องมีคำตอบอย่างน้อย 1 ข้อ";

    if (questionType === "yes_no") {
      if (options.length !== 2) return "yes/no ต้องมี 2 ตัวเลือก";
    }

    const hasEmpty = options.some((o) => !String(o.choice_text || "").trim());
    if (hasEmpty) return "กรุณากรอกข้อความคำตอบให้ครบ";

    for (const o of options) {
      const sc = Number(o.score ?? 0);
      if (Number.isNaN(sc)) return "คะแนนต้องเป็นตัวเลข";
    }

    return "";
  };

  const handleSubmit = async () => {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setErr("");
    setLoading(true);
    try {
      await createAnswerApi({
        disease_id: Number(diseaseId),
        question_id: Number(question.question_id),
        question_type: questionType,
        options: options.map((o) => ({
          choice_text: String(o.choice_text || "").trim(),
          choices_text: String(o.choices_text || "").trim(),
          score: Number(o.score ?? 0),
          image_url: String(o.image_url || "").trim(),
          image_file: o.image_file || null}))});

      onCreated?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div style={overlayStyle} onMouseDown={onClose}>
      <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="t-title">
              เพิ่มคำตอบ: {question?.question_text || ""}
            </div>
            <div style={{ color: "#666" }}>
              question_type: <b>{questionType}</b>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {canUseChemicalDropdown ? (
              <label
                className="t-label" style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#444",
                  userSelect: "none"}}
              >
                <input
                  type="checkbox"
                  checked={useChemicalDropdown}
                  onChange={(e) => setUseChemicalDropdown(e.target.checked)}
                />
                เลือกจากตารางสารเคมี
                {useChemicalDropdown && chemLoading ? (
                  <span style={{ color: "#666" }}>(กำลังโหลด...)</span>
                ) : null}
              </label>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "1px solid #ddd",
                background: "#fff",
                padding: "6px 10px",
                borderRadius: 10,
                cursor: "pointer"}}
            >
              ปิด
            </button>
          </div>
        </div>

        <div style={bodyStyle}>
          {err ? (
            <div
              style={{
                background: "#ffe9e9",
                color: "#b00020",
                padding: 10,
                borderRadius: 10,
                marginBottom: 12,
                border: "1px solid #ffc7c7"}}
            >
              {err}
            </div>
          ) : null}

          {useChemicalDropdown && chemErr ? (
            <div
              style={{
                background: "#fff7e6",
                color: "#8a4b00",
                padding: 10,
                borderRadius: 10,
                marginBottom: 12,
                border: "1px solid #ffd9a8"}}
            >
              โหลดสารเคมีไม่สำเร็จ: {chemErr}
            </div>
          ) : null}

          {questionType === "yes_no" ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#666", marginBottom: 6 }}>
                ชุดคำตอบ yes/no (เลือกเพื่อช่วยตั้งค่าอัตโนมัติ)
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setYesNoSet("yes_no");
                    setOptions([
                      { ...newOption(), choice_text: "ใช่" },
                      { ...newOption(), choice_text: "ไม่ใช่" },
                    ]);
                  }}
                  style={{
                    border: "1px solid #ddd",
                    background: yesNoSet === "yes_no" ? "#ffeede" : "#fff",
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontWeight: 700,
                    color: "#cc6b00"}}
                >
                  ใช่/ไม่ใช่
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setYesNoSet("found_notfound");
                    setOptions([
                      { ...newOption(), choice_text: "พบ" },
                      { ...newOption(), choice_text: "ไม่พบ" },
                    ]);
                  }}
                  style={{
                    border: "1px solid #ddd",
                    background:
                      yesNoSet === "found_notfound" ? "#ffeede" : "#fff",
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontWeight: 700,
                    color: "#cc6b00"}}
                >
                  พบ/ไม่พบ
                </button>
              </div>
            </div>
          ) : null}

          <div className="t-title" style={{ marginBottom: 8 }}>รายการคำตอบ</div>

          <div style={{ display: "grid", gap: 12 }}>
            {options.map((opt, idx) => {
              const preview = opt._preview;
              const imgSrc = preview || opt.image_url;

              return (
                <div
                  key={`opt-${idx}`}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fafafa"}}
                >
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 320px" }}>
                      <div style={{ color: "#666", marginBottom: 4 }}>
                        ข้อความคำตอบ
                      </div>

                      {useChemicalDropdown ? (
                        <select
                          value={opt.chemical_id || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const hit = (chemicals || []).find(
                              (c) => String(c?.chemical_id) === String(v)
                            );
                            setOpt(idx, {
                              chemical_id: v,
                              choice_text: hit
                                ? String(hit.trade_name || "").trim()
                                : ""});
                          }}
                          disabled={chemLoading}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            outline: "none",
                            background: chemLoading ? "#f6f6f6" : "#fff"}}
                        >
                          <option value="">
                            {chemLoading
                              ? "กำลังโหลดสารเคมี..."
                              : "-- เลือกสารเคมี --"}
                          </option>
                          {(chemicals || []).map((c) => (
                            <option key={c.chemical_id} value={String(c.chemical_id)}>
                              {String(c.trade_name || "").trim()}
                              {c.active_ingredient
                                ? ` (${String(c.active_ingredient).trim()})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={opt.choice_text}
                          onChange={(e) => setOpt(idx, { choice_text: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            outline: "none"}}
                        />
                      )}
                    </div>

                    <div style={{ flex: "1 1 320px" }}>
                      <div style={{ color: "#666", marginBottom: 4 }}>
                        คำแนะนำ (ไม่บังคับ)
                      </div>
                      <textarea
                        rows={2}
                        value={opt.choices_text}
                        onChange={(e) => setOpt(idx, { choices_text: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          outline: "none",
                          resize: "vertical"}}
                      />
                    </div>

                    <div style={{ width: 140 }}>
                      <div style={{ color: "#666", marginBottom: 4 }}>
                        คะแนน
                      </div>
                      <input
                        type="number"
                        value={opt.score}
                        onChange={(e) =>
                          setOpt(idx, { score: Number(e.target.value || 0) })
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          outline: "none"}}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 10,
                      alignItems: "center"}}
                  >
                    <div style={{ flex: "1 1 420px" }}>
                      <div style={{ color: "#666", marginBottom: 4 }}>
                        URL รูป (ไม่บังคับ)
                      </div>
                      <input
                        type="text"
                        value={opt.image_url}
                        onChange={(e) => setOpt(idx, { image_url: e.target.value })}
                        placeholder="เช่น /crud/uploads/choice_images/xxx.jpg"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          outline: "none"}}
                      />
                    </div>

                    <div style={{ flex: "1 1 260px" }}>
                      <div style={{ color: "#666", marginBottom: 4 }}>
                        เลือกรูปจากเครื่อง (ไม่บังคับ)
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePickFile(idx, e.target.files?.[0])}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => removeOption(idx)}
                    >
                      ลบ
                    </button>
                  </div>

                  {imgSrc ? (
                    <div style={{ marginTop: 10 }}>
                      <img
                        src={imgSrc}
                        alt="preview"
                        style={{
                          width: 160,
                          height: 120,
                          objectFit: "cover",
                          borderRadius: 12,
                          border: "1px solid #eee"}}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {questionType !== "yes_no" ? (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={addOption}
                style={{
                  border: "1px solid #ffb166",
                  background: "#fff",
                  padding: "10px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  color: "#cc6b00",
                  fontWeight: 700}}
              >
                + เพิ่มคำตอบ
              </button>
            </div>
          ) : null}
        </div>

        <div style={footerStyle}>
          <div className="formActions">
            <button
              type="button"
              onClick={handleSubmit}
              className="btnBase btnSave"
              disabled={loading}
            >
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btnBase btnCancel"
              disabled={loading}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
