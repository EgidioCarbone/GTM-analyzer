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
import DashboardHome from "./pages/DashboardHome";
import LiveDebuggerPage from "./pages/LiveDebuggerPage";
import { Ga4PropertyProvider } from "./context/Ga4PropertyContext";
import { DashboardStoreProvider } from "./context/DashboardStoreContext";
import DashboardBuilder from "./pages/DashboardBuilder";
import DashboardPublic from "./pages/DashboardPublic";

export default function App() {
  const { container } = useContainer();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const saved = localStorage.getItem("gtmContainer");
    if (saved) {
      toast.success("Container ripristinato dall'ultima sessione.");
    }
  }, []);

  useEffect(() => {
    const protectedRoutes = ["/container-manager", "/plan", "/testing", "/migration"];
    if (!container && protectedRoutes.includes(location.pathname)) {
      navigate("/home");
    }
  }, [container, navigate, location.pathname]);

  return (
    <Ga4PropertyProvider>
      <DashboardStoreProvider>
        <ErrorBoundary>
          <div
            className={`min-h-screen font-sans relative overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-black transition-all duration-300`}
          >
            {/* Sfondo artistico */}
            <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-purple-400 opacity-30 blur-3xl rounded-full z-0" />
            <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-pink-400 opacity-30 blur-3xl rounded-full z-0" />

            <Toaster position="top-right" />

            {/* Sidebar off-canvas sempre disponibile */}
            <Sidebar />

            <main className="space-y-6 transition-colors relative z-10">
              <Routes>
                {/* Route iniziale */}
                <Route path="/" element={<Navigate to="/home" />} />

                {/* Pagina iniziale */}
                <Route path="/home" element={<HomePage />} />

                {/* Dashboard */}
                <Route
                  path="/dashboard"
                  element={
                    <DashboardErrorBoundary>
                      <DashboardPage />
                    </DashboardErrorBoundary>
                  }
                />

                {/* Route pubbliche */}
                <Route path="/ssd-test" element={<SSDTestPage />} />
                <Route path="/ai-sentinel" element={<ConsentTestBPage />} />
                <Route path="/ga4-insights" element={<GA4Insights />} />
                <Route path="/ga4" element={<GA4Insights />} />
                <Route path="/dashboard-studio/source" element={<DashboardSource />} />
                <Route path="/dashboard-studio/run" element={<DashboardStudio />} />
                <Route path="/dashboard-studio" element={<DashboardHome />} />
                <Route path="/dashboard-builder" element={<DashboardBuilder />} />
                <Route path="/dashboards/:id/public" element={<DashboardPublic />} />
                <Route path="/live-debugger" element={<LiveDebuggerPage />} />

                {/* Route protette */}
                {container && (
                  <>
                    <Route
                      path="/container-manager"
                      element={
                        <ContainerManagerErrorBoundary>
                          <ContainerManagerPage />
                        </ContainerManagerErrorBoundary>
                      }
                    />
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
      </DashboardStoreProvider>
    </Ga4PropertyProvider>
  );
}
