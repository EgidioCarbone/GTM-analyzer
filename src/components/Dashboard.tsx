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

  const tags = container?.tag ?? [];
  const triggers = container?.trigger ?? [];
  const variables = container?.variable ?? [];

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
    const pattern = new RegExp(`{{\\s*${name}\\s*}}`, "g");
    return allItems.some((item) => JSON.stringify(item).match(pattern));
  }

  const unusedVariableCount = variableNames.filter((name) => !isVariableUsed(name)).length;

  const qualitySummary = {
    pausedTags: tags.filter((t) => t.paused === true || t.paused === "true").length,
    unusedVariables: unusedVariableCount,
    uaTags: tags.filter((t) => t.type === "ua").length,
    status: "Da migliorare",
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
        📊 Dashboard del contenitore
      </h1>

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
      🧪 Qualità del container
    </h2>

    <div className="grid grid-cols-1 gap-4 text-sm">
      {[
        {
          label: "Tag in pausa",
          icon: "⏸️",
          value: qualitySummary.pausedTags,
          color: "bg-blue-50 text-blue-700 dark:bg-blue-900/20",
        },
        {
          label: "Variabili non usate",
          icon: "🧩",
          value: qualitySummary.unusedVariables,
          color: "bg-green-50 text-green-700 dark:bg-green-900/20",
        },
        {
          label: "UA obsoleti",
          icon: "📉",
          value: qualitySummary.uaTags,
          color: "bg-slate-50 text-slate-700 dark:bg-slate-900/20",
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

    <div className="mt-4 text-sm">
      <span
        className={`inline-flex items-center gap-2 px-3 py-1 font-medium rounded-full ${
          qualitySummary.status === "Ottimo"
            ? "bg-green-100 text-green-800"
            : qualitySummary.status === "Accettabile"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-red-100 text-red-700"
        }`}
      >
        ⚠️ Stato generale: {qualitySummary.status}
      </span>
    </div>
  </div>
</div>



    </main>
  );
};

export default Dashboard;