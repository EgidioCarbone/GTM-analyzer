import { useContainer } from "../context/ContainerContext";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { calculateContainerQuality, QualityMetrics } from "../services/containerQualityService";
import { useEffect, useState } from "react";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const { container } = useContainer();
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);

  const tags = container?.tag ?? [];
  const triggers = container?.trigger ?? [];
  const variables = container?.variable ?? [];

  // Calcola la qualità del container quando cambia
  useEffect(() => {
    if (container) {
      const quality = calculateContainerQuality(container);
      setQualityMetrics(quality);
    }
  }, [container]);

  const tagTypeCounts = tags.reduce((acc: Record<string, number>, tag) => {
    const type = tag.type || "altro";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const sortedTypes = Object.entries(tagTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const barData = {
    labels: sortedTypes.map(([type]) => type),
    datasets: [
      {
        label: "# di tag",
        data: sortedTypes.map(([, count]) => count),
        backgroundColor: "#6366f1",
        borderRadius: 4,
      },
    ],
  };

  const donutData = {
    labels: Object.keys(tagTypeCounts),
    datasets: [
      {
        data: Object.values(tagTypeCounts),
        backgroundColor: [
          "#6366f1",
          "#10b981",
          "#f59e0b",
          "#ef4444",
          "#3b82f6",
          "#ec4899",
          "#8b5cf6",
          "#14b8a6",
        ],
        borderWidth: 2,
        cutout: "50%",
      },
    ],
  };

  const variableNames = variables.map((v) => v.name).filter(Boolean);
  const allItems = [...tags, ...triggers, ...variables];

  function isVariableUsed(name: string): boolean {
    // Escape dei caratteri speciali delle regex per evitare errori
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`{{\\s*${escapedName}\\s*}}`, "g");
    return allItems.some((item) => JSON.stringify(item).match(pattern));
  }

  const unusedVariableCount = variableNames.filter((name) => !isVariableUsed(name)).length;

  // Funzione per determinare lo stato della qualità
  const getQualityStatus = (score: number) => {
    if (score >= 90) return { status: "Eccellente", color: "bg-green-100 text-green-800", icon: "🏆" };
    if (score >= 75) return { status: "Ottimo", color: "bg-blue-100 text-blue-800", icon: "⭐" };
    if (score >= 60) return { status: "Buono", color: "bg-yellow-100 text-yellow-800", icon: "👍" };
    if (score >= 40) return { status: "Accettabile", color: "bg-orange-100 text-orange-800", icon: "⚠️" };
    return { status: "Da migliorare", color: "bg-red-100 text-red-800", icon: "🚨" };
  };

  const qualityStatus = qualityMetrics ? getQualityStatus(qualityMetrics.overallScore) : getQualityStatus(0);

  return (
    <main className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 p-6 rounded-xl shadow-lg text-white">
        <h1 className="text-4xl font-extrabold flex items-center gap-3 drop-shadow">
          🧠 LikeSense GTM AIntelligence
        </h1>
        <p className="text-sm mt-1 italic opacity-90">
          Domina il tuo contenitore con stile e intelligenza ✨
        </p>
      </div>

      {/* Score di qualità principale */}
      {qualityMetrics && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              🎯 Qualità del Container
            </h2>
            <div className="text-right">
              <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                {qualityMetrics.overallScore}%
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 font-medium rounded-full ${qualityStatus.color}`}>
                <span>{qualityStatus.icon}</span>
                {qualityStatus.status}
              </div>
            </div>
          </div>
          
          {/* Barra di progresso */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
            <div 
              className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 h-4 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${qualityMetrics.overallScore}%` }}
            />
          </div>

          {/* Metriche dettagliate */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {qualityMetrics.pausedItems}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">In Pausa</div>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {qualityMetrics.unusedItems}
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">Non Utilizzati</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {qualityMetrics.uaItems}
              </div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">UA Obsoleti</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {qualityMetrics.namingIssues}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Naming Issues</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tag", value: tags.length },
          { label: "Trigger", value: triggers.length },
          { label: "Variabili", value: variables.length },
        ].map((card, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 p-6 shadow-md rounded-xl text-center hover:shadow-lg transition"
          >
            <p className="text-2xl font-bold text-indigo-600">{card.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-300">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-md font-semibold text-gray-800 dark:text-white mb-4">
            🥧 Distribuzione tipi di tag
          </h2>
          <Doughnut data={donutData} />
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-md p-6 rounded-xl flex flex-col gap-4">
          <h2 className="text-md font-semibold text-gray-800 dark:text-white mb-2">
            🏆 Tag più utilizzati
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {barData?.labels?.slice(0, 5).map((label, index) => (
              <div
                key={label}
                className="flex items-center justify-between p-4 rounded-xl shadow bg-gradient-to-r from-indigo-500 to-purple-500 text-white transition-transform hover:scale-[1.02]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅"}
                  </span>
                  <span className="font-semibold text-sm">{label}</span>
                </div>
                <span className="text-sm font-bold">
                  {barData.datasets?.[0]?.data?.[index] ?? 0} tag
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            📊 Analisi Dettagliata
          </h2>

          <div className="grid grid-cols-1 gap-4 text-sm">
            {qualityMetrics && [
              {
                label: "Qualità Tag",
                icon: "🏷️",
                value: `${qualityMetrics.qualityBreakdown.tags.score}%`,
                color: "bg-blue-50 text-blue-700 dark:bg-blue-900/20",
              },
              {
                label: "Qualità Trigger",
                icon: "⚡",
                value: `${qualityMetrics.qualityBreakdown.triggers.score}%`,
                color: "bg-green-50 text-green-700 dark:bg-green-900/20",
              },
              {
                label: "Qualità Variabili",
                icon: "🧩",
                value: `${qualityMetrics.qualityBreakdown.variables.score}%`,
                color: "bg-purple-50 text-purple-700 dark:bg-purple-900/20",
              },
            ].map((item, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 rounded-lg p-4 ${item.color}`}
              >
                <div className="text-2xl">{item.icon}</div>
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="font-bold text-lg">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Clicca su "Container Manager" per ottimizzare il tuo container
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;