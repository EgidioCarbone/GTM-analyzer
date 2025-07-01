import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar({
  current,
  setCurrent,
  disabled,
}: {
  current: string;
  setCurrent: (p: string) => void;
  disabled: boolean;
}) {
  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/tags", label: "Tag" },
    { to: "/triggers", label: "Trigger" },
    { to: "/variables", label: "Variabili" },
    { to: "/plan", label: "Piano" },
    { to: "/testing", label: "Testing" },
  ];

  return (
    <aside className="w-64 bg-[#1a365d] text-white py-6 space-y-4 shrink-0">
      <h1 className="text-center font-bold text-xl">GTM Analyzer</h1>

      {disabled ? (
        <p className="text-center text-sm text-gray-300 px-4">
          Carica un file JSON per abilitare le sezioni
        </p>
      ) : (
        <nav className="space-y-1 px-2">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setCurrent(label.toLowerCase())}
              className={({ isActive }) =>
                `block px-4 py-2 rounded transition ${
                  isActive ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </aside>
  );
}