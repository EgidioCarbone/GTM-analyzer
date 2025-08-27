import React from "react";
import { X } from "lucide-react";

export default function DetailsModal({ item, onClose, title = "Dettagli" }) {
  if (!item || typeof item !== "object") {
    return null; // Non mostrare nulla se i dati non sono disponibili
  }

  const renderValue = (value) => {
    if (!value) return <span className="italic text-gray-500 dark:text-gray-400">N/A</span>;

    if (Array.isArray(value)) {
      if (
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null &&
        !Array.isArray(value[0])
      ) {
        const keys = Object.keys(value[0]);
        return (
          <div className="overflow-x-auto max-w-full">
            <table className="min-w-full border border-gray-300 dark:border-gray-600 text-xs">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  {keys.map((k) => (
                    <th
                      key={k}
                      className="px-2 py-1 text-left font-semibold border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {value.map((obj, idx) => (
                  <tr key={idx}>
                    {keys.map((k) => (
                      <td key={k} className="px-2 py-1 border border-gray-300 dark:border-gray-600 align-top">
                        {obj[k] !== undefined && obj[k] !== null ? (
                          typeof obj[k] === "object" ? (
                                                      <pre className="max-w-[200px] whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300">
                            {JSON.stringify(obj[k], null, 2)}
                          </pre>
                                                      ) : (
                              <span className="text-gray-700 dark:text-gray-300">{String(obj[k])}</span>
                            )
                        ) : (
                          <span className="italic text-gray-500 dark:text-gray-400">N/A</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      } else {
        return (
          <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs overflow-x-auto max-w-full text-gray-700 dark:text-gray-300">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      }
    } else if (typeof value === "object") {
      return (
        <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs overflow-x-auto max-w-full text-gray-700 dark:text-gray-300">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    } else {
      return <span className="text-gray-700 dark:text-gray-300">{String(value)}</span>;
    }
  };

  return (
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-600 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
                      <table className="min-w-full text-sm text-gray-700 dark:text-gray-300">
            <tbody className="text-gray-700 dark:text-gray-300">
              {Object.entries(item).map(([key, value], idx) => (
                <tr key={idx} className="border-t border-gray-200 dark:border-gray-600 align-top">
                  <td className="py-2 px-4 font-medium text-gray-900 dark:text-white">{key}</td>
                  <td className="py-2 px-4 text-gray-700 dark:text-gray-300">{renderValue(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}