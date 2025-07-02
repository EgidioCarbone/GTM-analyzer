// src/App.tsx

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import TagsPage from "./pages/TagsPage";
import TriggersPage from "./pages/TriggersPage";
import VariablesPage from "./pages/VariablesPage";
import PlanPage from "./pages/PlanPage";
import TestingPage from "./pages/TestingPage";
import { useContainer } from "./context/ContainerContext";

export default function App() {
  const { container, setContainer } = useContainer();

  return (
    <div className="flex h-screen font-sans bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="fixed top-0 left-0 h-full w-64">
        <Sidebar />
      </div>

      <main className="flex-1 ml-64 overflow-y-auto p-6 space-y-6">
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