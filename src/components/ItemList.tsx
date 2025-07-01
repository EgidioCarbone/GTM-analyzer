import React, { useState } from "react";
import { Info, Sparkles, X } from "lucide-react";

export default function ItemList({
  items,
  type,
}: {
  items: any[];
  type: "trigger" | "variable";
}) {
  const [selected, setSelected] = useState<any | null>(null);

  return (
    <>
      <div className="space-y-4">
        {items.map((it, index) => {
          const id = it.triggerId || it.variableId || index;
          return (
            <div
              key={id}
              className="bg-white rounded-xl shadow p-4 flex justify-between items-center"
            >
              <div>
                <h3 className="font-semibold">{it.name ?? "(senza nome)"}</h3>
                <p className="text-xs text-gray-500">ID: {id}</p>
              </div>
              <button
                onClick={() => setSelected(it)}
                className="px-3 py-1.5 rounded bg-[#1a365d] text-white text-sm flex items-center gap-1"
              >
                <Info className="w-4 h-4" /> Dettagli
              </button>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white max-w-3xl w-full p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Dettagli</h2>
              <button onClick={() => setSelected(null)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <pre className="text-xs whitespace-pre-wrap bg-gray-100 p-4 rounded">
              {JSON.stringify(selected, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}