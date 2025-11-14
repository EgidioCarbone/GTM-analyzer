import React from 'react';
import { QualityAccordion } from './QualityAccordion';
import { IssueCard } from './IssueCard';
import { ConsentModeCard } from './ConsentModeCard';
import { TriggerQualityCard } from './TriggerQualityCard';
import { VariableQualityCard } from './VariableQualityCard';
import { HtmlSecurityCard } from './HtmlSecurityCard';
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
    if (safeScore >= 90) return { status: 'Eccellente', color: 'bg-green-100 text-green-800' };
    if (safeScore >= 75) return { status: 'Ottimo', color: 'bg-blue-100 text-blue-800' };
    if (safeScore >= 60) return { status: 'Buono', color: 'bg-yellow-100 text-yellow-800' };
    if (safeScore >= 40) return { status: 'Accettabile', color: 'bg-orange-100 text-orange-800' };
    return { status: 'Da migliorare', color: 'bg-red-100 text-red-800' };
  };

  // Usa lo score trasparente
  const overallScore = gtmMetrics?.score?.total ? Number(gtmMetrics.score.total.toFixed(1)) : 0;
  const qualityStatus = getQualityStatus(overallScore);

  // Utility per render sicuro
  const safeRender = (value: any): string => {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    console.warn('⚠️ Attempting to render object directly:', value);
    return '[Object]';
  };

  // Prepara le metriche ordinate per priorità
  const metrics = [
    { type: 'doublePageView' as const, count: gtmMetrics.kpi.doublePageView.isDoublePageView ? 1 : 0, priority: 1 },
    { type: 'consentMode' as const, count: gtmMetrics.kpi.consentMode.consent_coverage.missing + gtmMetrics.kpi.consentMode.consent_coverage.not_configured, priority: 2 },
    { type: 'triggerQuality' as const, count: gtmMetrics.kpi.triggerQuality.trigger_quality.issues.filter((i: { severity?: string }) => i.severity === 'major' || i.severity === 'critical').length, priority: 3 },
    { type: 'variableQuality' as const, count: gtmMetrics.kpi.variableQuality.variable_quality.issues.filter((i: { severity?: string }) => i.severity === 'major' || i.severity === 'critical').length, priority: 3.5 },
    { type: 'htmlSecurity' as const, count: gtmMetrics.kpi.htmlSecurity.html_security.critical + gtmMetrics.kpi.htmlSecurity.html_security.major, priority: 1.5 },
    { type: 'uaObsolete' as const, count: gtmMetrics.kpi.uaObsolete, priority: 4 },
    { type: 'unused' as const, count: gtmMetrics.kpi.unused.total, priority: 5 },
    { type: 'paused' as const, count: gtmMetrics.kpi.paused, priority: 6 },
    { type: 'namingIssues' as const, count: gtmMetrics.kpi.namingIssues.total, priority: 7 }
  ]
    .filter(
      (m): m is {
        type:
          | 'doublePageView'
          | 'consentMode'
          | 'triggerQuality'
          | 'variableQuality'
          | 'htmlSecurity'
          | 'paused'
          | 'unused'
          | 'uaObsolete'
          | 'namingIssues';
        count: number;
        priority: number;
      } => !!m && typeof m.type === 'string' && m.count != null
    )
    .sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : b.count - a.count));

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
        {metrics
          .map((metric) => {
            const info = getMetricInfo(metric.type);
            if (!info) return null;

            // Bullets standard
            const bullets = (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium">{info.subtitle}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm">{info.impact}</span>
                </div>
                <div className="mt-3 p-3 bg-white/20 rounded border-l-2 border-red-400">
                  <div className="flex items-start gap-2">
                    <span className="text-sm italic font-medium">{info.risk}</span>
                  </div>
                </div>
              </div>
            );

            // Dettagli/Breakdown
            let details: React.ReactNode = null;
            let breakdown: React.ReactNode = null;
            let subtitle: string | undefined;

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
                  {gtmMetrics.kpi.doublePageView.overlap.hasHistoryChange && <div>⚠️ HISTORY_CHANGE rilevato</div>}
                </div>
              );
            }

            if (metric.type === 'paused' || metric.type === 'uaObsolete') {
              subtitle = `${Math.round(
                (Number(metric.count) / Math.max(1, Number(gtmMetrics.counts.tags))) * 100
              )}% dei tag`;
            }

            if (metric.type === 'namingIssues') {
              subtitle = `${Math.round(
                (Number(metric.count) /
                  Math.max(
                    1,
                    Number(gtmMetrics.counts.tags) + Number(gtmMetrics.counts.triggers) + Number(gtmMetrics.counts.variables)
                  )) * 100
              )}% degli elementi`;
            }

            // CTA label
            let ctaLabel = '';
            let defaultExpanded = false;
            switch (metric.type) {
              case 'doublePageView':
                ctaLabel = 'Risolvi doppio page_view';
                break;
              case 'consentMode':
                ctaLabel = 'Rivedi impostazioni Consent';
                break;
              case 'triggerQuality':
                ctaLabel = 'Ottimizza Trigger';
                break;
              case 'variableQuality':
                ctaLabel = 'Ottimizza Variabili';
                break;
              case 'htmlSecurity':
                ctaLabel = 'Rivedi Sicurezza HTML';
                break;
              case 'uaObsolete':
                ctaLabel = 'Vedi lista UA obsoleti';
                break;
              case 'unused':
                ctaLabel = 'Elimina elementi inutili';
                break;
              case 'paused':
                ctaLabel = 'Rivedi tag in pausa';
                break;
              case 'namingIssues':
                ctaLabel = 'Rinomina elementi';
                break;
            }

            // Card speciali
            if (metric.type === 'consentMode') {
              return (
                <ConsentModeCard
                  key={metric.type}
                  consentResult={gtmMetrics.kpi.consentMode}
                  onAction={() => onMetricAction(metric.type)}
                />
              );
            }
            if (metric.type === 'triggerQuality') {
              return (
                <TriggerQualityCard
                  key={metric.type}
                  triggerResult={gtmMetrics.kpi.triggerQuality}
                  onAction={() => onMetricAction(metric.type)}
                />
              );
            }
            if (metric.type === 'variableQuality') {
              return (
                <VariableQualityCard
                  key={metric.type}
                  variableResult={gtmMetrics.kpi.variableQuality}
                  onAction={() => onMetricAction(metric.type)}
                />
              );
            }
            if (metric.type === 'htmlSecurity') {
              return (
                <HtmlSecurityCard
                  key={metric.type}
                  htmlSecurityResult={gtmMetrics.kpi.htmlSecurity}
                  onAction={() => onMetricAction(metric.type)}
                />
              );
            }

            // ---- FIX specifico per Doppio Page View ----
            const isDPV = metric.type === 'doublePageView';
            const dpvStatus = isDPV
              ? (gtmMetrics.kpi.doublePageView.status === 'ok' ? 'ok' : 'critical')
              : undefined;
            const dpvSubtitle = isDPV
              ? gtmMetrics.kpi.doublePageView.status === 'ok'
                ? '✓ Controllo superato'
                : info.subtitle
              : undefined;

            return (
              <IssueCard
                key={metric.type}
                title={info.title}
                count={metric.count}
                bullets={bullets}
                ctaLabel={ctaLabel}
                onCta={() => onMetricAction(metric.type)}
                // quando è DPV passo lo status reale per rendere pill e colori coerenti
                status={dpvStatus as any}
                subtitle={dpvSubtitle ?? subtitle}
                breakdown={breakdown}
                details={details}
                defaultExpanded={defaultExpanded}
              />
            );
          })
          .filter(Boolean)}
      </div>
    </QualityAccordion>
  );
};
