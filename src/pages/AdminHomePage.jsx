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
        <p style={{ marginTop: 0, color: "#6b7280" }}>เลือกเมนูที่ต้องการจัดการ</p>

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

          {/* ✅ เมนูใหม่: คำแนะนำการรักษา */}
          <Link
            to="/admin/treatments"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>จัดการคำแนะนำการรักษา</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              เพิ่ม/แก้ไขคำแนะนำ + ตั้งค่า min_score/days ตามระดับความรุนแรง
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้าคำแนะนำ</button>
            </div>
          </Link>

          {/* ✅ เมนูคำอธิบายโรค */}
          <Link
            to="/admin/diseases"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>จัดการคำอธิบายโรค</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              แก้ไข description / causes / symptoms / รูปโรค
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้าคำอธิบายโรค</button>
            </div>
          </Link>

          {/* ✅ เมนูใหม่: สารเคมี */}
          <Link
            to="/admin/chemicals"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>จัดการสารเคมี</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              เพิ่ม / แก้ไข / ลบ / ค้นหา สารเคมี + ผูก MOA
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้าสารเคมี</button>
            </div>
          </Link>

          {/* ✅ เพิ่มการ์ดเมนู: จัดการกลุ่ม MOA */}
          <Link
            to="/admin/moa-groups"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>จัดการกลุ่ม MOA</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              เพิ่ม / แก้ไข / ลบ / ค้นหา กลุ่ม MOA (เช่น 1A, 2A, 1B, 2B)
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้ากลุ่ม MOA</button>
            </div>
          </Link>

          {/* ✅ เมนูใหม่: แผนสลับกลุ่ม MOA */}
          <Link
            to="/admin/moa-plan"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>แผนสลับกลุ่ม MOA</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              ตั้งค่า/กำหนดแผนการหมุนเวียนกลุ่ม MOA ตามรอบการพ่น
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้า MOA Plan</button>
            </div>
          </Link>

          {/* ✅ เมนูใหม่: สารเคมีที่อนุญาตต่อกลุ่ม */}
          <Link
            to="/admin/allowed-chemicals"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>สารเคมีที่อนุญาตต่อกลุ่ม</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              กำหนดรายการสารเคมีที่ใช้ได้ในแต่ละกลุ่ม MOA
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้า Allowed</button>
            </div>
          </Link>

          {/* ✅ เมนูใหม่: กฎระดับความเสี่ยง */}
          <Link
            to="/admin/risk-level-rules"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>กฎระดับความเสี่ยง</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              จัดการเงื่อนไข/กฎการเลือกกลุ่ม/สาร ตามระดับความเสี่ยงของโรค
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้า Rules</button>
            </div>
          </Link>

          {/* ✅ เมนูใหม่: สรุปการสลับ MOA */}
          <Link
            to="/admin/rotation-summary"
            className="card"
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid #f3f4f6",
            }}
          >
            <h2 style={{ margin: 0 }}>สรุปการสลับ MOA</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              ดูสรุปแผนการหมุนเวียนกลุ่ม MOA และผลการจัดตาราง
            </span>
            <div style={{ marginTop: 8 }}>
              <button className="btn xs">ไปหน้า Summary</button>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
