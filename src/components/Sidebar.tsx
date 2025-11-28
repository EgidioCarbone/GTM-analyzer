import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Upload,
  Download,
  Moon,
  Sun,
  Brain,
  Settings,
  LayoutDashboard,
  Target,
  ChevronDown,
  ChevronUp,
  TestTube,
  CheckCircle,
} from "lucide-react";
import useDarkMode from "../hooks/useDarkMode";
import { useContainer } from "../context/ContainerContext";
import { useLanguage } from "../context/LanguageContext";

type LinkDef = { to: string; label: string; icon: React.ComponentType<any> };

export default function Sidebar() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);
  const { t } = useLanguage();

  const mode = new URLSearchParams(location.search).get("mode");

  const links: LinkDef[] =
    mode === "analytics"
      ? [
          { to: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
          { to: "/container-manager", label: "nav.containerManager", icon: Settings },
        ]
      : mode === "plan"
      ? [{ to: "/plan", label: "nav.aiPlan", icon: Target }]
      : mode === "ssd"
      ? [{ to: "/ssd-test", label: "nav.sddTest", icon: TestTube }]
      : mode === "ai-sentinel"
      ? [{ to: "/ai-sentinel", label: "nav.aiSentinel", icon: CheckCircle }]
      : [
          { to: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
          { to: "/container-manager", label: "nav.containerManager", icon: Settings },
          { to: "/plan", label: "nav.aiPlan", icon: Target },
          { to: "/ssd-test", label: "nav.sddTest", icon: TestTube },
          { to: "/ai-sentinel", label: "nav.aiSentinel", icon: CheckCircle },
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (isOpen) {
      firstLinkRef.current?.focus();
    } else {
      toggleButtonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={toggleButtonRef}
        onClick={() => setIsOpen((v) => !v)}
        className="fixed top-4 left-4 z-[10000] w-10 h-10 rounded-full bg-white border border-gray-300 flex flex-col items-center justify-center gap-1 shadow-lg"
        aria-label={t("nav.menu")}
        aria-expanded={isOpen}
        aria-controls="likesense-sidebar"
      >
        <span className="block w-6 h-[2px] bg-gray-800" />
        <span className="block w-6 h-[2px] bg-gray-800" />
        <span className="block w-6 h-[2px] bg-gray-800" />
      </button>

      <div
        className={`fixed inset-0 z-[9999] bg-black/40 transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="likesense-sidebar"
        role="dialog"
        aria-modal="true"
        className={`fixed top-0 left-0 h-screen w-64 bg-[#1a365d] text-white flex flex-col justify-between py-6 shadow-md border-r border-black/10 transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0 pointer-events-auto z-[10000]" : "-translate-x-full pointer-events-none z-[10000]"
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-2 text-2xl font-bold px-4">
            <Brain className="w-6 h-6 text-pink-400" />
            <span>
              LikeSense <br />
              <span className="text-sm text-white/60">GTM AIntelligence</span>
            </span>
          </div>

          <nav className="flex flex-col px-3 space-y-1 mt-4 overflow-y-auto">
            {links.map(({ to, label, icon: Icon }, idx) => {
              const currentSearch = location.search;
              const linkTo = currentSearch ? `${to}${currentSearch}` : to;
              return (
                <NavLink
                  key={to}
                  to={linkTo}
                  ref={idx === 0 ? firstLinkRef : undefined}
                  className={({ isActive }) =>
                    `relative block px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2
                     ${
                       isActive
                         ? "bg-white/20 text-white before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-pink-400 before:rounded-r"
                         : "text-white/80 hover:bg-white/10"
                     }`
                  }
                  onClick={() => setIsOpen(false)}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {t(label)}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="px-4">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-white/80 hover:bg-white/10 rounded-md transition-all"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">{t("nav.settings")}</span>
            </div>
            {isSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {isSettingsOpen && (
            <div className="mt-2 space-y-2 animate-slideDown">
              <div className="space-y-2">
                <button
                  onClick={handleReplaceJSON}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white text-sm rounded-lg px-3 py-2 hover:brightness-110 transition"
                >
                  <Upload className="w-4 h-4" />
                  {t("nav.replaceJson")}
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
                  {t("nav.downloadJson")}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-white/70 bg-white/5 rounded-lg px-3 py-2">
                <span>{t("nav.darkMode")}</span>
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="p-2 bg-white/10 rounded hover:bg-white/20 transition"
                >
                  {isDark ? <Sun className="w-4 h-4 text-yellow-300" /> : <Moon className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
