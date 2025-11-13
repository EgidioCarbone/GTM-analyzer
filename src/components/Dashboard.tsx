import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useContainer } from "../context/ContainerContext";
import type { GtmMetrics } from "../services/gtm-metrics";
import { ErrorBoundary } from "./ErrorBoundary";
import { QualityOfContainer } from "./QualityOfContainer";
import { InfoTooltip } from "./ui/InfoTooltip";

ChartJS.register(CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

// Utility functions (replace with actual implementations as needed)
function safeRender(val: unknown) {
  try {
    if (val === null || val === undefined) return '';
    return String(val);
  } catch (e) {
    return '';
  }
}

function familyLabel(key: string): string {
  switch (key) {
    case 'ua': return 'UA (obsoleto)';
    case 'gaawe': return 'GA4 Event';
    case 'googtag': return 'Google Tag';
    case 'html': return 'Custom HTML';
    case 'other': return 'Altro';
    default: return key;
  }
}

function getMetricInfo(type: string) {
  // Minimal stub â€” the real mapping may live elsewhere in the project
  return { title: type };
}

function getQualityInfo(type: string) {
  // Minimal stub
  return { title: type };
}

const Dashboard: React.FC = () => {
  const { container, analysis } = useContainer();
  const navigate = useNavigate();

  // (removed unused locals that were not used in rendering)
  
        useEffect(() => {
          if (analysis) {
            // keep effect small and safe â€” heavy computations should be pure helpers
            console.log('âœ… Dashboard usa analysis dal context:', (analysis as any)?.score?.total ?? 'n/a');
          }
        }, [analysis]);

        // Normalize gtmMetrics from `analysis` (the real project may supply the object directly)
        const gtmMetrics: GtmMetrics | undefined = (analysis as unknown) as GtmMetrics | undefined;

  // (removed unused locals to avoid Problems)
        const formattedScore = gtmMetrics?.score?.total ? Number(gtmMetrics.score.total).toFixed(1) : '0';
        const scoreBreakdown = Array.isArray(gtmMetrics?.score?.breakdown) ? gtmMetrics!.score!.breakdown : [];

        // export CSV helper
        const exportCSV = (items: unknown[], filename = 'export.csv') => {
          if (!Array.isArray(items) || items.length === 0) {
            console.warn('No items to export');
            return;
          }
          // build CSV header from keys of first object that is a plain object
          const first = items.find((it) => it && typeof it === 'object' && !Array.isArray(it)) as Record<string, unknown> | undefined;
          const keys = first ? Object.keys(first) : [];
          const rows = items.map((it) => {
            if (it && typeof it === 'object' && !Array.isArray(it)) {
              return keys.map((k) => JSON.stringify((it as Record<string, unknown>)[k] ?? '')).join(',');
            }
            return JSON.stringify(String(it));
          });
          const csvContent = (keys.length > 0 ? [keys.join(',')] : []).concat(rows).join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.setAttribute('download', filename);
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        const copyReport = () => {
          if (!gtmMetrics) return;

          const reportLines: string[] = [];
          reportLines.push(`# Report GTM Container - ${new Date().toLocaleDateString()}`);
          reportLines.push('');
          reportLines.push(`Score Qualità: ${safeRender(gtmMetrics.score?.total ?? 0)}%`);
          reportLines.push('');
          reportLines.push('Piano d\'Azione Prioritario:');
          (gtmMetrics.actionPlan ?? []).forEach((item) => {
            if (item && typeof item === 'object') {
              const info = getMetricInfo((item as any).type ?? '');
              reportLines.push(`- ${safeRender(info?.title)}: ${safeRender((item as any).count)} elementi - ${safeRender((item as any).action)} (+${safeRender((item as any).impact)}%)`);
            }
          });
          reportLines.push('');
          reportLines.push('Metriche:');
          reportLines.push(`- Tag: ${safeRender(gtmMetrics.counts?.tags ?? 0)}`);
          reportLines.push(`- Trigger: ${safeRender(gtmMetrics.counts?.triggers ?? 0)}`);
          reportLines.push(`- Variabili: ${safeRender(gtmMetrics.counts?.variables ?? 0)}`);

          navigator.clipboard?.writeText(reportLines.join('\n'))
            .then(() => {
              toast.success("Report copiato negli appunti");
            })
            .catch(() => {
              toast.error("Impossibile copiare il report");
            });
        };

        // Navigation helper
        const navigateToContainerManager = (tab: string, filter?: string) => {
          if (!tab || typeof tab !== 'string') {
            console.warn('âš ï¸ Invalid tab parameter in navigateToContainerManager:', tab);
            return;
          }
          navigate('/container-manager', { state: { activeTab: tab, autoFilter: filter } });
        };

        const handleMetricAction = (metricType: string) => {
          if (!gtmMetrics || !metricType || typeof metricType !== 'string') {
            console.warn('âš ï¸ Invalid metric type in handleMetricAction:', metricType);
            return;
          }
          switch (metricType) {
            case 'doublePageView':
              navigateToContainerManager('tags', 'ga4');
              break;
            case 'uaObsolete':
              navigateToContainerManager('tags', 'ua');
              break;
            case 'paused':
              navigateToContainerManager('tags', 'paused');
              break;
            case 'unused':
              if ((gtmMetrics.kpi?.unused?.triggers ?? 0) > 0) {
                navigateToContainerManager('triggers', 'unused');
              } else if ((gtmMetrics.kpi?.unused?.variables ?? 0) > 0) {
                navigateToContainerManager('variables', 'unused');
              } else {
                navigateToContainerManager('tags', 'no-trigger');
              }
              break;
            case 'namingIssues':
              if ((gtmMetrics.kpi?.namingIssues?.tags ?? 0) > 0) navigateToContainerManager('tags', 'naming');
              else if ((gtmMetrics.kpi?.namingIssues?.triggers ?? 0) > 0) navigateToContainerManager('triggers', 'naming');
              else if ((gtmMetrics.kpi?.namingIssues?.variables ?? 0) > 0) navigateToContainerManager('variables', 'naming');
              break;
            case 'consentMode':
              navigateToContainerManager('tags', 'marketing');
              break;
            case 'triggerQuality':
              navigateToContainerManager('triggers', 'quality');
              break;
            case 'variableQuality':
              navigateToContainerManager('variables', 'quality');
              break;
            case 'htmlSecurity':
              navigateToContainerManager('tags', 'html');
              break;
            default:
              console.warn('âš ï¸ Unknown metric type in handleMetricAction:', metricType);
              break;
          }
        };

        // Prepare data for charts
        const tagTypeCounts = gtmMetrics?.distribution
          ? {
              ua: Number(gtmMetrics.distribution.ua) || 0,
              gaawe: Number(gtmMetrics.distribution.gaawe) || 0,
              googtag: Number(gtmMetrics.distribution.googtag) || 0,
              html: Number(gtmMetrics.distribution.html) || 0,
              other: Number(gtmMetrics.distribution.other) || 0,
            }
          : {};

        const sortedTypes = (gtmMetrics?.distribution?.chartData ?? []) as Array<{ family: string; count: number }>;
        const validChartData = sortedTypes.filter((item): item is { family: string; count: number } =>
          !!item && typeof item.family === 'string' && typeof item.count === 'number'
        );

        const barAccentColor = '#7c3aed'; // violet-600
        const neutralDonutColors = [
          '#4c1d95', // violet-900
          '#5b21b6', // violet-800
          '#6d28d9', // violet-700
          '#7c3aed', // violet-600
          '#8b5cf6', // violet-500
          '#a78bfa', // violet-400
          '#c4b5fd', // violet-300
          '#ddd6fe', // violet-200
        ];

        const barData = {
          labels: validChartData.map((item) => familyLabel(String(item.family))),
          datasets: [
            {
              label: '# di tag',
              data: validChartData.map((item) => Number(item.count) || 0),
              backgroundColor: barAccentColor,
              borderRadius: 4,
            },
          ],
        };

        const donutFamilies = Object.keys(tagTypeCounts ?? {});
        const donutData = {
          labels: donutFamilies.map((k) => familyLabel(k)),
          datasets: [
            {
              data: donutFamilies.map((k) => Number((tagTypeCounts as any)[k]) || 0),
              backgroundColor: neutralDonutColors,
              borderWidth: 0,
              cutout: '65%',
            },
          ],
        };

        const donutOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top' as const,
              align: 'start' as const,
              labels: {
                color: '#6b7280', // slate-500
                usePointStyle: true,
                pointStyle: 'rectRounded' as const,
                boxWidth: 10,
                boxHeight: 10,
                padding: 10,
                font: { size: 12, weight: '600' },
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const label = ctx.label || '';
                  const value = Number(ctx.parsed) || 0;
                  const ds = ctx.dataset?.data as number[] | undefined;
                  const total = Array.isArray(ds) ? ds.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
                  const pct = total ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value} (${pct}%)`;
                },
              },
            },
          },
          layout: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        };

        // Overview cards + alerts (small derived values)
        const overviewCards = [
          { label: 'Tag', value: gtmMetrics?.counts?.tags ?? 0, acronym: 'T', helper: 'Totale tag riconosciuti' },
          { label: 'Trigger', value: gtmMetrics?.counts?.triggers ?? 0, acronym: 'TR', helper: 'Trigger attivi' },
          { label: 'Variabili', value: gtmMetrics?.counts?.variables ?? 0, acronym: 'V', helper: 'Variabili disponibili' },
        ];

        const alerts: Array<{ type: 'error' | 'warning' | 'info' | 'success'; icon: string; message: string }> = [];
        if ((gtmMetrics?.distribution?.html ?? 0) > ((gtmMetrics?.counts?.tags ?? 0) * 0.1)) {
          alerts.push({ type: 'warning', icon: '!', message: 'Troppi tag HTML custom rilevati' });
        }

        // Component render (kept original JSX structure but all variables defined above)
        if (!gtmMetrics) {
          return (
            <main className="p-6 min-h-screen bg-slate-50 dark:bg-slate-950">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Control room</p>
                  <h1 className="text-4xl font-semibold text-slate-900 dark:text-white mt-2">LikeSense GTM AIntelligence</h1>
                  <p className="mt-3 text-slate-600 dark:text-slate-300">Stiamo preparando una lettura accurata del container per offrirti indicazioni affidabili.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm flex items-center gap-5">
                  <div className="h-12 w-12 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-blue-500 animate-spin" />
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Calcoliamo le metriche GTM...</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Analisi in corso. I risultati appariranno automaticamente appena pronti.</p>
                  </div>
                </div>
              </div>
            </main>
          );
        }

        return (
          <main className="p-6 bg-slate-50 min-h-screen dark:bg-slate-950">
            <div className="max-w-6xl mx-auto space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-3 max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Control room</p>
                  <h1 className="text-4xl font-semibold text-slate-900 dark:text-white">LikeSense GTM AIntelligence</h1>
                  <p className="text-base text-slate-600 dark:text-slate-300">Supervisione professionale del container. Ogni insight nasce da metriche oggettive e verificabili.</p>
                </div>
                <div className="flex flex-col items-end gap-4">
                  <div className="rounded-2xl bg-slate-900 text-white px-6 py-4 shadow-md min-w-[200px]">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quality score</p>
                    <div className="flex items-center gap-2">
                      <p className="text-4xl font-semibold">{formattedScore}%</p>
                      <InfoTooltip
                        hideIcon={false}
                        className="align-middle"
                        content={<div className="text-left">
                          <div className="font-semibold mb-2">Calcolo Score</div>
                          {scoreBreakdown?.map((item, index) => (
                            <div key={index} className="mb-1">
                              {item.label}: {item.value}% x {item.weight}
                            </div>
                          ))}
                          <div className="border-t border-slate-300 pt-1 mt-2 font-bold">
                            = Score {formattedScore}%
                          </div>
                        </div>}
                      />
                    </div>
                  </div>
                  <button onClick={() => navigateToContainerManager('tags')} className="px-5 py-2 text-sm font-semibold text-slate-700 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Apri Container Manager</button>
                </div>
              </div>
            </div>

            <ErrorBoundary fallback={<div className="rounded-2xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 p-6 shadow-sm"><p className="text-red-700 dark:text-red-300 text-sm font-medium">Errore nel calcolo della qualita del container. Riprova piu tardi.</p></div>}>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <QualityOfContainer gtmMetrics={gtmMetrics} onMetricAction={handleMetricAction} />
              </div>
            </ErrorBoundary>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
              {overviewCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</p>
                      <p className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">{safeRender(card.value)}</p>
                    </div>
                    <span className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center text-sm font-semibold">{card.acronym}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{card.helper}</p>
                </div>
              ))}
            </div>

            {alerts.length > 0 && (
              <section className="rounded-2xl border border-amber-200 dark:border-amber-400/30 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Area di attenzione</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Verifica prioritaria per mantenere governance e compliance.</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{alerts.length} {alerts.length === 1 ? 'segnalazione' : 'segnalazioni'}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {alerts.map((alert, index) => (
                    <div key={index} className={`flex items-start gap-3 rounded-xl border p-3 ${alert.type === 'error' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200'}`}>
                      <div className="w-10 h-10 rounded-full bg-white/60 dark:bg-slate-900 flex items-center justify-center font-semibold text-base">{alert.icon}</div>
                      <p className="text-sm font-medium leading-relaxed">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Piano d'Azione Prioritario</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Interventi consigliati per massimizzare affidabilita e copertura dati.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => exportCSV((gtmMetrics.lists?.uaTags as unknown[]) ?? [], 'ua_obsoleti.csv')} className="px-3 py-1.5 text-xs font-semibold border border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-200 transition-colors" title="Esporta UA obsoleti">Esporta CSV</button>
                  <button onClick={copyReport} className="px-3 py-1.5 text-xs font-semibold border border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-200 transition-colors" title="Copia report completo">Copia Report</button>
                </div>
              </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                {(gtmMetrics.actionPlan ?? []).filter(Boolean).map((item, idx) => {
                  if (!item || typeof item !== 'object') return null;
                  const type = (item as any).type as string;
                  const info = getMetricInfo(type);
                  return (
                    <div key={type} className="p-5 rounded-2xl border border-purple-200 dark:border-purple-800 bg-indigo-50/60 dark:bg-purple-900/20 hover:border-purple-400 transition-colors" onClick={() => handleMetricAction(type)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 shrink-0 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">{String(idx + 1).padStart(2,'0')}</div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{info.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{safeRender((item as any).count)} elementi</p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">{safeRender((item as any).action)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Priorità  <span className="font-semibold">{safeRender((item as any).priority)}</span></p>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">+{safeRender((item as any).impact)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Distribuzione tipi di tag</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Conta reale per tipo di template GTM.</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">{safeRender(gtmMetrics.counts?.tags ?? 0)} totali</span>
                </div>
                <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-900/40 h-[260px] flex items-center justify-center" >
                  {donutData.labels.length > 0 && (donutData.datasets?.[0]?.data ?? []).some((v: number) => v > 0) ? (
                    <Doughnut data={donutData} options={donutOptions as any} />
                  ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400"><p>Nessun dato disponibile per il grafico</p></div>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {Object.entries(tagTypeCounts ?? {}).map(([type, count]) => {
                    if (typeof type !== 'string' || typeof count !== 'number') return null;
                    let alert = null;
                    if (type === 'html' && count > ((gtmMetrics.counts?.tags ?? 0) * 0.1)) alert = { type: 'warning', message: 'Troppi tag HTML custom aumentano il rischio di errore' };
                    else if (type === 'googtag' && count === 0) alert = { type: 'error', message: 'Manca configurazione GA4 base' };
                    else if (type === 'other' && count > 0) alert = { type: 'warning', message: `Sono presenti template non mappati (other = ${safeRender(count)}). Clicca per classificarli.` };
                    if (!alert) return null;
                    return <div key={type} className={`text-xs p-3 rounded-xl border transition-colors cursor-pointer ${alert.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`} onClick={() => { if (type === 'other') console.log('Apri gestione template non mappati'); }}>{alert.message}</div>;
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tag piu utilizzati</h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Top 5</span>
                </div>
                <div className="space-y-3">
                  {barData?.labels && barData.labels.length > 0 && (barData.datasets?.[0].data ?? []).some((v: number) => v > 0) ? barData.labels.slice(0, 5).map((label: string, index: number) => (<div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 px-4 py-3"><div className="flex items-center gap-3"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{String(index + 1).padStart(2, '0')}</span><span className="font-semibold text-slate-900 dark:text-white">{safeRender(label)}</span></div><span className="text-sm font-medium text-slate-600 dark:text-slate-300">{safeRender((barData.datasets?.[0].data as any[])[index] ?? 0)} tag</span></div>)) : <div className="text-center py-8 text-slate-500 dark:text-slate-400"><p>Nessun dato disponibile per i tag piu utilizzati</p></div>}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Analisi dettagliata</h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Aggiornata dal context</span>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  {[
                    { label: 'Tag con trigger', type: 'tags', value: `${safeRender(gtmMetrics.quality?.tags ?? 0)}%`, subtitle: 'Non copre tipo tag o obsolescenza' },
                    { label: 'Qualita Trigger', type: 'triggers', value: `${safeRender(gtmMetrics.quality?.triggers ?? 0)}%` },
                    { label: 'Qualita Variabili', type: 'variables', value: `${safeRender(gtmMetrics.quality?.variables ?? 0)}%` },
                    { label: 'Consent Mode', type: 'consent', value: `${safeRender(gtmMetrics.quality?.consent ?? 0)}%` },
                    { label: 'Configurazione Trigger', type: 'triggerQuality', value: `${safeRender(gtmMetrics.quality?.triggerQuality ?? 0)}%` },
                    { label: 'Qualita Variabili', type: 'variableQuality', value: `${safeRender(gtmMetrics.quality?.variableQuality ?? 0)}%` },
                    { label: 'Sicurezza HTML', type: 'htmlSecurity', value: `${safeRender(gtmMetrics.quality?.htmlSecurity ?? 0)}%` },
                  ].map((item) => {
                    // badge + CTA (UI-only)
                    const pct = Number(String(item.value).replace(/[^0-9.]/g, '')) || 0;
                    const badge = pct >= 90
                      ? { label: 'OK', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                      : pct >= 60
                      ? { label: 'Da verificare', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
                      : { label: 'Critica', cls: 'bg-red-50 text-red-700 border-red-200' };
                    const onCta = () => {
                      switch (item.type) {
                        case 'triggers':
                        case 'triggerQuality':
                          navigateToContainerManager('triggers', 'quality'); break;
                        case 'variables':
                        case 'variableQuality':
                          navigateToContainerManager('variables', 'quality'); break;
                        case 'htmlSecurity':
                          navigateToContainerManager('tags', 'html'); break;
                        case 'consent':
                          navigateToContainerManager('tags', 'marketing'); break;
                        case 'tags':
                          navigateToContainerManager('tags'); break;
                        default:
                          navigateToContainerManager('tags');
                      }
                    };
                    return (
                      <div key={item.type} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{item.label}</p>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <div>
                          <p className="text-2xl font-semibold text-slate-900 dark:text-white">{safeRender(item.value)}</p>
                          {item.subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.subtitle}</p>}
                        </div>
                        <div className="mt-3">
                          <button onClick={onCta} className="text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Apri dettagli</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
            </div>
          </main>
        );
  };

  export default Dashboard;












