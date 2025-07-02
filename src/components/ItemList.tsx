// src/components/ItemList.tsx

import React, { useState } from "react";
import { typeIcons } from "../utils/iconMap";
import DetailsModal from "./DetailsModal";

export default function ItemList({
  items,
  type,
}: {
  items: any[];
  type: "tag" | "trigger" | "variable";
}) {
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showUA, setShowUA] = useState(false);
  const [showPaused, setShowPaused] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const typesFound = Array.from(new Set(items.map((i) => i.type).filter(Boolean)));

  const toggleType = (t: string) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((p) => p !== t) : [...prev, t]
    );
  };

  const filtered = items.filter((i) => {
    const matchesSearch =
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.type?.toLowerCase().includes(search.toLowerCase()) ||
      String(i[type + "Id"])?.includes(search);
    const matchesType =
      selectedTypes.length === 0 || selectedTypes.includes(i.type);
    const matchesUA = !showUA || i.type === "ua";
    const matchesPaused = !showPaused || i.paused === true;
    return matchesSearch && matchesType && matchesUA && matchesPaused;
  });

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar filtri */}
      <div className="md:w-64 shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Filtra per tipo
        </h2>
        <div className="space-y-1 mb-4">
          {typesFound.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={selectedTypes.includes(t)}
                onChange={() => toggleType(t)}
              />
              {typeIcons[t] ?? <span>🏷️</span>}
              <span>{t}</span>
            </label>
          ))}
        </div>

        {type === "tag" && (
          <>
            <h2 className="text-sm font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">
              Potenzialmente eliminabili
            </h2>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={showUA}
                  onChange={() => setShowUA(!showUA)}
                />
                <span>🛑 UA (obsoleti)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={showPaused}
                  onChange={() => setShowPaused(!showPaused)}
                />
                <span>⏸️ In pausa</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 space-y-4">
        <input
          type="text"
          placeholder="🔍 Cerca per nome, tipo o ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-4 py-2 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        />

        {filtered.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Nessun elemento trovato.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((i) => (
              <div
                key={i[type + "Id"]}
                className="bg-white dark:bg-gray-800 rounded shadow p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <div className="flex items-center gap-2">
                  {typeIcons[i.type] ?? <span>🏷️</span>}
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      {i.name || "(senza nome)"}
                      {type === "tag" && i.type === "ua" && (
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full">
                          UA
                        </span>
                      )}
                      {type === "tag" && i.paused && (
                        <span className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs px-2 py-0.5 rounded-full">
                          Pausa
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-300">
                      ID: {i[type + "Id"]} | Tipo: {i.type}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDetail(i)}
                    className="px-3 py-1 text-sm bg-[#1a365d] text-white rounded hover:brightness-110"
                  >
                    Dettagli
                  </button>
                  <button
                    onClick={() => alert(`Analisi AI per ${i.name}`)}
                    className="px-3 py-1 text-sm bg-[#FF6B35] text-white rounded hover:brightness-110"
                  >
                    AI
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <DetailsModal item={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}