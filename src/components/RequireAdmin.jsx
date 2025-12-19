// src/components/RequireAdmin.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAdmin({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page">
        <div className="card">กำลังตรวจสอบการเข้าสู่ระบบ...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === "admin" || user.role === "super_admin";

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="card">
          <h2>ไม่มีสิทธิ์เข้าถึง</h2>
          <p>หน้านี้สำหรับผู้ดูแลระบบ (admin / super admin) เท่านั้น</p>
        </div>
      </div>
    );
  }

  return children;
}
