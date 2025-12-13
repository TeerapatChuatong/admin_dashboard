// src/pages/AdminDiseasesPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "http://localhost/CRUD/api";

// (ไม่บังคับ) ใช้สำหรับพรีวิวรูปที่เป็น path เช่น uploads/disease/xxx.jpg
// ตัวอย่าง: VITE_BACKEND_ORIGIN=http://localhost/CRUD
const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || "";

export default function AdminDiseasesPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  const selected = useMemo(
    () => items.find((x) => String(x.disease_id) === String(selectedId)) || null,
    [items, selectedId]
  );

  const [form, setForm] = useState({
    disease_id: "",
    disease_en: "",
    disease_th: "",
    description: "",
    causes: "",
    symptoms: "",
    image_url: "",
  });

  // ✅ สำหรับอัปโหลดรูปจากเครื่อง
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const fileRef = useRef(null);

  function buildImgSrc(image_url) {
    if (!image_url) return "";
    if (/^https?:\/\//i.test(image_url)) return image_url;
    if (!BACKEND_ORIGIN) return image_url; // ถ้าไม่ตั้ง origin จะพยายามโหลดจาก vite
    return `${BACKEND_ORIGIN}/${String(image_url).replace(/^\/+/, "")}`;
  }

  async function loadDiseases() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/diseases/read_diseases.php`, {
        method: "GET",
        credentials: "include",
      });

      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || "โหลดข้อมูลโรคไม่สำเร็จ");
      }

      const data = json?.data ?? json;
      const list = Array.isArray(data) ? data : [];
      setItems(list);

      if (!selectedId && list.length) setSelectedId(String(list[0].disease_id));
      if (!list.length) setSelectedId("");
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDiseases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync ฟอร์มเมื่อเลือกโรค
  useEffect(() => {
    if (!selected) return;

    setForm({
      disease_id: selected.disease_id ?? "",
      disease_en: selected.disease_en ?? "",
      disease_th: selected.disease_th ?? "",
      description: selected.description ?? "",
      causes: selected.causes ?? "",
      symptoms: selected.symptoms ?? "",
      image_url: selected.image_url ?? "",
    });

    // เคลียร์ไฟล์ที่เลือกไว้ตอนเปลี่ยนโรค
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected]);

  // เคลียร์ objectURL ตอน unmount
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;

    // เคลียร์ preview เก่า
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");

    setImageFile(f);

    if (f) {
      const url = URL.createObjectURL(f);
      setImagePreview(url);
    }
  }

  function removePickedFile() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    setImageFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSave() {
    setErr("");
    try {
      let res;

      // ✅ ถ้ามีไฟล์ -> ส่งแบบ FormData
      if (imageFile) {
        const fd = new FormData();
        fd.append("disease_id", form.disease_id);
        fd.append("disease_en", form.disease_en);
        fd.append("disease_th", form.disease_th);
        fd.append("description", form.description);
        fd.append("causes", form.causes);
        fd.append("symptoms", form.symptoms);
        fd.append("image_url", form.image_url); // เผื่ออยากเก็บเป็น URL/Path เอง
        fd.append("image", imageFile);          // ✅ สำคัญ: field name ต้องเป็น "image"

        res = await fetch(`${API_BASE}/diseases/update_diseases.php`, {
          method: "POST",
          credentials: "include",
          body: fd, // ห้ามใส่ Content-Type เอง
        });
      } else {
        // ✅ ไม่มีไฟล์ -> ส่ง JSON ปกติ
        res = await fetch(`${API_BASE}/diseases/update_diseases.php`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }

      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || "บันทึกไม่สำเร็จ");
      }

      await loadDiseases();
      removePickedFile();
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    }
  }

  return (
    <div className="page">
      <header
        className="page-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="btn ghost" to="/admin">
            ← กลับหน้าเมนู
          </Link>
          <h1 style={{ margin: 0 }}>จัดการคำอธิบายโรค</h1>
        </div>

        <div className="header-right" style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={loadDiseases}>
            รีเฟรช
          </button>
        </div>
      </header>

      {err ? (
        <div className="card" style={{ border: "1px solid #fee2e2" }}>
          <b style={{ color: "#b91c1c" }}>Error:</b> {err}
        </div>
      ) : null}

      {/* เลือกโรค */}
      <div className="card" style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>
          เลือกโรค
        </label>

        <select
          className="input"
          value={selectedId}
          disabled={loading}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12 }}
        >
          <option value="">{loading ? "กำลังโหลด..." : "-- เลือกโรค --"}</option>
          {items.map((d) => (
            <option key={d.disease_id} value={String(d.disease_id)}>
              {d.disease_th}
            </option>
          ))}
        </select>
      </div>

      {/* รายละเอียดโรค */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>รายละเอียดโรค</h3>

        {!selectedId ? (
          <div style={{ color: "#6b7280" }}>กรุณาเลือกโรคก่อน</div>
        ) : !selected ? (
          <div style={{ color: "#6b7280" }}>กำลังโหลดข้อมูลโรค…</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>ชื่ออังกฤษ</label>
                <input
                  className="input"
                  value={form.disease_en}
                  onChange={(e) => setForm((s) => ({ ...s, disease_en: e.target.value }))}
                />
              </div>
              <div>
                <label>ชื่อไทย</label>
                <input
                  className="input"
                  value={form.disease_th}
                  onChange={(e) => setForm((s) => ({ ...s, disease_th: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label>คำอธิบาย</label>
              <textarea
                className="input"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                style={{ resize: "none" }}
              />
            </div>

            <div>
              <label>สาเหตุ</label>
              <textarea
                className="input"
                rows={3}
                value={form.causes}
                onChange={(e) => setForm((s) => ({ ...s, causes: e.target.value }))}
                style={{ resize: "none" }}
              />
            </div>

            <div>
              <label>อาการ</label>
              <textarea
                className="input"
                rows={3}
                value={form.symptoms}
                onChange={(e) => setForm((s) => ({ ...s, symptoms: e.target.value }))}
                style={{ resize: "none" }}
              />
            </div>

            {/* ✅ รูป: ใส่ path/URL ได้ + เลือกจากเครื่องได้ */}
            <div>
              <label>รูป</label>
              <input
                className="input"
                value={form.image_url}
                onChange={(e) => setForm((s) => ({ ...s, image_url: e.target.value }))}
                placeholder="URL"
              />

              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFile}
                />

                {imageFile ? (
                  <button className="btn ghost" type="button" onClick={removePickedFile}>
                    ลบไฟล์ที่เลือก
                  </button>
                ) : null}
              </div>

              {/* พรีวิวรูป */}
              <div style={{ marginTop: 10 }}>
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="preview"
                    style={{
                      width: 260,
                      height: 160,
                      objectFit: "cover",
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                ) : form.image_url ? (
                  <img
                    src={buildImgSrc(form.image_url)}
                    alt="current"
                    style={{
                      width: 260,
                      height: 160,
                      objectFit: "cover",
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                    }}
                    onError={(e) => {
                      // ถ้ารูปไม่โหลด (path ไม่ถูก / origin ไม่ตั้ง) ก็ซ่อน
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>ยังไม่มีรูป</div>
                )}
              </div>

              {!BACKEND_ORIGIN && form.image_url && !/^https?:\/\//i.test(form.image_url) ? (
                <div style={{ marginTop: 6, color: "#ef4444", fontSize: 12 }}>
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={onSave}>
                บันทึก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
