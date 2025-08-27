import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Upload, Download, Moon, Sun, Brain, Settings, LayoutDashboard, Target, Shield, ChevronDown, ChevronUp } from "lucide-react";
import useDarkMode from "../hooks/useDarkMode";
import { useContainer } from "../context/ContainerContext";

export default function Sidebar() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const links = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/container-manager", label: "Container Manager", icon: Settings },
    { to: "/plan", label: "AI Plan", icon: Target },
    // { to: "/testing", label: "Testing" },
    // { to: "/migration", label: "UA → GA4" },
    { to: "/checklist", label: "AI Sentinel", icon: Shield },
  ];

  const [isDark, setIsDark] = useDarkMode();
  const { container, setContainer } = useContainer();
  const navigate = useNavigate();

  const handleDownload = () => {
    if (!container) return;
    const blob = new Blob([JSON.stringify(container, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gtm-container.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReplaceJSON = () => {
    localStorage.removeItem("gtmContainer");
    setContainer(null);
    navigate("/dashboard");
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-[#1a365d] text-white flex flex-col justify-between py-6 shadow-md animate-slideIn">
      {/* Header */}
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold px-4">
          <Brain className="w-6 h-6 text-pink-400" />
          <span>
            LikeSense <br />
            <span className="text-sm text-white/60">GTM AIntelligence</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col px-3 space-y-1 mt-4">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative block px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2
                 ${
                   isActive
                     ? "bg-white/20 text-white before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-pink-400 before:rounded-r"
                     : "text-white/80 hover:bg-white/10"
                 }`
              }
            >
              {Icon && <Icon className="w-4 h-4" />}
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer - Sezione Impostazioni */}
      <div className="px-4">
        {/* Toggle Impostazioni */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-white/80 hover:bg-white/10 rounded-md transition-all"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Impostazioni</span>
          </div>
          {isSettingsOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {/* Contenuto Impostazioni */}
        {isSettingsOpen && (
          <div className="mt-2 space-y-2 animate-slideDown">
            {/* Azioni JSON */}
            <div className="space-y-2">
              <button
                onClick={handleReplaceJSON}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white text-sm rounded-lg px-3 py-2 hover:brightness-110 transition"
              >
                <Upload className="w-4 h-4" />
                Sostituisci JSON
              </button>

              <button
                onClick={handleDownload}
                className={`w-full flex items-center justify-center gap-2 text-sm rounded-lg px-3 py-2 transition ${
                  container
                    ? "bg-orange-500 text-white hover:brightness-110"
                    : "bg-gray-400 text-white/80 cursor-not-allowed"
                }`}
                disabled={!container}
              >
                <Download className="w-4 h-4" />
                Scarica JSON
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between text-xs text-white/70 bg-white/5 rounded-lg px-3 py-2">
              <span>Dark Mode</span>
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 bg-white/10 rounded hover:bg-white/20 transition"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-yellow-300" />
                ) : (
                  <Moon className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}