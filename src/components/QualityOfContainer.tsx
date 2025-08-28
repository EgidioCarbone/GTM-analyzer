import React from 'react';
import { QualityAccordion } from './QualityAccordion';
import { IssueCard } from './IssueCard';
import { ConsentModeCard } from './ConsentModeCard';
import { GtmMetrics } from '../services/gtm-metrics';
import { getMetricInfo } from '../services/gtm-metrics';

export interface QualityOfContainerProps {
  gtmMetrics: GtmMetrics;
  onMetricAction: (metricType: string) => void;
}

export const QualityOfContainer: React.FC<QualityOfContainerProps> = ({
  gtmMetrics,
  onMetricAction
}) => {
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

  // Prepara i dati per le metriche con ordinamento per priorità
  const metrics = [
    { 
      type: 'doublePageView' as const, 
      count: gtmMetrics.kpi.doublePageView.isDoublePageView ? 1 : 0,
      priority: 1 // Critico
    },
    { 
      type: 'consentMode' as const, 
      count: gtmMetrics.kpi.consentMode.consent_coverage.missing + gtmMetrics.kpi.consentMode.consent_coverage.not_configured,
      priority: 2 // Critico per compliance
    },
    { 
      type: 'uaObsolete' as const, 
      count: gtmMetrics.kpi.uaObsolete,
      priority: 3 // Critico
    },
    { 
      type: 'unused' as const, 
      count: gtmMetrics.kpi.unused.total,
      priority: 4 // Alto
    },
    { 
      type: 'paused' as const, 
      count: gtmMetrics.kpi.paused,
      priority: 5 // Alto
    },
    { 
      type: 'namingIssues' as const, 
      count: gtmMetrics.kpi.namingIssues.total,
      priority: 6 // Basso
    }
  ].filter((metric): metric is { type: 'doublePageView' | 'consentMode' | 'paused' | 'unused' | 'uaObsolete' | 'namingIssues'; count: number; priority: number } => {
    // Ensure metric is valid
    if (!metric || typeof metric !== 'object' || typeof metric.type !== 'string' || metric.count == null) {
      console.warn('⚠️ Invalid metric:', metric);
      return false;
    }
    return true;
  }).sort((a, b) => {
    // Ordina per priorità (1 = più critico) e poi per count (più alto = più urgente)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.count - a.count;
  });

  return (
    <QualityAccordion
      score={overallScore}
      qualityStatus={qualityStatus}
      scoreBreakdown={gtmMetrics?.score?.breakdown?.map((item) => ({
        label: safeRender(item?.label),
        value: safeRender(item?.value),
        weight: safeRender(item?.weight)
      }))}
    >
      {/* Grid responsiva con le card delle metriche */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          if (!metric.type || typeof metric.type !== 'string') {
            console.warn('⚠️ Invalid metric type:', metric.type);
            return null;
          }
          
          const info = getMetricInfo(metric.type);
          if (!info) {
            console.warn('⚠️ No metric info found for type:', metric.type);
            return null;
          }
          
          // Prepara i bullets per ogni metrica con gerarchia tipografica migliorata
          const bullets = (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">🔹</span>
                <span className="text-sm font-medium">{info.subtitle}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">👉</span>
                <span className="text-sm">{info.impact}</span>
              </div>
              <div className="mt-3 p-3 bg-white/20 rounded border-l-2 border-red-400">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">⚠️</span>
                  <span className="text-sm italic font-medium">{info.risk}</span>
                </div>
              </div>
            </div>
          );

          // Prepara i dettagli specifici per ogni metrica
          let details: React.ReactNode = null;
          let breakdown: React.ReactNode = null;
          let subtitle: string | undefined = undefined;

          if (metric.type === 'unused') {
            breakdown = (
              <>
                <span className="cursor-pointer hover:underline" title="Click per vedere trigger non utilizzati">
                  Trigger: {safeRender(gtmMetrics.kpi.unused.triggers)}
                </span>
                <span className="cursor-pointer hover:underline" title="Click per vedere variabili non utilizzate">
                  Variabili: {safeRender(gtmMetrics.kpi.unused.variables)}
                </span>
              </>
            );
          }

          if (metric.type === 'doublePageView' && gtmMetrics.kpi.doublePageView.isDoublePageView) {
            details = (
              <div className="space-y-1">
                <div>Config: {gtmMetrics.kpi.doublePageView.configTags.length} tag</div>
                <div>Page View: {gtmMetrics.kpi.doublePageView.manualPageViewTags.length} tag</div>
                {gtmMetrics.kpi.doublePageView.overlap.sharedTriggers.length > 0 && (
                  <div>Trigger condivisi: {gtmMetrics.kpi.doublePageView.overlap.sharedTriggers.length}</div>
                )}
                {gtmMetrics.kpi.doublePageView.overlap.hasHistoryChange && (
                  <div>⚠️ HISTORY_CHANGE rilevato</div>
                )}
              </div>
            );
          }

          if (metric.type === 'paused') {
            subtitle = `${Math.round((Number(metric.count) / Math.max(1, Number(gtmMetrics.counts.tags))) * 100)}% dei tag`;
          }

          if (metric.type === 'uaObsolete') {
            subtitle = `${Math.round((Number(metric.count) / Math.max(1, Number(gtmMetrics.counts.tags))) * 100)}% dei tag`;
          }

          if (metric.type === 'namingIssues') {
            subtitle = `${Math.round((Number(metric.count) / Math.max(1, Number(gtmMetrics.counts.tags) + Number(gtmMetrics.counts.triggers) + Number(gtmMetrics.counts.variables))) * 100)}% degli elementi`;
          }

          // Determina la CTA label con verbi più forti e azioni chiare
          let ctaLabel = '';
          let defaultExpanded = false; // Tutte le card partono collapsed
          
          switch (metric.type) {
            case 'doublePageView':
              ctaLabel = '🔧 Risolvi doppio page_view';
              break;
            case 'consentMode':
              ctaLabel = '🔒 Rivedi impostazioni Consent';
              break;
            case 'uaObsolete':
              ctaLabel = '📜 Vedi lista UA obsoleti';
              break;
            case 'unused':
              ctaLabel = '🗑️ Elimina elementi inutili';
              break;
            case 'paused':
              ctaLabel = '🗂️ Rivedi tag in pausa';
              break;
            case 'namingIssues':
              ctaLabel = '✏️ Rinomina elementi';
              break;
          }

          // Special handling for consent mode card
          if (metric.type === 'consentMode') {
            return (
              <ConsentModeCard
                key={metric.type}
                consentResult={gtmMetrics.kpi.consentMode}
                onAction={() => onMetricAction(metric.type)}
              />
            );
          }

          return (
            <IssueCard
              key={metric.type}
              title={info.title}
              count={metric.count}
              icon={info.icon}
              bullets={bullets}
              ctaLabel={ctaLabel}
              onCta={() => onMetricAction(metric.type)}
              severityLabel={info.priority}
              subtitle={subtitle}
              breakdown={breakdown}
              details={details}
              defaultExpanded={defaultExpanded}
            />
          );
        }).filter(Boolean)}
      </div>
    </QualityAccordion>
  );
};
