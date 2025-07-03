import React from "react";
import { useContainer } from "../context/ContainerContext";
import { buildMigrationSuggestions } from "../utils/uaHelpers";

const MigrationPage: React.FC = () => {
  const { container } = useContainer();

  if (!container)
    return <p className="p-4">Carica prima un file JSON di GTM.</p>;

  const suggestions = buildMigrationSuggestions(container);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Migrazione UA → GA4</h1>

      <table className="min-w-full text-sm border rounded-lg">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2">UA Tag</th>
            <th className="text-left p-2">Track Type</th>
            <th className="text-left p-2">Suggerimento GA4</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.map((s) => (
            <tr key={s.uaTagId} className="border-t">
              <td className="p-2">{s.uaTagName}</td>
              <td className="p-2">{s.trackType.replace("TRACK_", "")}</td>
              <td className="p-2">
                <code>{s.suggestedGa4Name}</code>{" "}
                <span className="text-xs ml-2 bg-indigo-50 rounded px-1">
                  {s.ga4Type}
                </span>
              </td>
            </tr>
          ))}
          {suggestions.length === 0 && (
            <tr>
              <td colSpan={3} className="p-4 italic text-center">
                Nessun tag UA trovato – il container è già GA4 only 🎉
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MigrationPage;