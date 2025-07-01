import React, { useState } from "react";
import { Info, Sparkles, Trash2, ChevronDown, ChevronUp, X } from "lucide-react";

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
      setErrorMsg(
        `Impossibile eliminare: il tag è agganciato ai trigger ${list}.`
      );
      return;
    }
    if (confirm(`Vuoi davvero eliminare il tag “${tag.name}”?`)) {
      updateTags(tags.filter((t) => t !== tag));
    }
  };

  const explain = (item: any) =>
    `🔖 Tag tipo "${item.type}" con trigger ${
      item.triggerId?.join(", ") ?? "–"
    }`;

  return (
    <>
      {groups.map(({ id, label, emoji, data }) =>
        data.length ? (
          <div key={id} className="mb-4 border rounded-xl bg-white shadow">
            <button
              className="w-full px-4 py-3 flex justify-between items-center font-semibold text-[#1a365d]"
              onClick={() => setOpen(open === label ? null : label)}
            >
              <span>
                {emoji} {label}
              </span>
              {open === label ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {open === label && (
              <div className="divide-y">
                {data.map((t: any, i: number) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-4"
                  >
                    <div>
                      <h3 className="font-semibold">
                        {t.name || "(senza nome)"}
                      </h3>
                      <p className="text-xs text-gray-500">ID: {t.tagId}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDetail(t)}
                        className="px-3 py-1.5 rounded bg-[#1a365d] text-white text-sm flex items-center gap-1"
                      >
                        <Info className="w-4 h-4" /> Dettagli
                      </button>
                      <button
                        onClick={() => alert(explain(t))}
                        className="px-3 py-1.5 rounded bg-[#FF6B35] text-white text-sm flex items-center gap-1"
                      >
                        <Sparkles className="w-4 h-4" /> AI
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="px-3 py-1.5 rounded bg-red-600 text-white text-sm flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null
      )}

      {/* modali identici al tuo originale (detail + error) */}
      {detail && (
        <Modal title="Dettagli" onClose={() => setDetail(null)}>
          {detail}
        </Modal>
      )}
      {errorMsg && (
        <Modal title="Avviso" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Modal>
      )}
    </>
  );
}

/* Modal di servizio, minimale */
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl p-6 rounded shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose}>✖️</button>
        </div>
        {typeof children === "string" ? (
          <p className="whitespace-pre-wrap text-sm">{children}</p>
        ) : (
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(children, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}