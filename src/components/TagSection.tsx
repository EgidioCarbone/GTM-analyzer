// src/components/TagSection.tsx

import React, { useState } from "react";
import { Info, Sparkles, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import DetailsModal from "./DetailsModal";

export default function TagSection({
  tags,
  triggers,
  updateTags,
}: {
  tags: any[];
  triggers: any[];
  updateTags: (tags: any[]) => void;
}) {
  const [detail, setDetail] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>("Tag in pausa");
  const [searchTerm, setSearchTerm] = useState("");

  const paused = tags.filter((t) => t.paused);
  const ua = tags.filter((t) => t.type === "ua" && !t.paused);
  const rest = tags.filter((t) => !t.paused && t.type !== "ua");

  const groups = [
    { id: "paused", label: "Tag in pausa", emoji: "⏸️", data: paused },
    { id: "ua", label: "Tag UA (obsoleti)", emoji: "🗑️", data: ua },
    { id: "rest", label: "Altri tag", emoji: "🏷️", data: rest },
  ];

  const hasTriggers = (tag: any) =>
    (tag.triggerId ?? []).some((id: any) =>
      triggers.some((tr) => tr.triggerId === id)
    );

  const handleDelete = (tag: any) => {
    if (hasTriggers(tag)) {
      const list = (tag.triggerId ?? []).join(", ");
      setErrorMsg(`Impossibile eliminare: il tag è agganciato ai trigger ${list}.`);
      return;
    }
    if (confirm(`Vuoi davvero eliminare il tag “${tag.name}”?`)) {
      updateTags(tags.filter((t) => t !== tag));
    }
  };

  const explain = (item: any) =>
    `🔖 Tag tipo "${item.type}" con trigger ${item.triggerId?.join(", ") ?? "–"}`;

  return (
    <>
      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="🔍 Cerca tag..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-[#FF6B35] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        />
      </div>

      {groups.map(({ id, label, emoji, data }) => {
        const filteredData = data.filter((t) =>
          (t.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(t.tagId ?? "").includes(searchTerm)
        );

        if (filteredData.length === 0) return null;

        return (
          <div
            key={id}
            className="mb-4 border rounded-xl bg-white dark:bg-gray-800 shadow"
          >
            <button
              className="w-full px-4 py-3 flex justify-between items-center font-semibold text-[#1a365d] dark:text-gray-100"
              onClick={() => setOpen(open === label ? null : label)}
            >
              <span>{emoji} {label}</span>
              {open === label ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {open === label && (
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {filteredData.map((t: any, i: number) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {t.name || "(senza nome)"}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-300">
                        ID: {t.tagId}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDetail(t)}
                        className="px-3 py-1.5 rounded bg-[#1a365d] text-white text-sm flex items-center gap-1 hover:brightness-110"
                      >
                        <Info className="w-4 h-4" /> Dettagli
                      </button>
                      <button
                        onClick={() => alert(explain(t))}
                        className="px-3 py-1.5 rounded bg-[#FF6B35] text-white text-sm flex items-center gap-1 hover:brightness-110"
                      >
                        <Sparkles className="w-4 h-4" /> AI
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="px-3 py-1.5 rounded bg-red-600 text-white text-sm flex items-center gap-1 hover:brightness-110"
                      >
                        <Trash2 className="w-4 h-4" /> Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Modali */}
      {detail && (
        <DetailsModal item={detail} onClose={() => setDetail(null)} />
      )}
      {errorMsg && (
        <DetailsModal
          item={{ message: errorMsg }}
          onClose={() => setErrorMsg(null)}
          title="Avviso"
        />
      )}
    </>
  );
}