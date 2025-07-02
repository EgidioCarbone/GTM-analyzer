import React, { useState } from "react";
import { X } from "lucide-react";

export default function DetailsModal({
  item,
  onClose,
  title = "Dettagli",
}: {
  item: any;
  onClose: () => void;
  title?: string;
}) {
  const [expandedValue, setExpandedValue] = useState<any | null>(null);

  const renderValue = (value: any) => {
    if (
      Array.isArray(value) &&
      value.every((v) => typeof v === "object" && v !== null)
    ) {
      const keys = Array.from(new Set(value.flatMap((v) => Object.keys(v))));
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left mt-2 border dark:border-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                {keys.map((key) => (
                  <th key={key} className="py-1 px-2 font-medium capitalize border dark:border-gray-700">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.map((obj, idx) => (
                <tr key={idx} className="border-t dark:border-gray-700">
                  {keys.map((key) => (
                    <td key={key} className="py-1 px-2 border dark:border-gray-700 max-w-[150px] truncate">
                      {typeof obj[key] === "object" && obj[key] !== null ? (
                        <button
                          onClick={() => setExpandedValue(obj[key])}
                          className="text-blue-600 underline text-xs"
                        >
                          Mostra dettagli
                        </button>
                      ) : (
                        String(obj[key] ?? "")
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (typeof value === "object" && value !== null) {
      return (
        <button
          onClick={() => setExpandedValue(value)}
          className="text-blue-600 underline text-xs"
        >
          Mostra dettagli
        </button>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold dark:text-white">{title}</h2>
            <button onClick={onClose}>
              <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          {item.message ? (
            <p className="text-sm dark:text-gray-100">{item.message}</p>
          ) : (
            <table className="w-full text-sm text-left dark:text-gray-100">
              <tbody>
                {Object.entries(item).map(([key, value]) => (
                  <tr
                    key={key}
                    className="border-t border-gray-200 dark:border-gray-700 align-top"
                  >
                    <th className="py-2 pr-4 font-medium w-32 capitalize">
                      {key}
                    </th>
                    <td className="py-2">{renderValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {expandedValue && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto p-4 relative">
            <button
              onClick={() => setExpandedValue(null)}
              className="absolute top-2 right-2 text-gray-700 dark:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            <pre className="text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(expandedValue, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}