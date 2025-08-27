// src/App.tsx

import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import ContainerManagerPage from "./pages/ContainerManagerPage";
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
      toast.success("✅ Container ripristinato dall'ultima sessione.");
    }
  }, []);

  useEffect(() => {
    // Se non c'è un container, reindirizza sempre alla dashboard
    if (!container) {
      navigate("/dashboard");
    }
  }, [container, navigate]);

  return (
    <div className={`min-h-screen font-sans relative overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-black transition-all duration-300 ${container ? 'pl-64' : ''}`}>
      {/* Sfondo artistico identico a PlanPage */}
      <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-purple-400 opacity-30 blur-3xl rounded-full z-0" />
      <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-pink-400 opacity-30 blur-3xl rounded-full z-0" />

      <Toaster position="top-right" />
      
      {/* Sidebar condizionale - mostra solo quando c'è un container */}
      {container && <Sidebar />}

      <main className="space-y-6 transition-colors relative z-10">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          
          {/* Route protette - accessibili solo quando c'è un container */}
          {container && (
            <>
              <Route path="/container-manager" element={<ContainerManagerPage />} />
              <Route path="/plan" element={<PlanPage />} />
              <Route path="/testing" element={<TestingPage />} />
              <Route path="/migration" element={<MigrationPage />} />
              <Route path="/checklist" element={<ChecklistPage />} />
            </>
          )}
          
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
}