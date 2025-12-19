// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import AdminHomePage from "./pages/AdminHomePage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminQuestionsPage from "./pages/AdminQuestionsPage";
import AdminAnswersPage from "./pages/AdminAnswersPage";
import AdminTreatmentsPage from "./pages/AdminTreatmentsPage";

// ✅ เพิ่มหน้านี้ (ต้องมีไฟล์จริง src/pages/AdminDiseasesPage.jsx)
import AdminDiseasesPage from "./pages/AdminDiseasesPage";

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

      {/* ✅ สำคัญ: เพิ่ม route คำอธิบายโรค */}
      <Route
        path="/admin/diseases"
        element={
          <RequireAdmin>
            <AdminDiseasesPage />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
