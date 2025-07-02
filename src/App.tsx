import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import TagsPage from "./pages/TagsPage";
import TriggersPage from "./pages/TriggersPage";
import VariablesPage from "./pages/VariablesPage";
import PlanPage from "./pages/PlanPage";
import TestingPage from "./pages/TestingPage";
import { useContainer } from "./context/ContainerContext";
import { Toaster, toast } from "react-hot-toast";

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
    <div className="min-h-screen font-sans bg-gray-50 dark:bg-gray-900 transition-colors pl-64">
      <Toaster position="top-right" />
      <Sidebar />
      <main className="p-6 space-y-6 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/triggers" element={<TriggersPage />} />
          <Route path="/variables" element={<VariablesPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/testing" element={<TestingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
}