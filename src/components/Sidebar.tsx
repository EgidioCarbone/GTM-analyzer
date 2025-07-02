import React from "react";
import { NavLink } from "react-router-dom";
import useDarkMode from "../hooks/useDarkMode";
import { Moon, Sun } from "lucide-react";
import { useContainer } from "../context/ContainerContext";

export default function Sidebar() {
  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/tags", label: "Tag" },
    { to: "/triggers", label: "Trigger" },
    { to: "/variables", label: "Variabili" },
    { to: "/plan", label: "Piano" },
    { to: "/testing", label: "Testing" },
  ];

  const [isDark, setIsDark] = useDarkMode();
  const { container } = useContainer();

  return (
    <aside
      className="w-64 bg-[#1a365d] dark:bg-gray-900 text-white
                 flex flex-col justify-between h-screen fixed md:static"
    >
      <div className="flex-1 flex flex-col overflow-y-auto">
        <h1 className="text-center font-bold text-xl py-6">
          GTM Analyzer
        </h1>

        {container ? (
          <nav className="flex-1 overflow-y-auto space-y-1 px-2">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `block px-4 py-2 rounded transition
                   ${isActive ? "bg-white/20 font-semibold"
                               : "hover:bg-white/10"}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        ) : (
          <p className="text-center text-sm text-gray-300 px-4 mt-10">
          </p>
        )}
      </div>

      <div className="px-4 py-4 flex items-center justify-between">
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