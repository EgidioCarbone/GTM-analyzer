import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ContainerManagerPage from "./pages/ContainerManagerPage";
import PlanPage from "./pages/PlanPage";
import TestingPage from "./pages/TestingPage";
import MigrationPage from "./pages/MigrationPage";
import { useContainer } from "./context/ContainerContext";
import { Toaster, toast } from "react-hot-toast";
import SSDTestPage from "./pages/SSDTestPage";
import ConsentTestBPage from "./ai-sentinel/ConsentTestBPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DashboardErrorBoundary, ContainerManagerErrorBoundary } from "./components/ErrorBoundaries";
import GA4Insights from "./pages/GA4Insights"; 
import DashboardSource from "./pages/DashboardSource";
import DashboardStudio from "./pages/DashboardStudio";


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
    const protectedRoutes = ['/container-manager', '/plan', '/testing', '/migration'];
    if (!container && protectedRoutes.includes(location.pathname)) {
      navigate("/home");
    }
  }, [container, navigate, location.pathname]);

  return (
    <ErrorBoundary>
      <div className={`min-h-screen font-sans relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-all duration-300 ${container ? 'pl-64' : ''}`}>
        {/* Sfondo pulito: rimosse le bolle decorative per look enterprise */}

        <Toaster position="top-right" />

        {/* Sidebar solo se c'è container */}
        {container && <Sidebar />}

<main className="space-y-6 transition-colors relative z-10 text-slate-700 dark:text-slate-300">
          <Routes>
            {/* Route iniziale */}
            <Route path="/" element={<Navigate to="/home" />} />

            {/* Pagina iniziale */}
            <Route path="/home" element={<HomePage />} />

            {/* Dashboard */}
            <Route path="/dashboard" element={
              <DashboardErrorBoundary>
                <DashboardPage />
              </DashboardErrorBoundary>
            } />

            {/* Route pubbliche */}
            <Route path="/ssd-test" element={<SSDTestPage />} />
            <Route path="/ai-sentinel" element={<ConsentTestBPage />} />
            <Route path="/ga4" element={<GA4Insights />} />
            <Route path="/dashboard-studio/source" element={<DashboardSource />} />
            <Route path="/dashboard-studio" element={<DashboardStudio />} />

            {/* Route protette */}
            {container && (
              <>
                <Route path="/container-manager" element={
                  <ContainerManagerErrorBoundary>
                    <ContainerManagerPage />
                  </ContainerManagerErrorBoundary>
                } />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/testing" element={<TestingPage />} />
                <Route path="/migration" element={<MigrationPage />} />
              </>
            )}

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/home" />} />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
}
