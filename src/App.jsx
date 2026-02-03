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
import AdminChemicalsPage from "./pages/AdminChemicalsPage";

import RequireAdmin from "./components/RequireAdmin";

import AdminMoaRotationPlanPage from "./pages/AdminMoaRotationPlanPage";
import AdminAllowedChemicalsPerGroupPage from "./pages/AdminAllowedChemicalsPerGroupPage";
import AdminRiskLevelRulesPage from "./pages/AdminRiskLevelRulesPage";
import AdminRotationSummaryPage from "./pages/AdminRotationSummaryPage";

// ✅ เพิ่มหน้า MOA Groups
import AdminMOAGroupsPage from "./pages/AdminMOAGroupsPage";

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

      <Route
        path="/admin/chemicals"
        element={
          <RequireAdmin>
            <AdminChemicalsPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/moa-plan"
        element={
          <RequireAdmin>
            <AdminMoaRotationPlanPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/allowed-chemicals"
        element={
          <RequireAdmin>
            <AdminAllowedChemicalsPerGroupPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/risk-level-rules"
        element={
          <RequireAdmin>
            <AdminRiskLevelRulesPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/rotation-summary"
        element={
          <RequireAdmin>
            <AdminRotationSummaryPage />
          </RequireAdmin>
        }
      />

      {/* ✅ เพิ่ม route: MOA Groups */}
      <Route
        path="/admin/moa-groups"
        element={
          <RequireAdmin>
            <AdminMOAGroupsPage />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
