import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useContainer } from "./context/ContainerContext";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import TagsPage from "./pages/TagsPage";
import TriggersPage from "./pages/TriggersPage";
import VariablesPage from "./pages/VariablesPage";
import PlanPage from "./pages/PlanPage";
import TestingPage from "./pages/TestingPage";

export default function App() {
  const { container } = useContainer();     // stato globale JSON
  const [page, setPage] = useState("dashboard");

  return (
    <div className="flex min-h-screen font-sans">
      <Sidebar current={page} setCurrent={setPage} disabled={!container} />

      <main className="flex-1 p-6 space-y-6 bg-gray-50 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/triggers" element={<TriggersPage />} />
          <Route path="/variables" element={<VariablesPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/testing" element={<TestingPage />} />
        </Routes>
      </main>
    </div>
  );
}