import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import TagsPage from "./pages/TagsPage";
import TriggersPage from "./pages/TriggersPage";
import VariablesPage from "./pages/VariablesPage";
import PlanPage from "./pages/PlanPage";
import TestingPage from "./pages/TestingPage";
import { useContainer } from "./context/ContainerContext";
import useUnloadWarning from "./hooks/useUnloadWarning"; // 🔹 import

export default function App() {
  const { container } = useContainer();
  const [page, setPage] = useState("dashboard");

  const location = useLocation();
  const navigate = useNavigate();

  // 🔹 Mostra il warning di conferma prima di ricaricare
  useUnloadWarning(!!container);

  // 🔹 Se NON c'è il JSON caricato e non sei su /dashboard, torna su /dashboard
  useEffect(() => {
    if (!container && location.pathname !== "/dashboard" && location.pathname !== "/") {
      navigate("/dashboard");
    }
  }, [container, location.pathname, navigate]);

  return (
    <div className="flex min-h-screen font-sans">
      <Sidebar current={page} setCurrent={setPage} disabled={!container} />
      <main className="flex-1 p-6 bg-gray-50 overflow-y-auto">
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