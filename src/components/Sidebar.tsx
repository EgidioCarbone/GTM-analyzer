import React from "react";
import { NavLink } from "react-router-dom";
import useDarkMode from "../hooks/useDarkMode";
import { Moon, Sun, Download } from "lucide-react";
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
  const { container } = useContainer();

  /* download JSON */
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

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-[#1a365d] text-white py-6 space-y-4 shrink-0">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <h1 className="text-center font-bold text-xl py-6">GTM Analyzer</h1>

        {container ? (
          <>
            <nav className="flex-1 overflow-y-auto space-y-1 px-2">
              {links.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded transition ${
                      isActive
                        ? "bg-white/20 font-semibold"
                        : "hover:bg-white/10"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* CTA download */}
            <button
              onClick={handleDownload}
              className="mx-4 mt-4 mb-6 flex items-center justify-center gap-2 bg-[#FF6B35] text-sm rounded px-3 py-2 hover:brightness-110"
            >
              <Download className="w-4 h-4" />
              Scarica JSON
            </button>
          </>
        ) : (
          <p className="text-center text-sm text-gray-300 px-4 mt-10">
            Carica un JSON per abilitare le sezioni
          </p>
        )}
      </div>

      {/* dark-mode toggle */}
      <div className="absolute bottom-4 left-0 w-full px-4 flex items-center justify-between">
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
    </aside>
  );
}