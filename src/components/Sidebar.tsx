import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Upload, Download, Moon, Sun } from "lucide-react";
import useDarkMode from "../hooks/useDarkMode";
import { useContainer } from "../context/ContainerContext";

export default function Sidebar() {
  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/tags", label: "Tag" },
    { to: "/triggers", label: "Trigger" },
    { to: "/variables", label: "Variabili" },
    { to: "/plan", label: "Piano" },
    { to: "/testing", label: "Testing" },
    { to: "/migration", label: "UA → GA4" },
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
    localStorage.removeItem("gtm-analyzer-container");
    setContainer(null);
    navigate("/");
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-[#1a365d] text-white flex flex-col justify-between py-6">
      {/* Links */}
      <div className="space-y-6">
        <h1 className="text-center font-bold text-xl">GTM Analyzer</h1>

        <nav className="flex flex-col space-y-1 px-3">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded transition ${
                  isActive ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* CTA sostituisci e scarica */}
      <div className="flex flex-col space-y-3 px-4">
        <button
          onClick={handleReplaceJSON}
          className="flex items-center justify-center gap-2 bg-orange-500 text-white text-sm rounded px-3 py-2 hover:brightness-110 transition"
        >
          <Upload className="w-4 h-4" />
          Sostituisci JSON
        </button>

        <button
          onClick={handleDownload}
          className={`flex items-center justify-center gap-2 ${
            container
              ? "bg-orange-500 hover:brightness-110 cursor-pointer"
              : "bg-gray-400 cursor-not-allowed"
          } text-white text-sm rounded px-3 py-2 transition`}
          disabled={!container}
        >
          <Download className="w-4 h-4" />
          Scarica JSON
        </button>

        {/* Dark Mode */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-white/70">Dark Mode</span>
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
    </aside>
  );
}