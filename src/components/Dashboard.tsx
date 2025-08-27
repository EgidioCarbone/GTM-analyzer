import { useContainer } from "../context/ContainerContext";
import { useNavigate } from "react-router-dom";
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
import { InfoTooltip } from "./ui/InfoTooltip";

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
  const navigate = useNavigate();
  const [gtmMetrics, setGtmMetrics] = useState<GtmMetrics | null>(null);

  // Utility function to safely render values
  const safeRender = (value: any): string => {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (typeof value === 'object') {
      console.warn('⚠️ Attempting to render object directly:', value);
      return '[Object]';
    }
    return String(value);
  };

  const tags = container?.tag ?? [];
  const triggers = container?.trigger ?? [];
  const variables = container?.variable ?? [];

  // Calcola le metriche GTM quando cambia il container
  useEffect(() => {
    if (container) {
      try {
        console.log('🔍 Container data:', container);
        console.log('🔍 Container tags:', container.tag);
        console.log('🔍 Container triggers:', container.trigger);
        console.log('🔍 Container variables:', container.variable);
        
        const metrics = calculateGtmMetrics(container);
        console.log('✅ GTM Metrics calculated:', metrics);
        console.log('✅ Score breakdown:', metrics.score?.breakdown);
        setGtmMetrics(metrics);
      } catch (error) {
        console.error('Errore nel calcolo delle metriche GTM:', error);
        setGtmMetrics(null);
      }
    }
  }, [container]);

  // Funzione per determinare lo stato della qualità
  const getQualityStatus = (score: number) => {
    const safeScore = Number(score) || 0;
    if (safeScore >= 90) return { status: "Eccellente", color: "bg-green-100 text-green-800", icon: "🏆" };
    if (safeScore >= 75) return { status: "Ottimo", color: "bg-blue-100 text-blue-800", icon: "⭐" };
    if (safeScore >= 60) return { status: "Buono", color: "bg-yellow-100 text-yellow-800", icon: "👍" };
    if (safeScore >= 40) return { status: "Accettabile", color: "bg-orange-100 text-orange-800", icon: "⚠️" };
    return { status: "Da migliorare", color: "bg-red-100 text-red-800", icon: "🚨" };
  };

  // Usa il nuovo score trasparente
  const overallScore = gtmMetrics?.score?.total ? Number(gtmMetrics.score.total) : 0;
  const qualityStatus = getQualityStatus(overallScore);

  // Funzione per controllare se ci sono alert da mostrare
  const getAlerts = () => {
    const alerts: Array<{
      type: "warning" | "error" | "success";
      message: string;
      icon: string;
    }> = [];
    
    if (!gtmMetrics) return alerts;
    
    // Segnali positivi
    if (gtmMetrics.quality.tags >= 95) {
      alerts.push({
        type: "success",
        message: "Ottimo: tutti i tag hanno trigger",
        icon: "✅"
      });
    }
    
    // Alert per UA obsoleti
    if (gtmMetrics.kpi.uaObsolete > 0) {
      alerts.push({
        type: "warning",
        message: "UA è obsoleto, migra a GA4.",
        icon: "⚠️"
      });
    }
    
    // Alert per troppi tag HTML custom
    if (gtmMetrics.distribution.html > (Number(gtmMetrics.counts.tags) || 0) * 0.1) {
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

  // Funzioni per esporta e condividi
  const exportCSV = (data: any[], filename: string) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn('⚠️ exportCSV: Invalid data provided:', data);
      return;
    }
    
    // Ensure the first item is a valid object
    const firstItem = data[0];
    if (!firstItem || typeof firstItem !== 'object') {
      console.warn('⚠️ exportCSV: First item is not a valid object:', firstItem);
      return;
    }
    
    const headers = Object.keys(firstItem);
    const csvContent = [
      headers.join(','),
      ...data.map(row => {
        if (!row || typeof row !== 'object') {
          console.warn('⚠️ exportCSV: Invalid row:', row);
          return headers.map(() => '').join(',');
        }
        return headers.map(header => {
          const value = row[header];
          return JSON.stringify(safeRender(value));
        }).join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const copyReport = () => {
    if (!gtmMetrics) return;
    
    const report = `# Report GTM Container - ${new Date().toLocaleDateString()}

## Score Qualità: ${safeRender(gtmMetrics.score.total)}%

### Piano d'Azione Prioritario:
${gtmMetrics.actionPlan.map(item => {
  const info = getMetricInfo(item.type);
  return `- ${safeRender(info?.title)}: ${safeRender(item.count)} elementi - ${safeRender(item.action)} (+${safeRender(item.impact)}%)`;
}).join('\n')}

### Metriche:
- Tag: ${safeRender(gtmMetrics.counts.tags)}
- Trigger: ${safeRender(gtmMetrics.counts.triggers)}
- Variabili: ${safeRender(gtmMetrics.counts.variables)}

### KPI:
- UA Obsoleti: ${safeRender(gtmMetrics.kpi.uaObsolete)}
- In Pausa: ${safeRender(gtmMetrics.kpi.paused)}
- Non Utilizzati: ${safeRender(gtmMetrics.kpi.unused.total)}
- Naming Issues: ${safeRender(gtmMetrics.kpi.namingIssues.total)}`;

    navigator.clipboard.writeText(report);
    // TODO: Mostra toast di conferma
    console.log('Report copiato negli appunti');
  };

  // Funzioni di navigazione per le CTA
  const navigateToContainerManager = (tab: string, filter?: string) => {
    if (!tab || typeof tab !== 'string') {
      console.warn('⚠️ Invalid tab parameter in navigateToContainerManager:', tab);
      return;
    }
    
    navigate('/container-manager', { 
      state: { 
        activeTab: tab,
        filter: filter 
      } 
    });
  };

  const handleMetricAction = (metricType: string) => {
    if (!gtmMetrics || !metricType || typeof metricType !== 'string') {
      console.warn('⚠️ Invalid metric type in handleMetricAction:', metricType);
      return;
    }
    
    switch (metricType) {
      case 'uaObsolete':
        navigateToContainerManager('tags', 'ua');
        break;
      case 'paused':
        navigateToContainerManager('tags', 'paused');
        break;
      case 'unused':
        // Per unused, mostriamo una modale o navigazione intelligente
        if (gtmMetrics.kpi.unused.triggers > 0) {
          navigateToContainerManager('triggers', 'unused');
        } else if (gtmMetrics.kpi.unused.variables > 0) {
          navigateToContainerManager('variables', 'unused');
        } else {
          navigateToContainerManager('tags', 'no-trigger');
        }
        break;
      case 'namingIssues':
        // Per naming issues, naviga alla tab appropriata in base al tipo
        const tagIssues = gtmMetrics.kpi.namingIssues.tags || 0;
        const triggerIssues = gtmMetrics.kpi.namingIssues.triggers || 0;
        const variableIssues = gtmMetrics.kpi.namingIssues.variables || 0;
        
        if (tagIssues > 0) {
          navigateToContainerManager('tags', 'naming');
        } else if (triggerIssues > 0) {
          navigateToContainerManager('triggers', 'naming');
        } else if (variableIssues > 0) {
          navigateToContainerManager('variables', 'naming');
        }
        break;
      default:
        console.warn('⚠️ Unknown metric type in handleMetricAction:', metricType);
        break;
    }
  };

  // Prepara i dati per i grafici
  const tagTypeCounts = gtmMetrics?.distribution ? {
    ua: Number(gtmMetrics.distribution.ua) || 0,
    gaawe: Number(gtmMetrics.distribution.gaawe) || 0,
    googtag: Number(gtmMetrics.distribution.googtag) || 0,
    html: Number(gtmMetrics.distribution.html) || 0,
    other: Number(gtmMetrics.distribution.other) || 0
  } : {};

  const sortedTypes = gtmMetrics?.distribution?.chartData || [];
  
  // Ensure chart data is valid
  const validChartData = sortedTypes.filter((item): item is { family: string; count: number } => 
    item && 
    typeof item === 'object' && 
    typeof item.family === 'string' && 
    typeof item.count === 'number'
  );

  const barData = {
    labels: validChartData.map((item) => safeRender(item.family)) || [],
    datasets: [
      {
        label: "# di tag",
        data: validChartData.map((item) => Number(item.count) || 0) || [],
        backgroundColor: "#6366f1",
        borderRadius: 4,
      },
    ],
  };

  const donutData = {
    labels: Object.keys(tagTypeCounts || {}),
    datasets: [
      {
        data: Object.values(tagTypeCounts || {}).map(val => {
          const numVal = Number(val);
          if (isNaN(numVal)) {
            console.warn('⚠️ Invalid value in donut data:', val);
            return 0;
          }
          return numVal;
        }),
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

  // Se non ci sono metriche, mostra un messaggio di caricamento
  if (!gtmMetrics) {
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
        
        <div className="bg-white dark:bg-gray-800 p-12 rounded-xl shadow-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Calcolando le metriche GTM...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Analizziamo il tuo container per fornirti insights dettagliati
          </p>
        </div>
      </main>
    );
  }

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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <InfoTooltip content="Calcolato su pulizia tag, qualità trigger e qualità variabili con pesi diversi. Clicca per i dettagli.">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                🎯 Qualità del Container
              </h2>
            </InfoTooltip>
            <div className="text-right">
              <InfoTooltip
                content={
                  <div className="text-left">
                    <div className="font-semibold mb-2">Calcolo Score:</div>
                    {gtmMetrics?.score?.breakdown?.map((item, index) => {
                      // Ensure we only render primitive values
                      const label = safeRender(item?.label);
                      const value = safeRender(item?.value);
                      const weight = safeRender(item?.weight);
                      
                      // Additional safety check
                      if (!item || typeof item !== 'object') {
                        console.warn('⚠️ Invalid item in score breakdown:', item);
                        return null;
                      }
                      
                      return (
                        <div key={index} className="mb-1">
                          {label}: {value}% × {weight}
                        </div>
                      );
                    }).filter(Boolean)}
                    <div className="border-t border-gray-600 pt-1 mt-2 font-bold">
                      = Score {safeRender(overallScore)}%
                    </div>
                  </div>
                }
              >
                <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                  {safeRender(overallScore)}%
                </div>
              </InfoTooltip>
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
              style={{ width: `${Math.max(0, Math.min(100, Number(overallScore) || 0))}%` }}
            />
          </div>
          
          {/* Potenziale miglioramento */}
          {overallScore < 100 && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                🚀 Potenziale miglioramento: <span className="font-semibold text-green-600">{Math.max(0, 100 - (Number(overallScore) || 0))}%</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Ottimizza il container per raggiungere il 100% di qualità
              </p>
            </div>
          )}

          {/* Metriche dettagliate con spiegazioni */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { type: 'paused' as const, count: gtmMetrics.kpi.paused },
              { type: 'unused' as const, count: gtmMetrics.kpi.unused.total },
              { type: 'uaObsolete' as const, count: gtmMetrics.kpi.uaObsolete },
              { type: 'namingIssues' as const, count: gtmMetrics.kpi.namingIssues.total }
            ].filter((metric): metric is { type: 'paused' | 'unused' | 'uaObsolete' | 'namingIssues'; count: number } => {
              // Ensure metric is valid
              if (!metric || typeof metric !== 'object' || typeof metric.type !== 'string' || metric.count == null) {
                console.warn('⚠️ Invalid metric:', metric);
                return false;
              }
              return true;
            }).map((metric) => {
              if (!metric.type || typeof metric.type !== 'string') {
                console.warn('⚠️ Invalid metric type:', metric.type);
                return null;
              }
              
              const info = getMetricInfo(metric.type);
              if (!info) {
                console.warn('⚠️ No metric info found for type:', metric.type);
                return null;
              }
              
              return (
                <div key={metric.type} className={`${info.color} rounded-lg p-4 border-l-4 ${info.textColor} border-l-current`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <div className="text-2xl font-bold">{safeRender(metric.count)}</div>
                        <div className="text-sm font-medium">{info.title}</div>
                                              {/* Micro-incidenza */}
                      {metric.count > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {metric.type === 'paused' && `${Math.round((Number(metric.count) / Math.max(1, Number(gtmMetrics.counts.tags))) * 100)}% dei tag`}
                          {metric.type === 'uaObsolete' && `${Math.round((Number(metric.count) / Math.max(1, Number(gtmMetrics.counts.tags))) * 100)}% dei tag`}
                          {metric.type === 'namingIssues' && `${Math.round((Number(metric.count) / Math.max(1, Number(gtmMetrics.counts.tags) + Number(gtmMetrics.counts.triggers) + Number(gtmMetrics.counts.variables))) * 100)}% degli elementi`}
                        </div>
                      )}
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${info.priorityColor}`}>
                      {info.priority}
                    </span>
                  </div>
                  
                  {/* Breakdown per elementi non utilizzati */}
                  {metric.type === 'unused' && (
                    <div className="text-xs mb-2 p-2 bg-white/30 rounded">
                      <div className="font-medium mb-1">Breakdown:</div>
                      <div className="flex gap-2 text-xs">
                        <span className="cursor-pointer hover:underline" title="Click per vedere trigger non utilizzati">
                          Tr: {safeRender(gtmMetrics.kpi.unused.triggers)}
                        </span>
                        <span className="cursor-pointer hover:underline" title="Click per vedere variabili non utilizzate">
                          Var: {safeRender(gtmMetrics.kpi.unused.variables)}
                        </span>
                        <span className="cursor-pointer hover:underline" title="Click per vedere tag senza trigger">
                          Tag: {safeRender(gtmMetrics.kpi.unused.tagsNoTrigger)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs opacity-80 mb-2">
                    🔹 {info.subtitle}
                    {metric.type === 'uaObsolete' && (
                      <InfoTooltip content="Questi tag appartengono a Universal Analytics (obsoleto). Migra a GA4 per dati affidabili.">
                        <span className="ml-1 text-blue-500 cursor-help">ℹ️</span>
                      </InfoTooltip>
                    )}
                  </div>
                  <div className="text-xs opacity-90">
                    👉 {info.impact}
                  </div>
                  <div className="text-xs mt-2 p-2 bg-white/20 rounded">
                    {info.risk}
                  </div>
                  
                  {/* CTA coerenti */}
                  <div className="mt-3 pt-2 border-t border-white/20">
                    <button 
                      className="text-xs px-3 py-1 bg-white/30 hover:bg-white/50 rounded-full transition-colors font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMetricAction(metric.type);
                      }}
                    >
                      {metric.type === 'uaObsolete' && 'Apri lista UA'}
                      {metric.type === 'unused' && 'Apri elementi non usati'}
                      {metric.type === 'paused' && 'Gestisci tag in pausa'}
                      {metric.type === 'namingIssues' && 'Apri suggerimenti rename'}
                    </button>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>

      {/* Contatori principali */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tag", value: gtmMetrics.counts.tags || 0, icon: "🏷️" },
          { label: "Trigger", value: gtmMetrics.counts.triggers || 0, icon: "⚡" },
          { label: "Variabili", value: gtmMetrics.counts.variables || 0, icon: "🧩" },
        ].filter((card): card is { label: string; value: number; icon: string } => {
          // Ensure card is valid
          if (!card || typeof card !== 'object' || typeof card.label !== 'string' || card.value == null) {
            console.warn('⚠️ Invalid counter card:', card);
            return false;
          }
          return true;
        }).map((card, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 p-6 shadow-md rounded-xl text-center hover:shadow-lg transition"
          >
            <div className="text-3xl mb-2">{card.icon}</div>
            <p className="text-2xl font-bold text-indigo-600">{safeRender(card.value)}</p>
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
            {alerts.filter((alert): alert is { type: "warning" | "error" | "success"; message: string; icon: string } => {
              // Ensure alert is valid
              if (!alert || typeof alert !== 'object' || typeof alert.type !== 'string' || typeof alert.message !== 'string' || typeof alert.icon !== 'string') {
                console.warn('⚠️ Invalid alert:', alert);
                return false;
              }
              return true;
            }).map((alert, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  alert.type === 'error' 
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : alert.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
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
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              🎯 Piano d'Azione Prioritario
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (gtmMetrics.lists.uaTags && Array.isArray(gtmMetrics.lists.uaTags)) {
                    exportCSV(gtmMetrics.lists.uaTags, 'ua_obsoleti.csv');
                  } else {
                    console.warn('⚠️ uaTags is not a valid array:', gtmMetrics.lists.uaTags);
                  }
                }}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                title="Esporta UA obsoleti"
              >
                📊 Esporta CSV
              </button>
              <button
                onClick={copyReport}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                title="Copia report completo"
              >
                📋 Copia Report
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gtmMetrics.actionPlan.filter((item): item is NonNullable<typeof item> => {
              // Ensure item is valid
              if (!item || typeof item !== 'object') {
                console.warn('⚠️ Invalid action plan item:', item);
                return false;
              }
              return true;
            }).map((item, index) => {
              if (!item.type || typeof item.type !== 'string') {
                console.warn('⚠️ Invalid action plan item type:', item.type);
                return null;
              }
              
              const info = getMetricInfo(item.type);
              if (!info) {
                console.warn('⚠️ No metric info found for type:', item.type);
                return null;
              }
              
              return (
                <div 
                  key={item.type} 
                  className={`p-3 rounded-lg border-l-4 ${info.textColor} border-l-current bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors`}
                  onClick={() => {
                    handleMetricAction(item.type);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{info.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{info.title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{safeRender(item.count)} elementi</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-green-600 dark:text-green-400">{safeRender(item.action)}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Priorità {safeRender(item.priority)}</span>
                        <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-800 rounded-full">
                          +{safeRender(item.impact)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafico distribuzione tag */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <InfoTooltip content="Conta reale per tipo di template GTM. Nessuna deduzione dal nome.">
            <h2 className="text-md font-semibold text-gray-800 dark:text-white mb-4">
              🥧 Distribuzione tipi di tag
            </h2>
          </InfoTooltip>
          {donutData.labels.length > 0 && donutData.datasets[0].data.some(val => val > 0) ? (
            <Doughnut data={donutData} />
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Nessun dato disponibile per il grafico</p>
            </div>
          )}
          
          {/* Micro indicatori educativi */}
          <div className="mt-4 space-y-2">
            {tagTypeCounts && Object.entries(tagTypeCounts).filter(([type, count]): [string, number] | false => {
              // Ensure type and count are valid
              if (!type || typeof type !== 'string' || typeof count !== 'number') {
                console.warn('⚠️ Invalid type or count in micro indicatori:', { type, count });
                return false;
              }
              return [type, count];
            }).map(([type, count]) => {
              let alert = null;
              if (type === 'html' && count > (Number(gtmMetrics.counts.tags) || 0) * 0.1) {
                alert = { type: 'warning', message: 'Troppi tag HTML custom aumentano il rischio di errori' };
              } else if (type === 'googtag' && count === 0) {
                alert = { type: 'error', message: 'Manca configurazione GA4 base' };
              } else if (type === 'other' && count > 0) {
                alert = { 
                  type: 'warning', 
                  message: `Sono presenti template non mappati (other = ${safeRender(count)}). Clicca per classificarli.` 
                };
              }
              
              return alert ? (
                <div
                  key={type}
                  className={`text-xs p-2 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                    alert.type === 'error' 
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' 
                      : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                  }`}
                  onClick={() => {
                    if (type === 'other') {
                      // TODO: Naviga alla gestione template non mappati
                      console.log('Apri gestione template non mappati');
                    }
                  }}
                >
                  ⚠️ {alert.message}
                </div>
              ) : null;
            }).filter(Boolean)}
          </div>
        </div>

        {/* Tag più utilizzati */}
        <div className="bg-white dark:bg-gray-800 shadow-md p-6 rounded-xl flex flex-col gap-4">
          <h2 className="text-md font-semibold text-gray-800 dark:text-white mb-2">
            🏆 Tag più utilizzati
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {barData?.labels && barData.labels.length > 0 && barData.datasets[0].data.some(val => val > 0) ? (
              barData.labels.slice(0, 5).map((label, index) => {
                // Ensure label is valid
                if (!label || typeof label !== 'string') {
                  console.warn('⚠️ Invalid label in tag più utilizzati:', label);
                  return null;
                }
                
                return (
                  <div
                    key={label}
                    className="flex items-center justify-between p-4 rounded-xl shadow bg-gradient-to-r from-indigo-500 to-purple-500 text-white transition-transform hover:scale-[1.02]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅"}
                      </span>
                      <span className="font-semibold text-sm">{safeRender(label)}</span>
                    </div>
                    <span className="text-sm font-bold">
                      {safeRender(barData.datasets?.[0]?.data?.[index] ?? 0)} tag
                    </span>
                  </div>
                );
              }).filter(Boolean)
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Nessun dato disponibile per i tag più utilizzati</p>
              </div>
            )}
          </div>
        </div>

        {/* Analisi dettagliata con tooltip */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            📊 Analisi Dettagliata
          </h2>

          <div className="grid grid-cols-1 gap-4 text-sm">
            {[
              {
                label: "Tag con trigger",
                type: "tags",
                value: `${safeRender(gtmMetrics.quality.tags)}%`,
                color: "bg-blue-50 text-blue-700 dark:bg-blue-900/20",
                subtitle: "Non copre tipo tag o obsolescenza",
              },
              {
                label: "Qualità Trigger",
                type: "triggers",
                value: `${safeRender(gtmMetrics.quality.triggers)}%`,
                color: "bg-green-50 text-green-700 dark:bg-green-900/20",
              },
              {
                label: "Qualità Variabili",
                type: "variables",
                value: `${safeRender(gtmMetrics.quality.variables)}%`,
                color: "bg-purple-50 text-purple-700 dark:bg-purple-900/20",
              },
            ].filter((item): item is { label: string; type: string; value: string; color: string; subtitle?: string } => {
              // Ensure item is valid
              if (!item || typeof item !== 'object' || typeof item.label !== 'string' || typeof item.type !== 'string' || item.value == null) {
                console.warn('⚠️ Invalid quality item:', item);
                return false;
              }
              return true;
            }).map((item) => {
              const qualityInfo = getQualityInfo(item.type);
              if (!qualityInfo) {
                console.warn('⚠️ No quality info found for type:', item.type);
                return null;
              }
              return (
                <div
                  key={item.type}
                  className={`${item.color} rounded-lg p-4 group relative`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{qualityInfo.icon}</div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="font-bold text-lg">{safeRender(item.value)}</p>
                      {item.subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Tooltip con spiegazione */}
                  <InfoTooltip content={`👉 ${qualityInfo.description}`}>
                    <div className="w-full h-full"></div>
                  </InfoTooltip>
                </div>
              );
            }).filter(Boolean)}
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