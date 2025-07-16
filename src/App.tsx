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
import MigrationPage from "./pages/MigrationPage";

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
    <div className="min-h-screen font-sans relative pl-64 overflow-hidden">
      {/* 🌀 SFONDO ARTISTICO */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[40%] left-[60%] w-[400px] h-[400px] bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-[80%] left-[30%] w-[400px] h-[400px] bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <Toaster position="top-right" />
      <Sidebar />

      <main className="space-y-6 transition-colors">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/triggers" element={<TriggersPage />} />
          <Route path="/variables" element={<VariablesPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/testing" element={<TestingPage />} />
          <Route path="/migration" element={<MigrationPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
}