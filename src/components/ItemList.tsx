import React, { useState } from "react";
import { Info, Sparkles } from "lucide-react";
import DetailsModal from "./DetailsModal";

export default function ItemList({
  items,
  type,
}: {
  items: any[];
  type: "tag" | "trigger" | "variable";
}) {
  const [selected, setSelected] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const explain = (item: any) => {
    if (type === "tag") {
      return `🔖 Tag tipo "${item.type}" con trigger ${item.triggerId?.join(", ") ?? "–"}`;
    }
    if (type === "trigger") {
      return `⚡ Trigger attivo quando ${item.filter
        ?.map((f: any) => `${f.type} ${f.value}`)
        .join(" e ") || "-"}`;
    }
    return `📦 Variabile di tipo "${item.type}"`;
  };

  const filteredItems = items.filter((item) => {
    const name = item.name ?? "";
    const id = item.tagId || item.triggerId || item.variableId || "";
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      id.toString().includes(searchTerm)
    );
  });

  return (
    <>
      <div className="mb-4">
        <input
          type="text"
          placeholder={`🔍 Cerca ${type}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-[#FF6B35]"
        />
      </div>

      {filteredItems.length === 0 && (
        <p className="text-gray-500 text-sm">Nessun risultato trovato.</p>
      )}

      <div className="space-y-4">
        {filteredItems.map((item, index) => {
          const id = item.tagId || item.triggerId || item.variableId || index;
          return (
            <div
              key={id}
              className="bg-white rounded-xl shadow p-4 flex justify-between items-center hover:shadow-md transition"
            >
              <div>
                <h3 className="font-semibold">
                  {item.name ?? "(senza nome)"}
                </h3>
                <p className="text-xs text-gray-500">ID: {id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(item)}
                  className="px-3 py-1.5 rounded bg-[#1a365d] text-white text-sm flex items-center gap-1"
                >
                  <Info className="w-4 h-4" /> Dettagli
                </button>
                <button
                  onClick={() => alert(explain(item))}
                  className="px-3 py-1.5 rounded bg-[#FF6B35] text-white text-sm flex items-center gap-1"
                >
                  <Sparkles className="w-4 h-4" /> AI
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <DetailsModal item={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}