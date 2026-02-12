import React, { useEffect, useState } from "react";
import { updateUserApi } from "../api/updateUserApi";

export default function EditUserModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({
    id: user?.id,
    username: user?.username || "",
    email: user?.email || "",
    password: "",
    role: user?.role || "user",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      id: user?.id,
      username: user?.username || "",
      email: user?.email || "",
      password: "",
      role: user?.role || "user",
    });
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        id: form.id,
        username: String(form.username || "").trim(),
        email: String(form.email || "").trim(),
        role: String(form.role || "user"),
      };

      // only send password if user provided a new one
      if (String(form.password || "").trim()) {
        payload.password = String(form.password);
      }

      await updateUserApi(payload);
      onSuccess && onSuccess();
    } catch (err) {
      setError(err.message || "อัปเดตผู้ใช้ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>แก้ไขผู้ใช้งาน</h2>
        {error && <div className="alert error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="ชื่อผู้ใช้ (username)"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />

          <input
            type="email"
            placeholder="อีเมล"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />

          <input
            type="password"
            placeholder="รหัสผ่านใหม่ (เว้นว่างเพื่อไม่เปลี่ยน)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="user">ผู้ใช้ทั่วไป</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>

          <div className="form-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button className="btn-cancel" type="button" onClick={onClose}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
