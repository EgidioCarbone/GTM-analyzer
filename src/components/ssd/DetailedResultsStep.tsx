import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Cookie,
  Download,
  Eye,
  FileText,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Timer
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { TestReport, ModuleSource, ScenarioValidationOutcome } from '../../types/ssd';
import { buildReportSummary } from '../../utils/report';

interface DetailedResultsStepProps {
  state: {
    currentStep: string;
    report: TestReport | null;
    dsl: any;
    url: string;
    pdfContent?: string | null;
    moduleSource?: ModuleSource | null;
  };
  onReset: () => void;
  onExportReport: () => void;
  onRunTestsWithData: (dsl: any, pdfContent: string, pdfBufferPath?: string, moduleSource?: ModuleSource | null) => void;
}

type StatusTone = 'success' | 'warning' | 'error';

type TimelineMetric = {
  label: string;
  value: string;
  tone?: StatusTone | 'info';
};

type TimelineItem = {
  id: string;
  title: string;
  intro?: string;
  icon: React.ReactNode;
  status: string;
  tone: StatusTone;
  metrics: TimelineMetric[];
  badges?: string[];
  body?: React.ReactNode;
};

const statusToTone = (status?: string): StatusTone => {
  if (!status) return 'warning';
  const normalized = status.toUpperCase();
  if (normalized === 'PASS') return 'success';
  if (normalized === 'FAIL' || normalized === 'ERROR') return 'error';
  if (normalized === 'WARNING' || normalized === 'BLOCKED') return 'warning';
  return 'warning';
};

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  error: 'bg-rose-100 text-rose-700 border-rose-200',
};

const metricToneClasses: Record<'success' | 'warning' | 'error' | 'info', string> = {
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border border-amber-100',
  error: 'bg-rose-50 text-rose-700 border border-rose-100',
  info: 'bg-blue-50 text-blue-700 border border-blue-100',
};

const validationToneClasses: Record<StatusTone, string> = {
  success: 'border border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border border-amber-200 bg-amber-50 text-amber-900',
  error: 'border border-rose-200 bg-rose-50 text-rose-900',
};

const formatDuration = (ms?: number | null) => {
  if (ms == null) return '–';
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 120) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
};

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(date);
  } catch (error) {
    return '';
  }
};

const extractEventNames = (events?: any[]): string[] => {
  if (!Array.isArray(events)) return [];
  return events
    .map(event => event?.payload?.event || event?.event || event?.type)
    .filter(Boolean);
};

const renderDataLayerDetails = (events?: any[]) => {
  if (!Array.isArray(events) || events.length === 0) return null;

  return (
    <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
      <summary className="cursor-pointer font-medium text-blue-700">
        Eventi dataLayer catturati ({events.length})
      </summary>
      <pre className="mt-3 max-h-60 overflow-auto rounded bg-white p-4 text-xs text-gray-800">
        {JSON.stringify(events, null, 2)}
      </pre>
    </details>
  );
};

const renderScenarioStepHighlights = (steps?: any[], specSteps?: any[]) => {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return (
    <div className="mt-4 space-y-4">
      {steps.map((step, index) => {
        const specStep = Array.isArray(specSteps) ? specSteps[index] : undefined;
        const action = step.action || specStep?.action;
        const targetValue = step.target?.value || specStep?.target?.value;
        const expectations = step.expect || specStep?.expect;

        return (
        <div key={index} className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-semibold text-emerald-800">
              Step {index + 1}{step.description ? ` · ${step.description}` : ''}
            </div>
            <Badge variant={statusToTone(step.status)}>
              {step.status || 'INFO'}
            </Badge>
          </div>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {action && (
              <div className="flex items-center gap-2 text-emerald-700">
                <Activity className="h-4 w-4" />
                <span>Azione: {action}</span>
              </div>
            )}
            {targetValue && (
              <div className="flex items-center gap-2 text-emerald-700">
                <FileText className="h-4 w-4" />
                <code className="rounded bg-white px-2 py-1 text-xs text-emerald-700">
                  {targetValue}
                </code>
              </div>
            )}
          </div>
          {step.eventDetails && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-white p-4 text-xs text-blue-900">
              <p className="font-semibold text-blue-700">Evento catturato</p>
              <dl className="mt-2 grid gap-2 md:grid-cols-2">
                {step.eventDetails.event && (
                  <div>
                    <dt className="font-medium text-blue-600">Evento</dt>
                    <dd>{step.eventDetails.event}</dd>
                  </div>
                )}
                {step.eventDetails.link_text && (
                  <div>
                    <dt className="font-medium text-blue-600">Link Text</dt>
                    <dd>{step.eventDetails.link_text}</dd>
                  </div>
                )}
                {step.eventDetails.link_url && (
                  <div className="md:col-span-2">
                    <dt className="font-medium text-blue-600">URL</dt>
                    <dd className="break-all">{step.eventDetails.link_url}</dd>
                  </div>
                )}
                {step.eventDetails.index != null && (
                  <div>
                    <dt className="font-medium text-blue-600">Indice</dt>
                    <dd>{String(step.eventDetails.index)}</dd>
                  </div>
                )}
              </dl>
            </div>
            )}
            {Array.isArray(expectations) && expectations.length > 0 && (
              <div className="mt-3 text-xs text-emerald-800">
                <p className="font-semibold text-emerald-700">Expectations</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-white p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(expectations, null, 2)}
                </pre>
              </div>
            )}
            {Array.isArray(step.reasons) && step.reasons.length > 0 && (
              <div className="mt-3 text-xs text-rose-700">
                <p className="font-semibold text-rose-600">Motivazioni</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {step.reasons.map((reason: string, idx: number) => (
                    <li key={`${reason}-${idx}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
        );
      })}
    </div>
  );
};

const renderScenarioValidation = (
  validation?: ScenarioValidationOutcome | null,
  expectedPayload?: any
) => {
  if (!validation) return null;

  const tone = statusToTone(validation.status);
  const containerClasses = validationToneClasses[tone] ?? validationToneClasses.warning;
  const fallbackTitles: Record<string, string> = {
    PASS: 'Payload atteso rilevato',
    WARNING: 'Payload rilevato con differenze',
    FAIL: 'Payload atteso non rilevato',
    ERROR: 'Errore durante la validazione del payload',
    SKIPPED: 'Validazione payload non eseguita',
  };
  const title = fallbackTitles[validation.status] ?? 'Risultato validazione payload';
  const payloadToShow = expectedPayload ?? validation.expectedPayload ?? validation.normalizedExpectedPayload;

  const llmTone: StatusTone =
    validation.llm?.status === 'MATCH'
      ? 'success'
      : validation.llm?.status === 'NO_MATCH'
      ? 'error'
      : 'warning';

  return (
    <div className={`mt-4 rounded-xl p-4 text-sm shadow-sm ${containerClasses}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-base">{title}</p>
          {validation.eventName && (
            <p className="mt-1 text-xs text-gray-700">
              Evento atteso: <span className="font-semibold">{validation.eventName}</span>
            </p>
          )}
        </div>
        <Badge variant={tone}>{validation.status}</Badge>
      </div>

      {validation.reasoning && (
        <p className="mt-3 text-sm text-gray-800">{validation.reasoning}</p>
      )}

      {payloadToShow && (
        <details className="mt-3 rounded-lg bg-white/80 p-3 text-xs text-gray-900">
          <summary className="cursor-pointer font-semibold text-gray-700">Payload atteso</summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-50 p-3">
            {JSON.stringify(payloadToShow, null, 2)}
          </pre>
        </details>
      )}

      {validation.matchedEvent && (
        <details className="mt-3 rounded-lg bg-white/80 p-3 text-xs text-gray-900">
          <summary className="cursor-pointer font-semibold text-gray-700">
            Evento corrispondente
            {validation.matchedEventIndex != null ? ` (indice ${validation.matchedEventIndex})` : ''}
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-50 p-3">
            {JSON.stringify(validation.matchedEvent, null, 2)}
          </pre>
        </details>
      )}

      {Array.isArray(validation.differences) && validation.differences.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <p className="font-semibold text-rose-700">Differenze rilevate</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {validation.differences.map((diff, index) => (
              <li key={`${diff}-${index}`}>{diff}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.llm && (
        <div className="mt-3 rounded-lg border border-white/60 bg-white/80 p-3 text-xs text-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Valutazione LLM</span>
            <Badge variant={llmTone}>{validation.llm.status}</Badge>
          </div>
          {validation.llm.reasoning && (
            <p className="mt-2 text-gray-800">{validation.llm.reasoning}</p>
          )}
          {typeof validation.llm.confidence === 'number' && (
            <p className="mt-2 text-gray-600">
              Confidenza: {(validation.llm.confidence * 100).toFixed(0)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const Timeline = ({ items }: { items: TimelineItem[] }) => {
  if (items.length === 0) return null;

  return (
    <div className="relative border-l border-dashed border-gray-200 pl-8">
      {items.map((item, index) => (
        <div key={item.id} className="relative pb-10 last:pb-0">
          <div className="absolute -left-4 h-8 w-8 rounded-full border bg-white shadow-sm" style={{
            boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)'
          }}>
            <div
              className={
                'absolute inset-0 flex items-center justify-center rounded-full border ' +
                toneClasses[item.tone]
              }
            >
              {item.icon}
            </div>
          </div>

          {index !== items.length - 1 && (
            <span className="absolute -left-0.5 top-8 h-full w-0.5 bg-gradient-to-b from-gray-200 via-gray-200 to-transparent" />
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  <Badge variant={item.tone}>{item.status}</Badge>
                </div>
                {item.intro && (
                  <p className="text-sm text-gray-600">{item.intro}</p>
                )}
              </div>
              {item.badges && item.badges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.badges.map(badge => (
                    <span
                      key={badge}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-gray-600"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {item.metrics.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {item.metrics.map(metric => (
                  <div
                    key={`${item.id}-${metric.label}`}
                    className={
                      'rounded-xl px-3 py-2 text-sm font-medium ' +
                      (metric.tone ? metricToneClasses[metric.tone] : 'bg-gray-50 text-gray-700 border border-gray-100')
                    }
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {metric.label}
                    </div>
                    <div className="text-base text-gray-900">{metric.value}</div>
                  </div>
                ))}
              </div>
            )}

            {item.body && <div className="mt-4 text-sm text-gray-700">{item.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function DetailedResultsStep({
  state,
  onReset,
  onExportReport,
  onRunTestsWithData
}: DetailedResultsStepProps) {
  if (!state.report) {
    return (
      <Card className="p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Test completati</h2>
          <p className="text-gray-600">
            I test sono stati eseguiti ma i risultati dettagliati non sono disponibili.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={onReset} variant="outline" className="px-6 py-3">
            <RefreshCw className="mr-2 h-4 w-4" />
            Esegui Nuovo Test
          </Button>
          {state.dsl && (
            <Button
              onClick={() => {
                const dslWindow = window.open();
                if (dslWindow) {
                  dslWindow.document.write(`
                    <html>
                      <head><title>DSL Generato - SDD Test</title></head>
                      <body style="font-family: monospace; padding: 20px; background: #f5f5f5;">
                        <h1>DSL Generato</h1>
                        <pre style="background: white; padding: 20px; border-radius: 8px; overflow: auto;">${JSON.stringify(state.dsl, null, 2)}</pre>
                      </body>
                    </html>
                  `);
                }
              }}
              className="px-6 py-3"
            >
              <Eye className="mr-2 h-4 w-4" />
              Visualizza DSL
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const report = state.report;
  const summary = buildReportSummary(report);
  const durationLabel = formatDuration(summary.durationMs);
  const heroTimestamp = formatTimestamp(report.timestamp);
  const heroStatusTone = summary.overallStatus === 'SUCCESS'
    ? 'success'
    : summary.overallStatus === 'FAILURE'
      ? 'error'
      : 'warning';

  const heroIcon = heroStatusTone === 'success'
    ? <CheckCircle className="h-6 w-6" />
    : heroStatusTone === 'error'
      ? <ShieldAlert className="h-6 w-6" />
      : <AlertTriangle className="h-6 w-6" />;

  const consentBadges = summary.consentProfiles.length > 0
    ? summary.consentProfiles
    : report.cookie?.consentStatus
      ? [report.cookie.consentStatus]
      : [];

  const cookieEvents = extractEventNames(report.cookie?.dataLayerEvents);
  const scenarioReport = report.scenario ?? report.pdf ?? null;
  const scenarioSummary = scenarioReport?.result?.summary || scenarioReport?.summary || null;

  const timelineItems: TimelineItem[] = [];

  if (report.cookie) {
    const cookieTone = statusToTone(report.cookie.status);
    const metrics: TimelineMetric[] = [
      { label: 'Durata', value: formatDuration(report.cookie.duration), tone: 'info' },
      { label: 'Eventi dataLayer', value: String(report.cookie.dataLayerEvents?.length ?? 0), tone: 'success' },
      { label: 'Step eseguiti', value: String(report.cookie.steps?.length ?? 0) }
    ];

    const badges: string[] = [];
    if (report.cookie.consentStatus) {
      badges.push(`Consent: ${report.cookie.consentStatus}`);
    }

    const body = (
      <div className="space-y-3">
        {report.cookie.challenge?.detected && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">Challenge anti-bot rilevato</p>
              <p>
                {report.cookie.challenge.message ||
                  'Cloudflare ha richiesto una verifica manuale impedendo l’esecuzione automatica del test.'}
              </p>
            </div>
          </div>
        )}
        {report.cookie.cookieBtnSelector && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Bottone cliccato:</span>
            <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">
              {report.cookie.cookieBtnSelector}
            </code>
          </div>
        )}
        {cookieEvents.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700">Eventi catturati</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {cookieEvents.slice(0, 6).map(event => (
                <span
                  key={event}
                  className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {event}
                </span>
              ))}
            </div>
          </div>
        )}
        {renderDataLayerDetails(report.cookie.dataLayerEvents)}
      </div>
    );

    if (report.cookie.challenge?.detected) {
      badges.push('Anti-bot challenge');
    }

    timelineItems.push({
      id: 'cookie',
      title: 'Cookie banner',
      intro: 'Gestione del consenso e validazione degli eventi',
      icon: cookieTone === 'success' ? <Cookie className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />,
      status: report.cookie.status || 'INFO',
      tone: cookieTone,
      metrics,
      badges,
      body,
    });
  }

  if (scenarioReport) {
    const pdfTone = statusToTone(scenarioReport.status);
    const evaluation = scenarioReport.llm;
    const evaluationTone = evaluation ? statusToTone(evaluation.overallStatus) : null;
    const evaluationToneClasses: Record<StatusTone, string> = {
      success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      warning: 'border-amber-200 bg-amber-50 text-amber-800',
      error: 'border-rose-200 bg-rose-50 text-rose-800',
    };
    const isScenarioRun =
      scenarioReport.source === 'scenario' ||
      scenarioReport.source === 'scenario-llm' ||
      scenarioReport.source === 'manifest';
    const pdfMetrics: TimelineMetric[] = [
      { label: 'Durata', value: formatDuration(scenarioReport.duration || scenarioSummary?.duration), tone: 'info' },
      { label: 'Step eseguiti', value: String(scenarioReport.steps?.length ?? scenarioSummary?.steps ?? 0) },
      { label: 'Passi superati', value: String(scenarioSummary?.passed ?? (scenarioReport.steps ? scenarioReport.steps.filter((s: any) => s.status === 'PASS').length : 0)), tone: 'success' }
    ];

    const badges: string[] = [];
    if (scenarioReport.spec?.tests) {
      badges.push(`${scenarioReport.spec.tests.length} test generati`);
    }
    if (isScenarioRun) {
      badges.push('Scenario salvato');
    }
    if (scenarioReport.source) {
      badges.push(`Fonte: ${scenarioReport.source}`);
    }
    if (scenarioReport.validation) {
      badges.push(`Payload: ${scenarioReport.validation.status}`);
    }

    const body = (
      <div className="space-y-3">
        {scenarioReport.details && (
          <p className="text-sm text-gray-600">{scenarioReport.details}</p>
        )}
        {renderScenarioStepHighlights(
          scenarioReport.steps,
          Array.isArray(scenarioReport.spec?.tests)
            ? scenarioReport.spec.tests.flatMap((test: any) => test.steps || [])
            : undefined
        )}
        {renderScenarioValidation(scenarioReport.validation, scenarioReport.expectedPayload)}
        {renderDataLayerDetails(
          Array.isArray(scenarioReport.steps)
            ? scenarioReport.steps.flatMap(
                (step: any) => step?.evidence?.dataLayerEvents || []
              )
            : []
        )}
        {evaluation && evaluationTone && (
          <div className={`rounded-xl border p-4 text-sm shadow-sm ${evaluationToneClasses[evaluationTone]}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4" />
                <span>Valutazione LLM</span>
              </div>
              <Badge variant={evaluationTone}>{evaluation.overallStatus}</Badge>
            </div>
            {evaluation.reasoning && (
              <p className="mt-2 text-sm opacity-90">{evaluation.reasoning}</p>
            )}
            {evaluation.stepFindings && evaluation.stepFindings.length > 0 && (
              <div className="mt-3 space-y-2">
                {evaluation.stepFindings.map((finding, index) => {
                  const findingTone = statusToTone(finding.status);
                  return (
                    <div
                      key={`${finding.description || index}-${index}`}
                      className="rounded-lg border border-white/50 bg-white/70 p-3 text-sm text-gray-800 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 font-medium text-gray-900">
                          <ListChecks className="h-4 w-4" />
                          <span>{finding.description || `Step ${index + 1}`}</span>
                        </div>
                        <Badge variant={findingTone}>{finding.status}</Badge>
                      </div>
                      {finding.message && (
                        <p className="mt-1 text-gray-700">{finding.message}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {evaluation.suggestedFixes && evaluation.suggestedFixes.length > 0 && (
              <div className="mt-3 rounded-lg border border-white/40 bg-white/60 p-3 text-sm text-gray-800">
                <p className="font-semibold text-gray-900">Suggerimenti</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-gray-700">
                  {evaluation.suggestedFixes.map((fix, index) => (
                    <li key={`${fix}-${index}`}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {scenarioReport.llmError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <span>Valutazione LLM non disponibile</span>
            </div>
            <p className="mt-1 text-amber-700">{scenarioReport.llmError}</p>
          </div>
        )}
      </div>
    );

    timelineItems.push({
      id: 'pdf',
      title: isScenarioRun ? 'Scenario DSL' : 'Test da specifica PDF',
      intro: isScenarioRun
        ? 'Esecuzione della DSL generata dallo scenario salvato'
        : 'Esecuzione automatica degli step derivati dalla specifica',
      icon: <FileText className="h-4 w-4" />,
      status: scenarioReport.status || 'INFO',
      tone: pdfTone,
      metrics: pdfMetrics,
      badges,
      body,
    });
  }

  const canReRun = Boolean(state.dsl);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-none bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.15em] text-white/70">
              <LayoutDashboard className="h-4 w-4" />
              SDD Test Report
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white`}>{heroIcon}</div>
              <div>
                <h2 className="text-2xl font-bold">
                  {summary.overallStatus === 'SUCCESS'
                    ? 'Tutti i test sono passati'
                    : summary.overallStatus === 'FAILURE'
                      ? 'Sono necessari approfondimenti'
                      : 'Risultati parziali disponibili'}
                </h2>
                <p className="text-sm text-white/80">
                  {state.url}{heroTimestamp ? ` • ${heroTimestamp}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {consentBadges.map(profile => (
              <span
                key={profile}
                className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
              >
                {profile}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <div className="rounded-xl bg-white/10 p-4 text-sm">
            <div className="text-white/70">Test totali</div>
            <div className="text-2xl font-semibold">{summary.totalTests}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 text-sm">
            <div className="text-white/70">Superati</div>
            <div className="text-2xl font-semibold text-emerald-200">{summary.passed}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 text-sm">
            <div className="text-white/70">Falliti</div>
            <div className="text-2xl font-semibold text-rose-200">{summary.failed}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 text-sm">
            <div className="text-white/70">Bloccati</div>
            <div className="text-2xl font-semibold text-amber-200">{summary.blocked}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-4 text-sm">
            <div className="text-white/70">Durata totale</div>
            <div className="flex items-center gap-2 text-2xl font-semibold">
              <Timer className="h-5 w-5 text-white/70" />
              {durationLabel}
            </div>
          </div>
        </div>
      </Card>

      {(state.report.challenge?.detected || state.report.cookie?.challenge?.detected) && (
        <Card className="border border-amber-300 bg-amber-50 p-5 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-amber-600" />
            <div>
              <h3 className="text-lg font-semibold">Challenge anti-bot rilevato</h3>
              <p className="text-sm mt-1">
                {state.report.cookie?.challenge?.message || state.report.challenge?.message || 'Cloudflare ha richiesto una verifica manuale impedendo l’esecuzione dei test automatizzati.'}
              </p>
              {state.report.cookie?.challenge?.url && (
                <p className="mt-2 text-xs text-amber-700 break-all">
                  Pagina: {state.report.cookie.challenge.url}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Timeline esecuzione</h3>
        </div>
        <Timeline items={timelineItems} />
      </Card>

      <div className="sticky bottom-8 flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/75 px-6 py-5 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <span>Richiedi nuovamente il test, esporta il report o riparti da zero.</span>
          <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Azioni rapide</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            onClick={onReset}
            variant="outline"
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Nuovo test
          </Button>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={onExportReport}
              variant="outline"
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Esporta report
            </Button>
            <Button
              onClick={() => {
                if (state.dsl) {
                  onRunTestsWithData(state.dsl, state.pdfContent ?? '', undefined, state.moduleSource ?? null);
                }
              }}
              disabled={!canReRun}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-2xl focus:ring-4 focus:ring-purple-300/40 disabled:cursor-not-allowed disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500"
            >
              <RefreshCw className="h-4 w-4" />
              Riavvia con gli stessi dati
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
