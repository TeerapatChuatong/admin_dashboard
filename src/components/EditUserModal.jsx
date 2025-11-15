import React, { useState, useEffect } from "react";
import { updateUserApi } from "../api/updateUserApi";

export default function EditUserModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({
    id: null,
    username: "",
    email: "",
    password: "",
    role: "user",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm({
        id: user.id,
        username: user.username || "",
        email: user.email || "",
        password: "",
        role: user.role || "user",
      });
    }
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = { ...form };
      // ถ้าไม่กรอกรหัสผ่านใหม่ → ไม่ส่ง field password ไป
      if (!payload.password) {
        delete payload.password;
      }
      await updateUserApi(payload);
      onSuccess && onSuccess();
    } catch (err) {
      setError(err.message || "แก้ไขไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>แก้ไขผู้ใช้งาน</h2>

        {error && <div className="alert error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="ชื่อผู้ใช้"
            value={form.username}
            onChange={(e) =>
              setForm({ ...form, username: e.target.value })
            }
            required
          />

          <input
            type="email"
            placeholder="อีเมล"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
            required
          />

          {/* รหัสผ่านใหม่ (ถ้าเปลี่ยน) ใช้ input ปกติ ไม่มีปุ่มตาใน JSX */}
          <input
            type="password"
            placeholder="รหัสผ่านใหม่ (ถ้าเปลี่ยน)"
            value={form.password}
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
          />

          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value })
            }
          >
            <option value="user">ผู้ใช้ทั่วไป</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>

          <div className="form-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button className="btn ghost" type="button" onClick={onClose}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
