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
  /* ───────── State globale ───────── */
  const { container, setContainer } = useContainer();

  /* ───────── State locale UI ───────── */
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showUA, setShowUA] = useState(false);
  const [showPaused, setShowPaused] = useState(false);
  const [showUnused, setShowUnused] = useState(false);

  const [detail, setDetail] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  /* multi-selezione */
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
    new Set()
  );
  const [bulkModal, setBulkModal] = useState(false);

  /* ───────── Derivazioni ───────── */
  const idKey = type + "Id" as const;

  const typesFound = Array.from(
    new Set(items.map((i) => i.type).filter(Boolean))
  ).sort();

  /* variabili usate */
  const usedVarNames = useMemo(() => {
    if (!container || type !== "variable") return new Set<string>();
    return getUsedVariableNames(container);
  }, [container, type]);

  /* filtro completo */
  const filtered = items.filter((i) => {
    const searchMatch =
      (i.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (i.type ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(i[idKey] ?? "").includes(search);

    const typeMatch =
      selectedTypes.length === 0 || selectedTypes.includes(i.type);

    const uaMatch = !showUA || i.type === "ua";
    const pausedMatch = !showPaused || i.paused === true;

    const isUnused = type === "variable" && !usedVarNames.has(i.name ?? "");
    const unusedMatch = !showUnused || isUnused;

    return searchMatch && typeMatch && uaMatch && pausedMatch && unusedMatch;
  });

  /* ───────── Helper ───────── */
  const toggleRow = (id: string | number) =>
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const confirmSingleDelete = () => {
    if (!container || !itemToDelete) return;

    const updated = {
      ...container,
      [type]: (container as any)[type].filter(
        (el: any) => el[idKey] !== itemToDelete[idKey]
      ),
    };

    setContainer(updated);
    setItemToDelete(null);
  };

  const confirmBulkDelete = () => {
    if (!container || selectedRows.size === 0) return;

    const updated = {
      ...container,
      [type]: (container as any)[type].filter(
        (el: any) => !selectedRows.has(el[idKey])
      ),
    };

    setContainer(updated);
    setSelectedRows(new Set());
    setBulkModal(false);
  };

  /* ───────── UI ───────── */

  return (
    <>
      <div className="flex flex-col md:flex-row gap-6">
        {/* ───────── Sidebar filtri ───────── */}
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
                  {typeIcons[t] ?? typeIcons.default}
                  <span>{t}</span>
                </label>
              ))}
            </div>
          )}

          {/* TAG specifici */}
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

          {/* VARIABILI non usate */}
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

        {/* ───────── Area lista ───────── */}
        <div className="flex-1 space-y-4">
          <input
            type="text"
            placeholder="🔍 Cerca per nome, tipo o ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-4 py-2 w-full"
          />

          {/* barra eliminazione multipla */}
          {selectedRows.size > 0 && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 p-3 rounded">
              <span className="text-sm">
                {selectedRows.size} elemento
                {selectedRows.size > 1 && "i"} selezionato
                {selectedRows.size > 1 && "i"}
              </span>

              <button
                onClick={() => setBulkModal(true)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:brightness-110"
              >
                Elimina selezionati
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">Nessun elemento trovato.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((i) => {
                const isChecked = selectedRows.has(i[idKey]);
                return (
                  <div
                    key={i[idKey]}
                    className={`bg-white rounded shadow p-4 flex justify-between items-center hover:bg-gray-50 transition ${
                      isChecked ? "ring-1 ring-offset-2 ring-red-400" : ""
                    }`}
                  >
                    {/* checkbox + info */}
                    <div className="flex items-center gap-3">
                      {/* checkbox */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRow(i[idKey])}
                        className="w-4 h-4"
                      />

                      {/* icona + testo */}
                      {typeIcons[i.type] ?? typeIcons.default}

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
                          ID: {i[idKey]} | Tipo: {i.type}
                        </p>
                      </div>
                    </div>

                    {/* CTA singole */}
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* modale dettaglio */}
      {detail && <DetailsModal item={detail} onClose={() => setDetail(null)} />}

      {/* modale singola eliminazione */}
      {itemToDelete && (
        <ConfirmModal
          title="Elimina elemento"
          message={`Sei sicuro di voler eliminare "${
            itemToDelete.name ?? itemToDelete[idKey]
          }"? Questa azione non è reversibile.`}
          confirmLabel="Elimina"
          onConfirm={confirmSingleDelete}
          onCancel={() => setItemToDelete(null)}
        />
      )}

      {/* modale bulk eliminazione */}
      {bulkModal && (
        <ConfirmModal
          title="Elimina elementi"
          message={`Sei sicuro di voler eliminare ${selectedRows.size} elemento${
            selectedRows.size > 1 ? "i" : ""
          }? Questa azione non è reversibile.`}
          confirmLabel="Elimina tutti"
          onConfirm={confirmBulkDelete}
          onCancel={() => setBulkModal(false)}
        />
      )}
    </>
  );
}