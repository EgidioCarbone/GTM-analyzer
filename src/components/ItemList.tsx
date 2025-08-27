import React, { useMemo, useState } from "react";
import { typeIcons } from "../utils/iconMap";
import { typeLabels } from "../utils/typeLabels";
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
  const { container, setContainer } = useContainer();

  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showUA, setShowUA] = useState(false);
  const [showPaused, setShowPaused] = useState(false);
  const [showUnused, setShowUnused] = useState(false);

  const [detail, setDetail] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [bulkModal, setBulkModal] = useState(false);

  const idKey = type + "Id" as const;

  const typesFound = Array.from(new Set(items.map((i) => i.type).filter(Boolean))).sort();

  const usedVarNames = useMemo(() => {
    if (!container || type !== "variable") return new Set<string>();
    return getUsedVariableNames(container);
  }, [container, type]);

  const filtered = items.filter((i) => {
    const searchMatch =
      (i.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (i.type ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(i[idKey] ?? "").includes(search);

    const typeMatch = selectedTypes.length === 0 || selectedTypes.includes(i.type);
    const uaMatch = !showUA || i.type === "ua";
    const pausedMatch = !showPaused || i.paused === true;
    const isUnused = type === "variable" && !usedVarNames.has(i.name ?? "");
    const unusedMatch = !showUnused || isUnused;

    return searchMatch && typeMatch && uaMatch && pausedMatch && unusedMatch;
  });

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
      [type]: (container as any)[type].filter((el: any) => el[idKey] !== itemToDelete[idKey]),
    };
    setContainer(updated);
    setItemToDelete(null);
  };

  const confirmBulkDelete = () => {
    if (!container || selectedRows.size === 0) return;
    const updated = {
      ...container,
      [type]: (container as any)[type].filter((el: any) => !selectedRows.has(el[idKey])),
    };
    setContainer(updated);
    setSelectedRows(new Set());
    setBulkModal(false);
  };

  const handleSelectAllToggle = () => {
    if (selectedRows.size === filtered.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filtered.map((i) => i[idKey])));
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="md:w-64 shrink-0 bg-white dark:bg-gray-800 rounded shadow p-4 space-y-6 border border-gray-200 dark:border-gray-700">
          {typesFound.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tipi</h3>
              {typesFound.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(t)}
                    onChange={() =>
                      setSelectedTypes((prev) =>
                        prev.includes(t) ? prev.filter((p) => p !== t) : [...prev, t]
                      )
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2"
                  />
                  {typeIcons[t] ?? typeIcons.default}
                  <span>{typeLabels[t] ?? t}</span>
                </label>
              ))}
            </div>
          )}

          {type === "tag" && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Potenzialmente eliminabili</h3>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input 
                  type="checkbox" 
                  checked={showUA} 
                  onChange={() => setShowUA(!showUA)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2"
                />
                <span>UA (obsoleti)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={showPaused}
                  onChange={() => setShowPaused(!showPaused)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2"
                />
                <span>In pausa</span>
              </label>
            </div>
          )}

          {type === "variable" && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Extra filtri</h3>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={showUnused}
                  onChange={() => setShowUnused(!showUnused)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2"
                />
                <span>Variabili non usate</span>
              </label>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="flex-1 space-y-4">
          <input
            type="text"
            placeholder="🔍 Cerca per nome, tipo o ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-4 py-2 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />

          {filtered.length > 0 && (
            <button
              onClick={handleSelectAllToggle}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
            >
              {selectedRows.size === filtered.length ? "Deseleziona tutto" : "Seleziona tutto"}
            </button>
          )}

          {selectedRows.size > 0 && (
            <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded">
              <span className="text-sm text-red-800 dark:text-red-200">
                {selectedRows.size} elemento{selectedRows.size > 1 && "i"} selezionato
                {selectedRows.size > 1 && "i"}
              </span>
              <button
                onClick={() => setBulkModal(true)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:brightness-110 transition"
              >
                Elimina selezionati
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Nessun elemento trovato.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((i) => {
                const isChecked = selectedRows.has(i[idKey]);
                return (
                  <div
                    key={i[idKey]}
                    className={`bg-white dark:bg-gray-800 rounded shadow p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition border border-gray-200 dark:border-gray-700 ${
                      isChecked ? "ring-2 ring-offset-2 ring-red-400 dark:ring-offset-gray-800" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRow(i[idKey])}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      {typeIcons[i.type] ?? typeIcons.default}
                      <div>
                        <h3 className="font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          {i.name || "(senza nome)"}
                          {type === "tag" && i.type === "ua" && (
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full">
                              UA
                            </span>
                          )}
                          {type === "tag" && i.paused && (
                            <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs px-2 py-0.5 rounded-full">
                              Pausa
                            </span>
                          )}
                          {type === "variable" &&
                            !usedVarNames.has(i.name ?? "") && (
                              <span className="bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs px-2 py-0.5 rounded-full">
                                Non usata
                              </span>
                            )}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {i[idKey]} | Tipo: {typeLabels[i.type] ?? i.type}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setDetail(i)}
                        className="px-3 py-1 text-sm bg-[#1a365d] dark:bg-blue-600 text-white rounded hover:brightness-110 transition"
                      >
                        Dettagli
                      </button>
                      <button
                        onClick={() => alert(`Analisi AI per ${i.name}`)}
                        className="px-3 py-1 text-sm bg-[#FF6B35] dark:bg-orange-600 text-white rounded hover:brightness-110 transition"
                      >
                        AI
                      </button>
                      <button
                        onClick={() => setItemToDelete(i)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:brightness-110 transition"
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

      {detail && <DetailsModal item={detail} onClose={() => setDetail(null)} />}
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