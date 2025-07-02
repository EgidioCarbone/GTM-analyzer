// src/components/DetailsModal.tsx

import React from "react";
import { X } from "lucide-react";

export default function DetailsModal({ item, onClose }) {
  if (!item) return null;

  const renderValue = (value) => {
    if (typeof value === "object" && value !== null) {
      return (
        <pre className="bg-gray-50 rounded p-2 overflow-x-auto text-xs max-w-full">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return <span>{String(value)}</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Dettagli</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500 hover:text-black" />
          </button>
        </div>
        <table className="w-full text-sm border rounded overflow-hidden">
          <tbody>
            {Object.entries(item).map(([key, value]) => (
              <tr key={key} className="border-t">
                <td className="font-medium p-2 align-top bg-gray-50 w-1/3 break-words">
                  {key}
                </td>
                <td className="p-2 break-words max-w-[300px]">
                  {renderValue(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-right mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1a365d] text-white rounded hover:brightness-110 text-sm"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}