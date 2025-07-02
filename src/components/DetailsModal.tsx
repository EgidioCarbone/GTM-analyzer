import React from "react";

export default function DetailsModal({
  item,
  onClose,
  title = "Dettagli",
  actions,
}: {
  item: any;
  onClose: () => void;
  title?: string;
  actions?: { label: string; onClick: () => void; style?: string }[];
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✖</button>
        </div>

        {typeof item === "string" || item.message ? (
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {item.message ?? item}
          </p>
        ) : (
          <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto max-h-[60vh]">
            {JSON.stringify(item, null, 2)}
          </pre>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {actions ? (
            actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={`px-4 py-2 rounded text-sm ${action.style ?? "bg-[#1a365d] text-white"}`}
              >
                {action.label}
              </button>
            ))
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-[#1a365d] text-white text-sm"
            >
              Chiudi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}