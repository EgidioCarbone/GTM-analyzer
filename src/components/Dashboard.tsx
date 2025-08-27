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
import { calculateGtmMetrics, GtmMetrics, getMetricInfo, getQualityInfo } from "../services/gtm-metrics";
import { useEffect, useState } from "react";
import InfoTooltip from "./ui/InfoTooltip";

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
  const [gtmMetrics, setGtmMetrics] = useState<GtmMetrics | null>(null);

  const tags = container?.tag ?? [];
  const triggers = container?.trigger ?? [];
  const variables = container?.variable ?? [];

  // Calcola le metriche GTM quando cambia il container
  useEffect(() => {
    if (container) {
      try {
        const metrics = calculateGtmMetrics(container);
        setGtmMetrics(metrics);
      } catch (error) {
        console.error('Errore nel calcolo delle metriche GTM:', error);
        setGtmMetrics(null);
      }
    }
  }, [container]);

  // Funzione per determinare lo stato della qualità
  const getQualityStatus = (score: number) => {
    if (score >= 90) return { status: "Eccellente", color: "bg-green-100 text-green-800", icon: "🏆" };
    if (score >= 75) return { status: "Ottimo", color: "bg-blue-100 text-blue-800", icon: "⭐" };
    if (score >= 60) return { status: "Buono", color: "bg-yellow-100 text-yellow-800", icon: "👍" };
    if (score >= 40) return { status: "Accettabile", color: "bg-orange-100 text-orange-800", icon: "⚠️" };
    return { status: "Da migliorare", color: "bg-red-100 text-red-800", icon: "🚨" };
  };

  // Calcola score complessivo basato sulla media delle qualità
  const overallScore = gtmMetrics ? Math.round(
    (gtmMetrics.quality.tags + gtmMetrics.quality.triggers + gtmMetrics.quality.variables) / 3
  ) : 0;
  
  const qualityStatus = getQualityStatus(overallScore);

  // Funzione per controllare se ci sono alert da mostrare
  const getAlerts = () => {
    const alerts: Array<{
      type: "warning" | "error";
      message: string;
      icon: string;
    }> = [];
    
    if (!gtmMetrics) return alerts;
    
    // Alert per UA obsoleti
    if (gtmMetrics.kpi.uaObsolete > 0) {
      alerts.push({
        type: "warning",
        message: "UA è obsoleto, migra a GA4.",
        icon: "⚠️"
      });
    }
    
    // Alert per troppi tag HTML custom
    if (gtmMetrics.distribution.html > gtmMetrics.counts.tags * 0.1) {
      alerts.push({
        type: "warning",
        message: "Troppi tag custom HTML aumentano rischio di errore.",
        icon: "🔧"
      });
    }
    
    // Alert per configurazione GA4 mancante
    if (gtmMetrics.distribution.googtag === 0) {
      alerts.push({
        type: "error",
        message: "Manca configurazione GA4.",
        icon: "🚨"
      });
    }
    
    return alerts;
  };

  const alerts = getAlerts();

  // Prepara i dati per i grafici
  const tagTypeCounts = gtmMetrics ? {
    ua: gtmMetrics.distribution.ua,
    gaawe: gtmMetrics.distribution.gaawe,
    googtag: gtmMetrics.distribution.googtag,
    html: gtmMetrics.distribution.html,
    other: gtmMetrics.distribution.other
  } : {};

  const sortedTypes = gtmMetrics ? gtmMetrics.distribution.chartData || [] : [];

  const barData = {
    labels: sortedTypes.map((item) => item.family),
    datasets: [
      {
        label: "# di tag",
        data: sortedTypes.map((item) => item.count),
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
      {gtmMetrics && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              🎯 Qualità del Container
            </h2>
            <div className="text-right">
              <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                {overallScore}%
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
              style={{ width: `${overallScore}%` }}
            />
          </div>
          
          {/* Potenziale miglioramento */}
          {overallScore < 100 && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                🚀 Potenziale miglioramento: <span className="font-semibold text-green-600">{100 - overallScore}%</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Ottimizza il container per raggiungere il 100% di qualità
              </p>
            </div>
          )}

          {/* Metriche dettagliate con spiegazioni */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {gtmMetrics && [
              { type: 'paused' as const, count: gtmMetrics.kpi.paused },
              { type: 'unused' as const, count: gtmMetrics.kpi.unused.total },
              { type: 'uaObsolete' as const, count: gtmMetrics.kpi.uaObsolete },
              { type: 'namingIssues' as const, count: gtmMetrics.kpi.namingIssues.total }
            ].map((metric) => {
              const info = getMetricInfo(metric.type);
              if (!info) return null; // Skip if info is undefined
              return (
                <div key={metric.type} className={`${info.color} rounded-lg p-4 border-l-4 ${info.textColor} border-l-current`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <div className="text-2xl font-bold">{metric.count}</div>
                        <div className="text-sm font-medium">{info.title}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${info.priorityColor}`}>
                      {info.priority}
                    </span>
                  </div>
                  <div className="text-xs opacity-80 mb-2">
                    🔹 {info.subtitle}
                  </div>
                  <div className="text-xs opacity-90">
                    👉 {info.impact}
                  </div>
                  <div className="text-xs mt-2 p-2 bg-white/20 rounded">
                    {info.risk}
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* Contatori principali */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tag", value: gtmMetrics?.counts.tags || 0, icon: "🏷️" },
          { label: "Trigger", value: gtmMetrics?.counts.triggers || 0, icon: "⚡" },
          { label: "Variabili", value: gtmMetrics?.counts.variables || 0, icon: "🧩" },
        ].map((card, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 p-6 shadow-md rounded-xl text-center hover:shadow-lg transition"
          >
            <div className="text-3xl mb-2">{card.icon}</div>
            <p className="text-2xl font-bold text-indigo-600">{card.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-300">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Alert educativi */}
      {alerts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            📚 Suggerimenti Educativi
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  alert.type === 'error' 
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' 
                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                }`}
              >
                <span className="text-lg">{alert.icon}</span>
                <span className="text-sm">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raccomandazioni specifiche per metrica */}
      {gtmMetrics && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            🎯 Piano d'Azione Prioritario
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gtmMetrics.actionPlan.map((item, index) => {
              const info = getMetricInfo(item.type as keyof ReturnType<typeof getMetricInfo>);
              if (!info) return null; // Skip if info is undefined
              return (
                <div key={item.type} className={`p-3 rounded-lg border-l-4 ${info.textColor} border-l-current bg-gray-50 dark:bg-gray-700`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{info.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{info.title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{item.count} elementi</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-green-600 dark:text-green-400">{item.action}</p>
                      <p className="text-xs text-gray-500">Priorità {item.priority}</p>
                    </div>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafico distribuzione tag */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-md font-semibold text-gray-800 dark:text-white mb-4">
            🥧 Distribuzione tipi di tag
          </h2>
          <Doughnut data={donutData} />
          
          {/* Micro indicatori educativi */}
          <div className="mt-4 space-y-2">
            {gtmMetrics && Object.entries(tagTypeCounts).map(([type, count]) => {
              let alert = null;
              if (type === 'html' && count > gtmMetrics.counts.tags * 0.1) {
                alert = { type: 'warning', message: 'Troppi tag HTML custom aumentano il rischio di errori' };
              } else if (type === 'googtag' && count === 0) {
                alert = { type: 'error', message: 'Manca configurazione GA4 base' };
              }
              
              return alert ? (
                <div
                  key={type}
                  className={`text-xs p-2 rounded ${
                    alert.type === 'error' 
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' 
                      : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                  }`}
                >
                  ⚠️ {alert.message}
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Tag più utilizzati */}
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

        {/* Analisi dettagliata con tooltip */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            📊 Analisi Dettagliata
          </h2>

          <div className="grid grid-cols-1 gap-4 text-sm">
            {gtmMetrics && [
              {
                label: "Qualità Tag",
                type: "tags",
                value: `${gtmMetrics.quality.tags}%`,
                color: "bg-blue-50 text-blue-700 dark:bg-blue-900/20",
              },
              {
                label: "Qualità Trigger",
                type: "triggers",
                value: `${gtmMetrics.quality.triggers}%`,
                color: "bg-green-50 text-green-700 dark:bg-green-900/20",
              },
              {
                label: "Qualità Variabili",
                type: "variables",
                value: `${gtmMetrics.quality.variables}%`,
                color: "bg-purple-50 text-purple-700 dark:bg-purple-900/20",
              },
            ].map((item) => {
              const qualityInfo = getQualityInfo(item.type);
              return (
                <div
                  key={item.type}
                  className={`${item.color} rounded-lg p-4 group relative`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{qualityInfo.icon}</div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="font-bold text-lg">{item.value}</p>
                    </div>
                  </div>
                  
                  {/* Tooltip con spiegazione */}
                  <InfoTooltip content={`👉 ${qualityInfo.description}`} position="top">
                    <div className="w-full h-full"></div>
                  </InfoTooltip>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              📊 Basato su: pulizia tag, trigger, variabili
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Clicca su "Container Manager" per ottimizzare il tuo container
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;