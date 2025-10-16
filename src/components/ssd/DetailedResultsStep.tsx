import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Cookie,
  Download,
  Eye,
  FileText,
  FolderOpen,
  LayoutDashboard,
  RefreshCw,
  ShieldAlert,
  Timer
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { TestReport } from '../../types/ssd';
import { buildReportSummary } from '../../utils/report';

interface DetailedResultsStepProps {
  state: {
    currentStep: string;
    report: TestReport | null;
    dsl: any;
    url: string;
    pdfContent?: string | null;
  };
  onReset: () => void;
  onExportReport: () => void;
  onRunTestsWithData: (dsl: any, pdfContent: string, pdfBufferPath?: string) => void;
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
  if (normalized === 'BLOCKED') return 'warning';
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

const renderPdfStepHighlights = (steps?: any[]) => {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return (
    <div className="mt-4 space-y-4">
      {steps.map((step, index) => (
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
            {step.action && (
              <div className="flex items-center gap-2 text-emerald-700">
                <Activity className="h-4 w-4" />
                <span>Azione: {step.action}</span>
              </div>
            )}
            {step.target?.value && (
              <div className="flex items-center gap-2 text-emerald-700">
                <FileText className="h-4 w-4" />
                <code className="rounded bg-white px-2 py-1 text-xs text-emerald-700">
                  {step.target.value}
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
        </div>
      ))}
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

const ArtifactCard = ({
  type,
  label,
  description,
  tone,
  onClick
}: {
  type: string;
  label: string;
  description: string;
  tone: 'blue' | 'red' | 'green' | 'amber';
  onClick: () => void;
}) => {
  const toneClassesMap: Record<typeof tone, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    red: 'bg-rose-50 text-rose-700 border-rose-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-semibold ${toneClassesMap[tone]}`}>
          {type}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <Button onClick={onClick} className="mt-4 self-start px-4 py-2 text-xs font-semibold">
        Visualizza
      </Button>
    </div>
  );
};

const DebugPanel = ({ report }: { report: TestReport | null }) => {
  if (!report) return null;
  const keys = Object.keys(report ?? {});

  return (
    <details className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-sm text-yellow-800">
      <summary className="cursor-pointer font-semibold">Debug info</summary>
      <div className="mt-3 space-y-1 font-mono text-xs text-yellow-900">
        <div>Report keys: {keys.join(', ') || 'none'}</div>
        {report.requestId && <div>requestId: {report.requestId}</div>}
        {report.url && <div>url: {report.url}</div>}
        {report.timestamp && <div>timestamp: {report.timestamp}</div>}
      </div>
    </details>
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
                      <head><title>DSL Generato - SSD Test</title></head>
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
  const pdfSummary = report.pdf?.result?.summary || report.pdf?.result || null;

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

  if (report.pdf) {
    const pdfTone = statusToTone(report.pdf.status);
    const pdfMetrics: TimelineMetric[] = [
      { label: 'Durata', value: formatDuration(report.pdf.duration || pdfSummary?.duration), tone: 'info' },
      { label: 'Step eseguiti', value: String(report.pdf.steps?.length ?? pdfSummary?.steps ?? 0) },
      { label: 'Passi superati', value: String(pdfSummary?.passed ?? (report.pdf.steps ? report.pdf.steps.filter((s: any) => s.status === 'PASS').length : 0)), tone: 'success' }
    ];

    const badges: string[] = [];
    if (report.pdf.spec?.tests) {
      badges.push(`${report.pdf.spec.tests.length} test generati`);
    }

    const body = (
      <div className="space-y-3">
        {report.pdf.details && (
          <p className="text-sm text-gray-600">{report.pdf.details}</p>
        )}
        {renderPdfStepHighlights(report.pdf.steps)}
      </div>
    );

    timelineItems.push({
      id: 'pdf',
      title: 'Test da specifica PDF',
      intro: 'Esecuzione automatica degli step derivati dalla specifica',
      icon: <FileText className="h-4 w-4" />,
      status: report.pdf.status || 'INFO',
      tone: pdfTone,
      metrics: pdfMetrics,
      badges,
      body,
    });
  }

  const canReRun = Boolean(state.dsl && state.pdfContent);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-none bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.15em] text-white/70">
              <LayoutDashboard className="h-4 w-4" />
              SSD Test Report
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

      {report.artifacts && (
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Artifact generati</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {report.artifacts.htmlFile && (
              <ArtifactCard
                type="HTML"
                label="HTML Snapshot"
                description="Pagina salvata durante il test"
                tone="blue"
                onClick={async () => {
                  try {
                    const apiBaseUrl = import.meta.env.VITE_API_BASE || (window.location.origin === 'http://localhost:5173' ? 'http://localhost:3001' : '');
                    const response = await fetch(`${apiBaseUrl}/api/ssd/artifact?file=${encodeURIComponent(report.artifacts!.htmlFile!)}`);
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    } else {
                      alert('File non disponibile');
                    }
                  } catch (error) {
                    alert('Errore nel caricamento del file');
                  }
                }}
              />
            )}
            {report.artifacts.pdfTextFile && (
              <ArtifactCard
                type="PDF"
                label="PDF Text Extract"
                description="Contenuto estratto dalla specifica"
                tone="red"
                onClick={async () => {
                  try {
                    const apiBaseUrl = import.meta.env.VITE_API_BASE || (window.location.origin === 'http://localhost:5173' ? 'http://localhost:3001' : '');
                    const response = await fetch(`${apiBaseUrl}/api/ssd/artifact?file=${encodeURIComponent(report.artifacts!.pdfTextFile!)}`);
                    if (response.ok) {
                      const text = await response.text();
                      const blob = new Blob([text], { type: 'text/plain' });
                      const url = window.URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    } else {
                      alert('File non disponibile');
                    }
                  } catch (error) {
                    alert('Errore nel caricamento del file');
                  }
                }}
              />
            )}
            {report.artifacts.screenshotsFolder && (
              <ArtifactCard
                type="IMG"
                label="Screenshot"
                description="Evidenze visive raccolte dal runner"
                tone="green"
                onClick={() => {
                  const apiBaseUrl = import.meta.env.VITE_API_BASE || (window.location.origin === 'http://localhost:5173' ? 'http://localhost:3001' : '');
                  window.open(`${apiBaseUrl}/api/ssd/artifact?folder=${encodeURIComponent(report.artifacts!.screenshotsFolder!)}`, '_blank');
                }}
              />
            )}
            {report.artifacts.rawLogsPath && (
              <ArtifactCard
                type="LOG"
                label="Log esecuzione"
                description="Traccia completa delle operazioni"
                tone="amber"
                onClick={() => {
                  const apiBaseUrl = import.meta.env.VITE_API_BASE || (window.location.origin === 'http://localhost:5173' ? 'http://localhost:3001' : '');
                  window.open(`${apiBaseUrl}/api/ssd/artifact?file=${encodeURIComponent(report.artifacts!.rawLogsPath!)}`, '_blank');
                }}
              />
            )}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-gray-600">
            Richiedi nuovamente il test o esporta il risultato corrente.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={onReset} variant="outline" className="flex items-center gap-2 px-6 py-3">
              <RefreshCw className="h-4 w-4" />
              Esegui nuovo test
            </Button>
            <Button onClick={onExportReport} variant="outline" className="flex items-center gap-2 px-6 py-3">
              <Download className="h-4 w-4" />
              Esporta report
            </Button>
            <Button
              onClick={() => {
                if (state.dsl && state.pdfContent) {
                  onRunTestsWithData(state.dsl, state.pdfContent, undefined);
                }
              }}
              disabled={!canReRun}
              className="flex items-center gap-2 px-6 py-3"
            >
              <RefreshCw className="h-4 w-4" />
              Riavvia test
            </Button>
          </div>
        </div>
      </Card>

      <DebugPanel report={report} />
    </div>
  );
}
