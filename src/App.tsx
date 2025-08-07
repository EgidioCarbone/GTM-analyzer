// src/App.tsx

import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import TagsPage from "./pages/TagsPage";
import TriggersPage from "./pages/TriggersPage";
import VariablesPage from "./pages/VariablesPage";
import PlanPage from "./pages/PlanPage";
import TestingPage from "./pages/TestingPage";
import MigrationPage from "./pages/MigrationPage";
import { useContainer } from "./context/ContainerContext";
import { Toaster, toast } from "react-hot-toast";
import ChecklistPage from "./pages/ChecklistPage";

export default function App() {
  const { container } = useContainer();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const saved = localStorage.getItem("gtmContainer");
    if (saved) {
      toast.success("✅ Container ripristinato dall’ultima sessione.");
    }
  }, []);

  useEffect(() => {
    if (!container && location.pathname !== "/dashboard") {
      navigate("/dashboard");
    }
  }, [container, location.pathname, navigate]);

  return (
    <div className="min-h-screen font-sans relative pl-64 overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-black">
      {/* Sfondo artistico identico a PlanPage */}
      <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-purple-400 opacity-30 blur-3xl rounded-full z-0" />
      <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-pink-400 opacity-30 blur-3xl rounded-full z-0" />

      <Toaster position="top-right" />
      <Sidebar />

      <main className="space-y-6 transition-colors relative z-10">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/triggers" element={<TriggersPage />} />
          <Route path="/variables" element={<VariablesPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/testing" element={<TestingPage />} />
          <Route path="/migration" element={<MigrationPage />} />
          <Route path="/checklist" element={<ChecklistPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
}