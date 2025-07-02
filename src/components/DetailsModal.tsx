import React from "react";
import { X } from "lucide-react";

export default function DetailsModal({ item, onClose, title = "Dettagli" }) {
  if (!item || typeof item !== "object") {
    return null; // Non mostrare nulla se i dati non sono disponibili
  }

  const renderValue = (value) => {
    if (!value) return <span className="italic text-gray-500">N/A</span>;

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
            <table className="min-w-full border text-xs">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  {keys.map((k) => (
                    <th
                      key={k}
                      className="px-2 py-1 text-left font-semibold border"
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.map((obj, idx) => (
                  <tr key={idx}>
                    {keys.map((k) => (
                      <td key={k} className="px-2 py-1 border align-top">
                        {obj[k] !== undefined && obj[k] !== null ? (
                          typeof obj[k] === "object" ? (
                            <pre className="max-w-[200px] whitespace-pre-wrap break-all">
                              {JSON.stringify(obj[k], null, 2)}
                            </pre>
                          ) : (
                            String(obj[k])
                          )
                        ) : (
                          <span className="italic text-gray-500">N/A</span>
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
          <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs overflow-x-auto max-w-full">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      }
    } else if (typeof value === "object") {
      return (
        <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs overflow-x-auto max-w-full">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    } else {
      return <span>{String(value)}</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <table className="min-w-full text-sm">
            <tbody>
              {Object.entries(item).map(([key, value], idx) => (
                <tr key={idx} className="border-t align-top">
                  <td className="py-2 px-4 font-medium">{key}</td>
                  <td className="py-2 px-4">{renderValue(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end p-4 border-t">
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