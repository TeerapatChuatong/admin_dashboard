// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import AdminHomePage from "./pages/AdminHomePage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminQuestionsPage from "./pages/AdminQuestionsPage";
import AdminAnswersPage from "./pages/AdminAnswersPage";
import AdminTreatmentsPage from "./pages/AdminTreatmentsPage";
import AdminDiseasesPage from "./pages/AdminDiseasesPage";

import AdminChemicalsAndMOAGroupsPage from "./pages/AdminChemicalsAndMOAGroupsPage";
import AdminMoaPlanAndAllowedChemicalsPage from "./pages/AdminMoaPlanAndAllowedChemicalsPage";

import RequireAdmin from "./components/RequireAdmin";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminHomePage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/users"
        element={
          <RequireAdmin>
            <AdminUsersPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/questions"
        element={
          <RequireAdmin>
            <AdminQuestionsPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/answers"
        element={
          <RequireAdmin>
            <AdminAnswersPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/treatments"
        element={
          <RequireAdmin>
            <AdminTreatmentsPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/diseases"
        element={
          <RequireAdmin>
            <AdminDiseasesPage />
          </RequireAdmin>
        }
      />

      {/* ❌ ลบหน้า: Vector Mapping (redirect กลับหน้าแอดมิน) */}
      <Route
        path="/admin/vector-mappings"
        element={
          <RequireAdmin>
            <Navigate to="/admin" replace />
          </RequireAdmin>
        }
      />

      {/* ✅ ยุบ: สารเคมี + กลุ่ม MOA ให้อยู่หน้าเดียว */}
      <Route
        path="/admin/chemicals"
        element={
          <RequireAdmin>
            <AdminChemicalsAndMOAGroupsPage />
          </RequireAdmin>
        }
      />

      {/* ✅ ยุบ: แผนหมุนเวียน MOA + สารที่อนุญาต ให้อยู่หน้าเดียว */}
      <Route
        path="/admin/moa-plan"
        element={
          <RequireAdmin>
            <AdminMoaPlanAndAllowedChemicalsPage />
          </RequireAdmin>
        }
      />

      {/* ✅ ลิงก์เก่า: redirect ไปหน้าที่ถูกรวมแล้ว */}
      <Route
        path="/admin/moa-groups"
        element={
          <RequireAdmin>
            <Navigate to="/admin/chemicals" replace />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/allowed-chemicals"
        element={
          <RequireAdmin>
            <Navigate to="/admin/moa-plan" replace />
          </RequireAdmin>
        }
      />

      {/* ✅ ลบหน้า: กฎระดับความเสี่ยง / สรุปการสลับ MOA (redirect กลับหน้าแอดมิน) */}
      <Route
        path="/admin/risk-level-rules"
        element={
          <RequireAdmin>
            <Navigate to="/admin" replace />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/rotation-summary"
        element={
          <RequireAdmin>
            <Navigate to="/admin" replace />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
