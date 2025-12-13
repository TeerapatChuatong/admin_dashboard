// src/pages/AdminHomePage.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminHomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <header className="page-header">
        <h1>แผงควบคุมผู้ดูแลระบบ</h1>
        <div className="header-right">
          <span>
            เข้าสู่ระบบเป็น: {user?.username ?? user?.email} ({user?.role})
          </span>
          <button className="btn ghost" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="card">
        <p style={{ marginTop: 0, color: "#6b7280" }}>
          เลือกเมนูที่ต้องการจัดการ
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 8,
          }}
        >
          <Link
            to="/admin/users"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>จัดการผู้ใช้งาน</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              เพิ่ม / แก้ไข / ลบ / ค้นหาผู้ใช้
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้าผู้ใช้งาน</button>
            </div>
          </Link>

          <Link
            to="/admin/questions"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>จัดการคำถาม</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              จัดกลุ่มคำถามตามโรคและเพิ่มคำถามใหม่
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้าคำถาม</button>
            </div>
          </Link>

          <Link
            to="/admin/answers"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>จัดการคำตอบ</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              เพิ่มคำตอบและกำหนดคะแนนให้แต่ละคำตอบ
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้าคำตอบ</button>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
