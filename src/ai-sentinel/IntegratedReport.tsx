import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  Code,
  Cookie,
  Database,
  Globe,
  Megaphone,
  Network,
  Shield,
  XCircle
} from 'lucide-react';
import { getApiBaseUrl, resolveScreenshotUrl } from '../utils/api-base';

interface ScenarioResult {
  latestConsent: {
    ad_user_data: string;
    ad_personalization: string;
    ad_storage: string;
    analytics_storage: string;
    functionality_storage: string;
    security_storage: string;
  };
  cookies: Array<{
    name: string;
    domain: string;
    expires: number;
  }>;
  gaAdsRequests: Array<{
    url: string;
    ts: number;
    frameUrl?: string;
    resourceType?: string;
    method?: string;
  }>;
  gtagCalls: any[];
  dataLayer: any[];
  llmTestResult?: boolean;
  llmServiceAvailable?: boolean;
  artifacts: {
    screenshotPath?: string;
    screenshotDataUrl?: string;
    cookieBannerScreenshotPath?: string;
    tracePath?: string;
  };
  warnings?: string[];
  skipped?: boolean;
}

interface ConsentTestResult {
  engine: string;
  url: string;
  generatedAt: string;
  summary: {
    pass: boolean;
    notes: string[];
  };
  results: {
    reject: ScenarioResult;
    accept: ScenarioResult;
    [key: string]: ScenarioResult;
  };
  env: {
    userAgent: string;
    locale: string;
    region: string;
  };
}

interface IntegratedReportProps {
  result: ConsentTestResult;
  activeTab: string;
}

interface ScenarioSummary {
  key: string;
  name: string;
  weight: number;
  score: number;
  status: 'PASS' | 'FAIL';
  issues: string[];
  cookies: number;
  requests: number;
}

const paletteByTone = {
  success: {
    border: 'border-emerald-100',
    accent: 'bg-emerald-500',
    accentMuted: 'bg-emerald-100',
    text: 'text-emerald-700',
    icon: 'text-emerald-600',
  },
  warning: {
    border: 'border-amber-100',
    accent: 'bg-amber-500',
    accentMuted: 'bg-amber-100',
    text: 'text-amber-700',
    icon: 'text-amber-600',
  },
  danger: {
    border: 'border-rose-100',
    accent: 'bg-rose-500',
    accentMuted: 'bg-rose-100',
    text: 'text-rose-700',
    icon: 'text-rose-600',
  },
} as const;

const IntegratedReport: React.FC<IntegratedReportProps> = ({ result }) => {
  const [selectedScenario, setSelectedScenario] = useState('reject');
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [bannerImageError, setBannerImageError] = useState(false);
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const allScenarios = result.results;
  const availableKeys = useMemo(
    () => Object.keys(allScenarios).filter(key => !allScenarios[key]?.skipped),
    [allScenarios]
  );

  useEffect(() => {
    const current = allScenarios[selectedScenario];
    if (!current || current.skipped) {
      const fallback = availableKeys[0] ?? Object.keys(allScenarios).find(key => !allScenarios[key]?.skipped);
      if (fallback && fallback !== selectedScenario) {
        setSelectedScenario(fallback);
      }
    }
  }, [allScenarios, availableKeys, selectedScenario]);

  const resolvedScenario = allScenarios[selectedScenario];
  const fallbackScenario =
    (allScenarios.reject && !allScenarios.reject.skipped && allScenarios.reject) ||
    Object.values(allScenarios).find(scenario => scenario && !scenario.skipped) ||
    resolvedScenario;
  const activeScenario = resolvedScenario && !resolvedScenario.skipped ? resolvedScenario : fallbackScenario;

  const cookieBannerScreenshotArtifacts = useMemo(() => {
    const scenarios = Object.values(allScenarios);
    return scenarios.find(
      scenario =>
        scenario.artifacts?.cookieBannerScreenshotPath ||
        scenario.artifacts?.screenshotPath ||
        scenario.artifacts?.screenshotDataUrl
    )?.artifacts;
  }, [allScenarios]);

  const bannerRawImage = useMemo(() => {
    if (!cookieBannerScreenshotArtifacts) return '';
    return (
      cookieBannerScreenshotArtifacts.cookieBannerScreenshotPath ||
      cookieBannerScreenshotArtifacts.screenshotDataUrl ||
      cookieBannerScreenshotArtifacts.screenshotPath ||
      ''
    );
  }, [cookieBannerScreenshotArtifacts]);

  useEffect(() => {
    setBannerImageError(false);
  }, [bannerRawImage]);

  const testDate = useMemo(() => new Date(result.generatedAt), [result.generatedAt]);
  const formattedDate = useMemo(() => testDate.toLocaleDateString('it-IT'), [testDate]);
  const formattedTime = useMemo(
    () => testDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    [testDate]
  );

  const scenarioSummaries: ScenarioSummary[] = useMemo(() => {
    const summaries: ScenarioSummary[] = [];

    const buildIssues = (
      cookiesCount: number,
      requestsCount: number,
      consentChecks: Array<{ cond: boolean; msg: string }>
    ) => {
      const issues: string[] = [];
      if (cookiesCount > 0) issues.push(`${cookiesCount} cookie non necessari rilevati`);
      if (requestsCount > 0) issues.push(`${requestsCount} richieste GA/Ads intercettate`);
      consentChecks.forEach(({ cond, msg }) => {
        if (cond) issues.push(msg);
      });
      return issues;
    };

    const rejectScenario = allScenarios.reject;
    if (rejectScenario) {
      const cookiesCount = rejectScenario.cookies?.length || 0;
      const requestsCount = rejectScenario.gaAdsRequests?.length || 0;
      if (rejectScenario.skipped) {
        summaries.push({
          key: 'reject',
          name: 'Reject All',
          weight: 0,
          score: 100,
          status: 'PASS',
          issues: ['Scenario non eseguito (modalità onlyReject)'],
          cookies: 0,
          requests: 0,
        });
      } else if (rejectScenario.llmTestResult !== undefined && rejectScenario.llmTestResult !== null) {
        summaries.push({
          key: 'reject',
          name: 'Reject All',
          weight: 0.5,
          score: rejectScenario.llmTestResult ? 100 : 0,
          status: rejectScenario.llmTestResult ? 'PASS' : 'FAIL',
          issues: rejectScenario.llmTestResult ? [] : ['Test LLM: consensi non rifiutati correttamente'],
          cookies: cookiesCount,
          requests: requestsCount,
        });
      } else {
        const consentValues = Object.values(rejectScenario.latestConsent || {});
        const consentIssues = consentValues.some(value => value === 'granted');
        const issues = buildIssues(cookiesCount, requestsCount, [
          { cond: consentIssues, msg: 'Consent Mode riporta valori "granted" dopo il rifiuto' },
        ]);
        summaries.push({
          key: 'reject',
          name: 'Reject All',
          weight: 0.5,
          score: issues.length === 0 ? 100 : 0,
          status: issues.length === 0 ? 'PASS' : 'FAIL',
          issues,
          cookies: cookiesCount,
          requests: requestsCount,
        });
      }
    }

    const acceptScenario = allScenarios.accept;
    if (acceptScenario) {
      const cookiesCount = acceptScenario.cookies?.length || 0;
      const requestsCount = acceptScenario.gaAdsRequests?.length || 0;
      if (acceptScenario.skipped) {
        summaries.push({
          key: 'accept',
          name: 'Accept All',
          weight: 0,
          score: 100,
          status: 'PASS',
          issues: ['Scenario non eseguito (modalità onlyReject)'],
          cookies: 0,
          requests: 0,
        });
      } else if (acceptScenario.llmTestResult !== undefined && acceptScenario.llmTestResult !== null) {
        summaries.push({
          key: 'accept',
          name: 'Accept All',
          weight: 0.5,
          score: acceptScenario.llmTestResult ? 100 : 0,
          status: acceptScenario.llmTestResult ? 'PASS' : 'FAIL',
          issues: acceptScenario.llmTestResult ? [] : ['Test LLM: consensi non accettati correttamente'],
          cookies: cookiesCount,
          requests: requestsCount,
        });
      } else {
        const consentValues = Object.values(acceptScenario.latestConsent || {});
        const consentGranted = consentValues.some(value => value === 'granted');
        const issues: string[] = [];
        if (!consentGranted) {
          issues.push('Consent Mode non riporta valori "granted" dopo l\'accettazione');
        }
        if (requestsCount === 0 && cookiesCount === 0) {
          issues.push('Nessuna attività di tracciamento rilevata dopo l\'accettazione');
        }
        summaries.push({
          key: 'accept',
          name: 'Accept All',
          weight: 0.5,
          score: issues.length === 0 ? 100 : 0,
          status: issues.length === 0 ? 'PASS' : 'FAIL',
          issues,
          cookies: cookiesCount,
          requests: requestsCount,
        });
      }
    }

    Object.entries(allScenarios)
      .filter(([key]) => key.startsWith('custom-'))
      .forEach(([key, scenario]) => {
        if (scenario.skipped) {
          summaries.push({
            key,
            name: key.replace('custom-', 'Custom '),
            weight: 0,
            score: 100,
            status: 'PASS',
            issues: ['Scenario non eseguito (modalità onlyReject)'],
            cookies: 0,
            requests: 0,
          });
          return;
        }
        const cookiesCount = scenario.cookies?.length || 0;
        const requestsCount = scenario.gaAdsRequests?.length || 0;
        const issues = buildIssues(cookiesCount, requestsCount, []);
        const customWeight = 0.2 / Math.max(1, Object.keys(allScenarios).filter(k => k.startsWith('custom-')).length);
        summaries.push({
          key,
          name: key.replace('custom-', 'Custom '),
          weight: customWeight,
          score: issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 40),
          status: issues.length === 0 ? 'PASS' : 'FAIL',
          issues,
          cookies: cookiesCount,
          requests: requestsCount,
        });
      });

    return summaries;
  }, [allScenarios]);

  const weightedScore = useMemo(() => {
    if (scenarioSummaries.length === 0) return 0;
    const totalWeight = scenarioSummaries.reduce((sum, scenario) => sum + scenario.weight, 0) || 1;
    return Math.round(
      scenarioSummaries.reduce((sum, scenario) => sum + scenario.score * scenario.weight, 0) / totalWeight
    );
  }, [scenarioSummaries]);

  const failingIssues = useMemo(
    () =>
      scenarioSummaries
        .filter(summary => summary.status === 'FAIL' && summary.issues.length > 0)
        .map(summary => ({ name: summary.name, issues: summary.issues })),
    [scenarioSummaries]
  );

  const complianceStatus = useMemo(() => {
    if (weightedScore >= 80) {
      return {
        label: 'CONFORMITÀ ELEVATA',
        tone: 'success' as const,
        description: 'Il sito rispetta correttamente le preferenze di consenso nelle condizioni testate.',
      };
    }
    if (weightedScore >= 60) {
      return {
        label: 'ATTENZIONE',
        tone: 'warning' as const,
        description: 'Sono emerse aree di miglioramento: alcuni scenari richiedono verifica.',
      };
    }
    return {
      label: 'PROBLEMI CRITICI',
      tone: 'danger' as const,
      description: 'Il sito non rispetta le preferenze di consenso nei casi fondamentali (es. rifiuto).',
    };
  }, [weightedScore]);

  const ToneIcon = complianceStatus.tone === 'success'
    ? CheckCircle
    : complianceStatus.tone === 'warning'
      ? AlertTriangle
      : XCircle;
  const palette = paletteByTone[complianceStatus.tone];

  const consentEntries = useMemo(() => {
    if (!activeScenario) return [] as Array<{ label: string; value: string }>;
    const consent = activeScenario.latestConsent || {};
    return [
      { label: 'Ad Storage', value: consent.ad_storage },
      { label: 'Analytics Storage', value: consent.analytics_storage },
      { label: 'Ad Personalization', value: consent.ad_personalization },
      { label: 'Ad User Data', value: consent.ad_user_data },
      { label: 'Functionality', value: consent.functionality_storage },
      { label: 'Security', value: consent.security_storage },
    ].filter(entry => entry.value);
  }, [activeScenario]);

  const consentBadgeClasses = (value: string) => {
    if (!value) return 'border border-gray-200 bg-gray-50 text-gray-600';
    const normalized = value.toLowerCase();
    if (normalized === 'granted') {
      return 'border border-emerald-100 bg-emerald-50 text-emerald-700';
    }
    if (normalized === 'denied') {
      return 'border border-rose-100 bg-rose-50 text-rose-700';
    }
    return 'border border-amber-100 bg-amber-50 text-amber-700';
  };

  const renderScenarioIcon = (key: string) => {
    if (key === 'reject') {
      return <Megaphone className="h-10 w-10 text-rose-500" />;
    }
    if (key === 'accept') {
      return <Globe className="h-10 w-10 text-sky-500" />;
    }
    return <Cookie className="h-10 w-10 text-purple-500" />;
  };

  const getScenarioDisplayName = (scenarioKey: string) => {
    if (scenarioKey === 'reject') return 'Reject All';
    if (scenarioKey === 'accept') return 'Accept All';
    if (scenarioKey.startsWith('custom-')) return 'Custom Scenario';
    return scenarioKey;
  };

  if (!activeScenario) {
    return null;
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={`rounded-2xl border ${palette.border} bg-white p-6 shadow-sm`}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                  GDPR Compliance Report
                </p>
                <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.25rem)] font-semibold text-gray-900">
                  {new URL(result.url).hostname}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Test eseguito il {formattedDate} alle {formattedTime}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${palette.accentMuted} ${palette.text}`}
              >
                <ToneIcon className={`h-4 w-4 ${palette.icon}`} />
                {complianceStatus.label}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-700">{complianceStatus.description}</p>
            {result.summary.notes && result.summary.notes.length > 0 && (
              <div className="space-y-1 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-800">Note automatiche</p>
                {result.summary.notes.map((note, idx) => (
                  <p key={idx}>{note}</p>
                ))}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <span>Punteggio complessivo</span>
                <span>{weightedScore}%</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${palette.accent} transition-all duration-700`}
                  style={{ width: `${weightedScore}%` }}
                />
              </div>
            </div>
            {failingIssues.length > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                <p className="mb-2 font-semibold">Motivi principali</p>
                <ul className="list-disc space-y-1 pl-5">
                  {failingIssues.map((item, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{item.name}</span>: {item.issues.join(' • ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-600">Score attuale</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold text-gray-900">{weightedScore}</span>
                  <span className="mb-1 text-sm text-gray-500">/100</span>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${palette.accentMuted} ${palette.text}`}>
                {complianceStatus.tone === 'success'
                  ? 'Alta conformità'
                  : complianceStatus.tone === 'warning'
                    ? 'Verifica consigliata'
                    : 'Azione necessaria'}
              </span>
            </div>
            <div className="mt-6 grid gap-3">
              <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                <span className="text-xs uppercase tracking-wide text-gray-500">Engine</span>
                <p className="mt-1 font-semibold text-gray-900">{result.engine}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                <span className="text-xs uppercase tracking-wide text-gray-500">Regione test</span>
                <p className="mt-1 font-semibold text-gray-900">
                  {result.env.region} · {result.env.locale}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                <span className="text-xs uppercase tracking-wide text-gray-500">User agent</span>
                <p className="mt-1 break-words text-xs leading-relaxed text-gray-600">{result.env.userAgent}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Scenari disponibili</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {availableKeys.map(scenarioKey => (
                <button
                  key={scenarioKey}
                  type="button"
                  onClick={() => {
                    setSelectedScenario(scenarioKey);
                    setExpandedDetails(null);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    selectedScenario === scenarioKey
                      ? 'border-sky-500 bg-sky-100 text-sky-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getScenarioDisplayName(scenarioKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Dettaglio scenari</h2>
          </div>
          <span className="text-xs uppercase tracking-wide text-gray-500">
            Scenario attivo: {getScenarioDisplayName(selectedScenario)}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenarioSummaries.map(summary => {
            const isSelectable = availableKeys.includes(summary.key);
            const isActive = selectedScenario === summary.key;
            return (
              <button
                key={summary.key}
                type="button"
                disabled={!isSelectable}
                onClick={() => {
                  if (!isSelectable) return;
                  setSelectedScenario(summary.key);
                  setExpandedDetails(null);
                }}
                className={`relative w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
                  isActive ? 'border-sky-400 shadow-lg ring-4 ring-sky-200/60' : 'border-gray-200 hover:-translate-y-1 hover:shadow-md'
                } ${!isSelectable ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {renderScenarioIcon(summary.key)}
                    <div>
                      <p className="text-base font-semibold text-gray-900">{summary.name}</p>
                      <p className="text-xs text-gray-500">Peso {Math.round(summary.weight * 100)}%</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      summary.status === 'PASS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {summary.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400">Punteggio</span>
                    <span
                      className={`mt-1 block text-sm font-semibold ${
                        summary.status === 'PASS' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {summary.score}%
                    </span>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400">Richieste GA/Ads</span>
                    <span className="mt-1 block text-sm font-semibold text-gray-700">{summary.requests}</span>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400">Cookie rilevati</span>
                    <span className="mt-1 block text-sm font-semibold text-gray-700">{summary.cookies}</span>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400">Scenario</span>
                    <span className="mt-1 block text-sm font-semibold text-gray-700">{summary.key}</span>
                  </div>
                </div>

                {summary.issues.length > 0 && (
                  <div className="mt-4 space-y-1 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                    {summary.issues.map((issue, idx) => (
                      <p key={idx}>• {issue}</p>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Dettagli tecnici</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableKeys.map(scenarioKey => (
              <button
                key={scenarioKey}
                type="button"
                onClick={() => {
                  setSelectedScenario(scenarioKey);
                  setExpandedDetails(null);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  selectedScenario === scenarioKey
                    ? 'border-sky-500 bg-sky-100 text-sky-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {getScenarioDisplayName(scenarioKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {bannerRawImage ? (() => {
              const screenshotUrl = resolveScreenshotUrl(bannerRawImage, apiBaseUrl);
              const isDataUrl = bannerRawImage.startsWith('data:');

              return (
                <div className="rounded-2xl border border-gray-100 bg-gray-900/5 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Camera className="h-5 w-5 text-gray-600" />
                      <span className="font-medium text-gray-900">Screenshot cookie banner</span>
                    </div>
                    {!bannerImageError && (
                      <button
                        type="button"
                        onClick={() => setScreenshotPreview(screenshotUrl)}
                        className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                      >
                        Apri in grande
                      </button>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-white/60 bg-white shadow-sm">
                    {bannerImageError ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-600">
                        <span>Impossibile caricare lo screenshot dal backend.</span>
                        <span className="text-xs text-gray-500">File: {bannerRawImage}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setScreenshotPreview(screenshotUrl)}
                        className="block w-full"
                      >
                        <img
                          src={screenshotUrl}
                          alt="Cookie banner"
                          className="h-auto w-full object-contain"
                          loading="lazy"
                          onError={() => setBannerImageError(true)}
                          onLoad={() => setBannerImageError(false)}
                        />
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    {isDataUrl ? 'Screenshot inline' : `File: ${bannerRawImage}`}
                  </p>
                </div>
              );
            })() : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                Nessuno screenshot disponibile per questo scenario.
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">DataLayer snapshot</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Scenario: {getScenarioDisplayName(selectedScenario)}
              </p>
              {activeScenario.dataLayer && activeScenario.dataLayer.length > 0 ? (
                <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-white p-3 text-xs leading-5 text-gray-700 shadow-inner">
                  {JSON.stringify(activeScenario.dataLayer, null, 2)}
                </pre>
              ) : (
                <p className="mt-3 text-sm text-gray-600">
                  Nessun evento dataLayer registrato per questo scenario.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Consent mode state</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 sm:text-sm">
                {consentEntries.length > 0 ? (
                  consentEntries.map(entry => (
                    <div
                      key={entry.label}
                      className={`rounded-xl px-3 py-2 text-left font-medium ${consentBadgeClasses(entry.value)}`}
                    >
                      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {entry.label}
                      </span>
                      <span className="text-sm">{entry.value}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">Nessun dato di consenso disponibile.</p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cookie className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Cookie rilevati</span>
                </div>
                {activeScenario.cookies?.length ? (
                  <button
                    type="button"
                    onClick={() => setExpandedDetails(expandedDetails === 'cookies' ? null : 'cookies')}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    {expandedDetails === 'cookies' ? 'Nascondi' : 'Dettagli'}
                  </button>
                ) : null}
              </div>
              <p className="text-sm text-gray-600">
                {activeScenario.cookies?.length
                  ? `${activeScenario.cookies.length} cookie tracciati`
                  : 'Nessun cookie di interesse rilevato'}
              </p>
              {expandedDetails === 'cookies' && activeScenario.cookies?.length ? (
                <div className="space-y-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                  {activeScenario.cookies.map((cookie, index) => (
                    <div
                      key={`${cookie.name}-${index}`}
                      className="flex flex-wrap justify-between gap-2 border-b border-white/60 pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="font-semibold text-gray-800">{cookie.name}</div>
                      <div className="text-gray-500">{cookie.domain}</div>
                      <div className="text-gray-400">
                        Expires: {cookie.expires ? new Date(cookie.expires * 1000).toLocaleString('it-IT') : 'session'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Richieste di rete</span>
                </div>
                {activeScenario.gaAdsRequests?.length ? (
                  <button
                    type="button"
                    onClick={() => setExpandedDetails(expandedDetails === 'requests' ? null : 'requests')}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    {expandedDetails === 'requests' ? 'Nascondi' : 'Dettagli'}
                  </button>
                ) : null}
              </div>
              <p className="text-sm text-gray-600">
                {activeScenario.gaAdsRequests?.length
                  ? `${activeScenario.gaAdsRequests.length} richieste GA/Ads`
                  : 'Nessuna richiesta GA/Ads intercettata'}
              </p>
              {expandedDetails === 'requests' && activeScenario.gaAdsRequests?.length ? (
                <div className="space-y-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                  {activeScenario.gaAdsRequests.map((request, index) => (
                    <div key={`${request.url}-${index}`} className="space-y-1 rounded-xl bg-white p-2 shadow-sm">
                      <div className="text-gray-500">{new Date(request.ts).toLocaleTimeString('it-IT')}</div>
                      <div className="break-all font-medium text-gray-800">{request.url}</div>
                      {request.frameUrl && <div className="text-gray-500">Frame: {request.frameUrl}</div>}
                      {request.resourceType && <div className="text-gray-500">Tipo: {request.resourceType}</div>}
                      {request.method && <div className="text-gray-500 uppercase">Metodo: {request.method}</div>}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">Tracking overview</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600 sm:text-sm">
                <div>
                  <dt className="uppercase tracking-wide text-gray-400">Eventi DataLayer</dt>
                  <dd className="font-semibold text-gray-800">{activeScenario.dataLayer?.length ?? 0}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-gray-400">Chiamate gtag</dt>
                  <dd className="font-semibold text-gray-800">{activeScenario.gtagCalls?.length ?? 0}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-gray-400">Cookie rilevati</dt>
                  <dd className="font-semibold text-gray-800">{activeScenario.cookies?.length ?? 0}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-gray-400">Richieste GA/Ads</dt>
                  <dd className="font-semibold text-gray-800">{activeScenario.gaAdsRequests?.length ?? 0}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {screenshotPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setScreenshotPreview(null)}
        >
          <div className="w-full max-w-4xl px-6" onClick={event => event.stopPropagation()}>
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl">
              <button
                type="button"
                className="absolute right-4 top-4 text-2xl leading-none text-gray-400 hover:text-gray-700"
                onClick={() => setScreenshotPreview(null)}
                aria-label="Chiudi anteprima"
              >
                ×
              </button>
              <img src={screenshotPreview} alt="Anteprima cookie banner" className="h-auto w-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedReport;
