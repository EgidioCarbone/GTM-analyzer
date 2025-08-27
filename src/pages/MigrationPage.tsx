import React, { useEffect, useState } from "react";
import { useContainer } from "../context/ContainerContext";
import { buildMigrationSuggestions } from "../utils/uaHelpers";
import { Bar } from "react-chartjs-2";
import { Download } from "lucide-react";
import { motion } from "framer-motion";
import "../utils/chartSetup"; // Import per registrare Chart.js correttamente

const MigrationPage: React.FC = () => {
  const { container } = useContainer();
  const [uaTagsCount, setUaTagsCount] = useState(0);
  const [ga4TagsCount, setGa4TagsCount] = useState(0);

  if (!container)
    return <p className="p-4">Carica prima un file JSON di GTM.</p>;

  const suggestions = buildMigrationSuggestions(container);

  useEffect(() => {
    const uaTags = (container.tag ?? []).filter((t: any) => t.type === "ua");
    const ga4Tags = (container.tag ?? []).filter(
      (t: any) => t.type === "ga4" || t.type === "googtag"
    );
    setUaTagsCount(uaTags.length);
    setGa4TagsCount(ga4Tags.length);
  }, [container]);

  const data = {
    labels: ["Tag UA", "Tag GA4", "Eventi da Migrare"],
    datasets: [
      {
        label: "Conteggio",
        data: [uaTagsCount, ga4TagsCount, suggestions.length],
        backgroundColor: ["#ef4444", "#22c55e", "#facc15"],
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  const handleDownloadReport = () => {
    const csvContent = [
      "UA Tag, Track Type, Suggerimento GA4, Tipo GA4",
      ...suggestions.map(
        (s) =>
          `${s.uaTagName}, ${s.trackType.replace("TRACK_", "")}, ${s.suggestedGa4Name}, ${s.ga4Type}`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "migration-report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-2xl font-bold text-gray-900 dark:text-white"
      >
        🛠️ Migrazione UA → GA4
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg mx-auto bg-white dark:bg-gray-800 p-4 rounded shadow border border-gray-200 dark:border-gray-700"
      >
        <Bar
          key={`chart-${uaTagsCount}-${ga4TagsCount}-${suggestions.length}`}
          data={data}
          options={options}
        />
      </motion.div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow overflow-x-auto border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          Dettaglio suggerimenti migrazione
        </h2>
        <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-left p-2 text-gray-700 dark:text-gray-300">UA Tag</th>
              <th className="text-left p-2 text-gray-700 dark:text-gray-300">Track Type</th>
              <th className="text-left p-2 text-gray-700 dark:text-gray-300">Suggerimento GA4</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800">
            {suggestions.map((s) => (
              <tr key={s.uaTagId} className="border-t border-gray-200 dark:border-gray-700">
                <td className="p-2 text-gray-900 dark:text-gray-100">{s.uaTagName}</td>
                <td className="p-2 text-gray-900 dark:text-gray-100">{s.trackType.replace("TRACK_", "")}</td>
                <td className="p-2 text-gray-900 dark:text-gray-100">
                  <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1 rounded">{s.suggestedGa4Name}</code>{" "}
                  <span className="text-xs ml-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded px-1">
                    {s.ga4Type}
                  </span>
                </td>
              </tr>
            ))}
            {suggestions.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 italic text-center text-gray-500 dark:text-gray-400">
                  Nessun tag UA trovato – il container è già GA4 only 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {suggestions.length > 0 && (
        <button
          onClick={handleDownloadReport}
          className="flex items-center gap-2 bg-orange-500 dark:bg-orange-600 text-white px-4 py-2 rounded hover:brightness-110 transition"
        >
          <Download className="w-4 h-4" />
          Scarica Report CSV
        </button>
      )}
    </div>
  );
};

export default MigrationPage;