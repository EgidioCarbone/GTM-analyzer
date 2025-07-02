import React, { useState, useMemo } from "react";
import { typeIcons } from "../utils/iconMap";
import DetailsModal from "./DetailsModal";
import { getUsedVariableNames } from "../utils/getUsedVariableNames";
import { useContainer } from "../context/ContainerContext";

export default function ItemList({
  items,
  type,
}: {
  items: any[];
  type: "tag" | "trigger" | "variable";
}) {
  const { container } = useContainer();

  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showUA, setShowUA] = useState(false);
  const [showPaused, setShowPaused] = useState(false);
  const [showUnused, setShowUnused] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const typesFound = Array.from(new Set(items.map((i) => i.type).filter(Boolean)));

  const toggleType = (t: string) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((p) => p !== t) : [...prev, t]
    );
  };

  const usedVarNames = useMemo(() => {
    if (!container || type !== "variable") return new Set<string>();
    return getUsedVariableNames(container);
  }, [container, type]);

  const filtered = items.filter((i) => {
    const matchesSearch =
      (i.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (i.type ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(i[type + "Id"] ?? "").includes(search);

    const matchesType =
      selectedTypes.length === 0 || selectedTypes.includes(i.type);

    const matchesUA = !showUA || i.type === "ua";
    const matchesPaused = !showPaused || i.paused === true;

    const isUnused =
      type === "variable" && !usedVarNames.has(i.name ?? "");
    const matchesUnused = !showUnused || isUnused;

    return matchesSearch && matchesType && matchesUA && matchesPaused && matchesUnused;
  });

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar */}
      <div className="md:w-64 shrink-0 bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-semibold mb-2">Filtra per tipo</h2>
        <div className="space-y-1 mb-4">
          {typesFound.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
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
            <h2 className="text-sm font-semibold mt-4 mb-2">Potenzialmente eliminabili</h2>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUA}
                  onChange={() => setShowUA(!showUA)}
                />
                <span>🛑 UA (obsoleti)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
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

        {type === "variable" && (
          <>
            <h2 className="text-sm font-semibold mt-4 mb-2">Potenzialmente eliminabili</h2>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showUnused}
                onChange={() => setShowUnused(!showUnused)}
              />
              <span>🗑️ Variabili non usate</span>
            </label>
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
          className="border rounded px-4 py-2 w-full"
        />

        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">Nessun elemento trovato.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((i) => (
              <div
                key={i[type + "Id"]}
                className="bg-white rounded shadow p-4 flex justify-between items-center hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  {typeIcons[i.type] ?? <span>🏷️</span>}
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {i.name || "(senza nome)"}
                      {type === "tag" && i.type === "ua" && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">UA</span>
                      )}
                      {type === "tag" && i.paused && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">Pausa</span>
                      )}
                      {type === "variable" && !usedVarNames.has(i.name ?? "") && (
                        <span className="bg-gray-300 text-gray-800 text-xs px-2 py-0.5 rounded-full">Non usata</span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500">
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