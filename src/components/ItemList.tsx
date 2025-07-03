import React, { useMemo, useState } from "react";
import { typeIcons } from "../utils/iconMap";
import DetailsModal from "./DetailsModal";
import ConfirmModal from "./ConfirmModal";
import { getUsedVariableNames } from "../utils/getUsedVariableNames";
import { useContainer } from "../context/ContainerContext";

export default function ItemList({
  items,
  type,
}: {
  items: any[];
  type: "tag" | "trigger" | "variable";
}) {
  /* stato globale */
  const { container, setContainer } = useContainer();

  /* stato locale UI */
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showUA, setShowUA] = useState(false);
  const [showPaused, setShowPaused] = useState(false);
  const [showUnused, setShowUnused] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  /* tipi disponibili */
  const typesFound = Array.from(
    new Set(items.map((i) => i.type).filter(Boolean))
  ).sort();

  /* variabili usate (solo per /variables) */
  const usedVarNames = useMemo(() => {
    if (!container || type !== "variable") return new Set<string>();
    return getUsedVariableNames(container);
  }, [container, type]);

  /* filtro completo */
  const filtered = items.filter((i) => {
    const searchMatch =
      (i.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (i.type ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(i[type + "Id"] ?? "").includes(search);

    const typeMatch =
      selectedTypes.length === 0 || selectedTypes.includes(i.type);

    const uaMatch = !showUA || i.type === "ua";
    const pausedMatch = !showPaused || i.paused === true;

    const isUnused = type === "variable" && !usedVarNames.has(i.name ?? "");
    const unusedMatch = !showUnused || isUnused;

    return searchMatch && typeMatch && uaMatch && pausedMatch && unusedMatch;
  });

  /* elimina elemento (invocata dalla modale) */
  const confirmDelete = () => {
    if (!container || !itemToDelete) return;

    const updated = {
      ...container,
      [type]: (container as any)[type].filter(
        (el: any) => el[type + "Id"] !== itemToDelete[type + "Id"]
      ),
    };

    setContainer(updated);
    setItemToDelete(null);
  };

  /* ─────────────────────────────── UI ─────────────────────────────── */

  return (
    <>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar filtri */}
        <div className="md:w-64 shrink-0 bg-white rounded shadow p-4 space-y-6">
          {/* TIPI */}
          {typesFound.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Tipi</h3>

              {typesFound.map((t) => (
                <label
                  key={t}
                  className="flex items-center gap-2 text-sm capitalize"
                >
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(t)}
                    onChange={() =>
                      setSelectedTypes((prev) =>
                        prev.includes(t)
                          ? prev.filter((p) => p !== t)
                          : [...prev, t]
                      )
                    }
                  />
                  {/* icona se disponibile */}
                  {typeIcons[t] && (
                    <span className="w-4 h-4 flex items-center justify-center">
                      {typeIcons[t]}
                    </span>
                  )}
                  <span>{t}</span>
                </label>
              ))}
            </div>
          )}

          {/* POTENZIALMENTE ELIMINABILI (solo Tag) */}
          {type === "tag" && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Potenzialmente eliminabili
              </h3>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showUA}
                  onChange={() => setShowUA(!showUA)}
                />
                <span>UA (obsoleti)</span>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showPaused}
                  onChange={() => setShowPaused(!showPaused)}
                />
                <span>In pausa</span>
              </label>
            </div>
          )}

          {/* VARIABILI NON USATE */}
          {type === "variable" && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Extra filtri
              </h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showUnused}
                  onChange={() => setShowUnused(!showUnused)}
                />
                <span>Variabili non usate</span>
              </label>
            </div>
          )}
        </div>

        {/* LISTA PRINCIPALE */}
        <div className="flex-1 space-y-4">
          <input
            type="text"
            placeholder="🔍 Cerca per nome, tipo o ID…"
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
                  {/* info + badge */}
                  <div className="flex items-center gap-2">
                    {typeIcons[i.type] ?? (
                      <span className="w-4 h-4 bg-gray-300 rounded-sm" />
                    )}
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {i.name || "(senza nome)"}
                        {type === "tag" && i.type === "ua" && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                            UA
                          </span>
                        )}
                        {type === "tag" && i.paused && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                            Pausa
                          </span>
                        )}
                        {type === "variable" &&
                          !usedVarNames.has(i.name ?? "") && (
                            <span className="bg-gray-300 text-gray-800 text-xs px-2 py-0.5 rounded-full">
                              Non usata
                            </span>
                          )}
                      </h3>
                      <p className="text-xs text-gray-500">
                        ID: {i[type + "Id"]} | Tipo: {i.type}
                      </p>
                    </div>
                  </div>

                  {/* CTA */}
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

                    <button
                      onClick={() => setItemToDelete(i)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:brightness-110"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modale dettaglio */}
      {detail && <DetailsModal item={detail} onClose={() => setDetail(null)} />}

      {/* Modale conferma eliminazione */}
      {itemToDelete && (
        <ConfirmModal
          title="Elimina elemento"
          message={`Sei sicuro di voler eliminare "${
            itemToDelete.name ?? itemToDelete[type + "Id"]
          }"? Questa azione non è reversibile.`}
          confirmLabel="Elimina"
          onConfirm={confirmDelete}
          onCancel={() => setItemToDelete(null)}
        />
      )}
    </>
  );
}