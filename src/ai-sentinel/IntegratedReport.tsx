import React, { useMemo, useState } from 'react';
import {
  CheckCircle,
  Globe,
  Megaphone,
  Shield,
  Cookie,
  Camera,
  Database,
  Network,
  Code,
  Eye,
  AlertTriangle,
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
  dataLayerSnapshot?: any[];
  llmTestResult?: boolean;
  llmServiceAvailable?: boolean;
  artifacts: {
    screenshotPath?: string;
    screenshotDataUrl?: string;
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

const IntegratedReport: React.FC<IntegratedReportProps> = ({ result, activeTab }) => {
  const [selectedScenario, setSelectedScenario] = useState('reject');
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  // Determina lo scenario attivo
  const activeScenario = result.results[selectedScenario];
  const screenshotArtifacts = useMemo(() => {
    const scenarios = Object.values(result.results);
    return scenarios.find(s => s.artifacts?.screenshotDataUrl || s.artifacts?.screenshotPath)?.artifacts;
  }, [result.results]);

  const scenarioSummaries: ScenarioSummary[] = useMemo(() => {
    const summaries: ScenarioSummary[] = [];

    const buildIssues = (label: string, cookies: number, requests: number, consentChecks: Array<{ cond: boolean; msg: string }>) => {
      const issues: string[] = [];
      if (cookies > 0) issues.push(`${cookies} cookie non necessari rilevati`);
      if (requests > 0) issues.push(`${requests} richieste GA/Ads intercettate`);
      consentChecks.forEach(({ cond, msg }) => { if (cond) issues.push(msg); });
      return issues;
    };

    const reject = result.results.reject;
    if (reject) {
      if (reject.skipped) {
        summaries.push({
          key: 'reject',
          name: 'Reject All',
          weight: 0,
          score: 100,
          status: 'PASS',
          issues: ['Scenario non eseguito (modalità onlyReject)'],
          cookies: 0,
          requests: 0
        });
      } else {
      const cookies = reject.cookies?.length || 0;
      const requests = reject.gaAdsRequests?.length || 0;
      
      // PRIORITÀ: Usa il risultato LLM se disponibile
      if (reject.llmTestResult !== undefined && reject.llmTestResult !== null) {
        // Usa il risultato LLM per determinare il punteggio
        const llmPassed = reject.llmTestResult;
        summaries.push({
          key: 'reject',
          name: 'Reject All',
          weight: 0.7,
          score: llmPassed ? 100 : 0,
          status: llmPassed ? 'PASS' : 'FAIL',
          issues: llmPassed ? [] : ['Test LLM: Consensi non rifiutati correttamente'],
          cookies,
          requests
        });
      } else {
        // Fallback alla logica vecchia se LLM non disponibile
        const consentValues = Object.values(reject.latestConsent || {});
        const consentIssues = consentValues.some(value => value === 'granted');
        const issues = buildIssues('Reject All', cookies, requests, [
          { cond: consentIssues, msg: 'Consent Mode riporta valori "granted" dopo il rifiuto' }
        ]);
        summaries.push({
          key: 'reject',
          name: 'Reject All',
          weight: 0.7,
          score: issues.length === 0 ? 100 : 0,
          status: issues.length === 0 ? 'PASS' : 'FAIL',
          issues,
          cookies,
          requests
        });
      }
    }
    }

    const accept = result.results.accept;
    if (accept) {
      if (accept.skipped) {
        summaries.push({
          key: 'accept',
          name: 'Accept All',
          weight: 0,
          score: 100,
          status: 'PASS',
          issues: ['Scenario non eseguito (modalità onlyReject)'],
          cookies: 0,
          requests: 0
        });
      } else {
      const cookies = accept.cookies?.length || 0;
      const requests = accept.gaAdsRequests?.length || 0;
      
      // PRIORITÀ: Usa il risultato LLM se disponibile
      if (accept.llmTestResult !== undefined && accept.llmTestResult !== null) {
        // Usa il risultato LLM per determinare il punteggio
        const llmPassed = accept.llmTestResult;
        summaries.push({
          key: 'accept',
          name: 'Accept All',
          weight: 0.1,
          score: llmPassed ? 100 : 0,
          status: llmPassed ? 'PASS' : 'FAIL',
          issues: llmPassed ? [] : ['Test LLM: Consensi non accettati correttamente'],
          cookies,
          requests
        });
      } else {
        // Fallback alla logica vecchia se LLM non disponibile
        const consentValues = Object.values(accept.latestConsent || {});
        const consentGranted = consentValues.some(value => value === 'granted');
        const issues: string[] = [];
        if (!consentGranted) {
          issues.push('Consent Mode non riporta valori "granted" dopo l\'accettazione');
        }
        if (requests === 0 && cookies === 0) {
          issues.push('Nessuna attività di tracciamento rilevata dopo l\'accettazione');
        }
        summaries.push({
          key: 'accept',
          name: 'Accept All',
          weight: 0.1,
          score: issues.length === 0 ? 100 : 40,
          status: issues.length === 0 ? 'PASS' : 'FAIL',
          issues,
          cookies,
          requests
        });
      }
    }
    }

    Object.entries(result.results)
      .filter(([key]) => key.startsWith('custom-'))
      .forEach(([key, scenarioData]) => {
        if (scenarioData.skipped) {
          summaries.push({
            key,
            name: key.replace('custom-', 'Custom '),
            weight: 0,
            score: 100,
            status: 'PASS',
            issues: ['Scenario non eseguito (modalità onlyReject)'],
            cookies: 0,
            requests: 0
          });
          return;
        }
        const cookies = scenarioData.cookies?.length || 0;
        const requests = scenarioData.gaAdsRequests?.length || 0;
        const issues = buildIssues(key, cookies, requests, []);
        summaries.push({
          key,
          name: key.replace('custom-', 'Custom '),
          weight: 0.2 / Math.max(1, Object.keys(result.results).filter(k => k.startsWith('custom-')).length),
          score: issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 40),
          status: issues.length === 0 ? 'PASS' : 'FAIL',
          issues,
          cookies,
          requests
        });
      });

    return summaries;
  }, [result.results]);

  const weightedScore = useMemo(() => {
    if (scenarioSummaries.length === 0) return 0;
    const totalWeight = scenarioSummaries.reduce((sum, scenario) => sum + scenario.weight, 0) || 1;
    return Math.round(
      scenarioSummaries.reduce((sum, scenario) => sum + scenario.score * scenario.weight, 0) / totalWeight
    );
  }, [scenarioSummaries]);

  const failingIssues = useMemo(() => (
    scenarioSummaries
      .filter(s => s.status === 'FAIL' && s.issues.length > 0)
      .map(s => ({ name: s.name, issues: s.issues }))
  ), [scenarioSummaries]);

  const acceptScenarioData = result.results.accept;

  const complianceStatus = useMemo(() => {
    if (weightedScore >= 80) {
      return {
        label: 'CONFORMITÀ ELEVATA',
        tone: 'success',
        description: 'Il sito rispetta correttamente le preferenze di consenso nelle condizioni testate.'
      };
    }
    if (weightedScore >= 60) {
      return {
        label: 'ATTENZIONE',
        tone: 'warning',
        description: 'Sono emerse aree di miglioramento: alcuni scenari richiedono verifica.'
      };
    }
    return {
      label: 'PROBLEMI CRITICI',
      tone: 'danger',
      description: 'Il sito non rispetta le preferenze di consenso nei casi fondamentali (es. rifiuto).' 
    };
  }, [weightedScore]);

  const toneIcon = complianceStatus.tone === 'success'
    ? CheckCircle
    : complianceStatus.tone === 'warning'
      ? AlertTriangle
      : XCircle;
  const ToneIcon = toneIcon;

  // Funzione per ottenere il nome personalizzato dello scenario
  const getScenarioDisplayName = (scenarioKey: string) => {
    if (scenarioKey === 'reject') return 'Reject All';
    if (scenarioKey === 'accept') return 'Accept All';
    
    // Scenari custom non più supportati
    if (scenarioKey.startsWith('custom-')) {
      return 'Custom Scenario (Non supportato)';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">GDPR Compliance Report</h1>
        <p className="text-gray-600">
          {new URL(result.url).hostname} • Test eseguito il {new Date(result.generatedAt).toLocaleDateString('it-IT')} alle ore {new Date(result.generatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Compliance Status Banner */}
      <div className={
        `rounded-lg p-6 border ${
          complianceStatus.tone === 'success'
            ? 'bg-green-50 border-green-200'
            : complianceStatus.tone === 'warning'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
        }`
      }>
        <div className="flex items-start space-x-3">
          <ToneIcon className={`w-8 h-8 ${
            complianceStatus.tone === 'success'
              ? 'text-green-600'
              : complianceStatus.tone === 'warning'
                ? 'text-yellow-600'
                : 'text-red-600'
          }`} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{complianceStatus.label}</h2>
            <p className="mt-1 text-gray-700">{complianceStatus.description}</p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                <span>Punteggio complessivo</span>
                <span>{weightedScore}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    weightedScore >= 80
                      ? 'bg-green-500'
                      : weightedScore >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${weightedScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        {failingIssues.length > 0 && (
          <div className="mt-4 bg-white/70 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            <h3 className="font-semibold mb-2">Motivi principali</h3>
            <ul className="space-y-2 list-disc pl-5">
              {failingIssues.map((item, idx) => (
                <li key={idx}>
                  <span className="font-medium">{item.name}</span>: {item.issues.join(' • ')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Compliance Details */}
      <div>
        <div className="flex items-center space-between justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-gray-600" />
            <h3 className="text-xl font-semibold text-gray-900">Dettaglio scenari</h3>
          </div>
          <span className="text-sm text-gray-500">Tab: {activeTab}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {scenarioSummaries.map(summary => (
            <div key={summary.key} className="bg-white border border-gray-200 rounded-lg p-6 relative">
              <div className="absolute top-4 right-4">
                {summary.status === 'PASS' ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div className="flex items-center space-x-3 mb-4">
                {summary.key === 'reject' && <Megaphone className="w-8 h-8 text-red-600" />}
                {summary.key === 'accept' && <Globe className="w-8 h-8 text-blue-600" />}
                {summary.key !== 'reject' && summary.key !== 'accept' && <Cookie className="w-8 h-8 text-purple-600" />}
                <h4 className="text-lg font-semibold text-gray-900">{summary.name}</h4>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Peso</span>
                <span>{Math.round(summary.weight * 100)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Punteggio scenario</span>
                <span className={summary.status === 'PASS' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {summary.score}%
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-gray-500">
                <div className="flex justify-between">
                  <span>Cookie rilevati</span>
                  <span>{summary.cookies}</span>
                </div>
                <div className="flex justify-between">
                  <span>Richieste GA/Ads</span>
                  <span>{summary.requests}</span>
                </div>
              </div>
              {summary.issues.length > 0 && (
                <ul className="mt-3 bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700 space-y-1">
                  {summary.issues.map((issue, idx) => (
                    <li key={idx}>• {issue}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-semibold text-gray-700">Punteggio Complessivo</span>
          <span className={`text-2xl font-bold ${
            weightedScore >= 80
              ? 'text-green-600'
              : weightedScore >= 60
                ? 'text-yellow-600'
                : 'text-red-600'
          }`}>{weightedScore}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              weightedScore >= 80
                ? 'bg-green-600'
                : weightedScore >= 60
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${weightedScore}%` }}
          />
        </div>
      </div>

      {/* Dettagli Tecnici - Sempre Visibili */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Code className="w-6 h-6 text-gray-600" />
            <h3 className="text-xl font-semibold text-gray-900">Dettagli Tecnici</h3>
          </div>
        </div>

        {/* Screenshot Section */}
        {screenshotArtifacts && (() => {
          const rawImage = screenshotArtifacts.screenshotDataUrl || screenshotArtifacts.screenshotPath || '';
          const screenshotUrl = resolveScreenshotUrl(rawImage, apiBaseUrl);
          const isDataUrl = rawImage.startsWith('data:');

          return (
            <div className="mb-6">
              <div className="flex items-center space-x-2 mb-3">
                <Camera className="w-5 h-5 text-gray-600" />
                <h4 className="font-medium text-gray-900">Screenshot Cookie Banner</h4>
              </div>
              <div className="bg-gray-100 rounded-lg p-4">
                <button
                  type="button"
                  onClick={() => setScreenshotPreview(screenshotUrl)}
                  className="w-full max-w-2xl mx-auto block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <img 
                    src={screenshotUrl}
                    alt="Cookie Banner Screenshot"
                    className="w-full rounded-lg shadow-sm border border-gray-200 hover:shadow-lg transition-shadow"
                    onError={(e) => {
                      console.error('Screenshot load error:', e);
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement?.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                </button>
                <div className="hidden text-center text-gray-600 mt-2">
                  Screenshot non disponibile: {rawImage}
                  {!isDataUrl && (
                    <>
                      <br />
                      <small>URL tentato: {screenshotUrl}</small>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Scenario Selector CTA */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button
            onClick={() => setSelectedScenario('reject')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedScenario === 'reject'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Reject All
          </button>
          {!acceptScenarioData?.skipped && (
            <button
              onClick={() => setSelectedScenario('accept')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedScenario === 'accept'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Accept All
            </button>
          )}
          {Object.entries(result.results)
            .filter(([key, scenario]) => key.startsWith('custom-') && !scenario.skipped)
            .map(([key]) => (
            <button
              key={key}
              onClick={() => setSelectedScenario(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedScenario === key
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getScenarioDisplayName(key)}
            </button>
          ))}
        </div>

        {activeScenario?.skipped && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
            Scenario "{getScenarioDisplayName(selectedScenario)}" non eseguito in questa sessione (modalità onlyReject attiva).
          </div>
        )}

        {/* Technical Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Consent Mode State */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Consent Mode State</span>
              </div>
              <Eye className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Analytics: {activeScenario.latestConsent.analytics_storage}</div>
              <div>Marketing: {activeScenario.latestConsent.ad_storage}</div>
              <div>Personalization: {activeScenario.latestConsent.ad_personalization}</div>
            </div>
          </div>

          {/* Cookie Rilevati */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Cookie Rilevati</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                  {activeScenario.cookies.length}
                </span>
                {activeScenario.cookies.length > 0 && (
                  <button
                    onClick={() => setExpandedDetails(expandedDetails === 'cookies' ? null : 'cookies')}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    {expandedDetails === 'cookies' ? 'Nascondi' : 'Dettagli'}
                  </button>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {activeScenario.cookies.length === 0 ? 'Nessun cookie rilevato' : `${activeScenario.cookies.length} cookie trovati`}
            </div>
            
            {/* Dettagli espandibili */}
            {expandedDetails === 'cookies' && activeScenario.cookies.length > 0 && (
              <div className="mt-3 space-y-2">
                {activeScenario.cookies.map((cookie, index) => (
                  <div key={index} className="bg-white rounded p-2 text-xs">
                    <div className="font-medium text-gray-800">{cookie.name}</div>
                    <div className="text-gray-500">Domain: {cookie.domain}</div>
                    <div className="text-gray-500">Expires: {cookie.expires ? new Date(cookie.expires * 1000).toLocaleDateString('it-IT') : 'Session'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Richieste di Rete */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Network className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Richieste di Rete</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                  {activeScenario.gaAdsRequests.length}
                </span>
                {activeScenario.gaAdsRequests.length > 0 && (
                  <button
                    onClick={() => setExpandedDetails(expandedDetails === 'requests' ? null : 'requests')}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    {expandedDetails === 'requests' ? 'Nascondi' : 'Dettagli'}
                  </button>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {activeScenario.gaAdsRequests.length === 0 ? 'Nessuna richiesta rilevata' : `${activeScenario.gaAdsRequests.length} richieste GA/Ads`}
            </div>
            
            {/* Dettagli espandibili */}
            {expandedDetails === 'requests' && activeScenario.gaAdsRequests.length > 0 && (
              <div className="mt-3 space-y-2">
                {activeScenario.gaAdsRequests.map((request, index) => (
                  <div key={index} className="bg-white rounded p-2 text-xs font-mono break-all">
                    <div className="text-gray-500 mb-1">
                      <span>{new Date(request.ts).toLocaleTimeString('it-IT')}</span>
                      {request.method && (
                        <span className="ml-2 uppercase text-gray-700">{request.method}</span>
                      )}
                    </div>
                    <div className="text-gray-800">{request.url}</div>
                    {request.frameUrl && (
                      <div className="text-gray-500 mt-1">Frame: {request.frameUrl}</div>
                    )}
                    {request.resourceType && (
                      <div className="text-gray-500">Tipo: {request.resourceType}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tracking Overview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Tracking Overview</span>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>DataLayer snapshot: {activeScenario.dataLayerSnapshot?.length ?? 0} elementi</div>
              <div>Eventi intercettati (live): {activeScenario.dataLayer.length}</div>
              <div>Chiamate gtag intercettate: {activeScenario.gtagCalls.length}</div>
            </div>
          </div>
        </div>

        {/* DataLayer Snapshot */}
        <div className="mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">DataLayer Snapshot</span>
              </div>
              <span className="text-xs text-gray-500">Scenario: {getScenarioDisplayName(selectedScenario)}</span>
            </div>
            {activeScenario.dataLayerSnapshot && activeScenario.dataLayerSnapshot.length > 0 ? (
              <pre className="bg-white p-3 rounded border text-xs overflow-x-auto max-h-72">
                {JSON.stringify(activeScenario.dataLayerSnapshot, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-gray-600">Nessun evento dataLayer registrato per questo scenario.</p>
            )}
          </div>
        </div>
      </div>

      {screenshotPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setScreenshotPreview(null)}
        >
          <div className="max-w-4xl w-full px-6" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-xl shadow-xl overflow-hidden relative">
              <button
                type="button"
                className="absolute top-3 right-3 text-2xl leading-none text-gray-500 hover:text-gray-800"
                onClick={() => setScreenshotPreview(null)}
                aria-label="Chiudi anteprima"
              >
                ×
              </button>
              <img src={screenshotPreview} alt="Anteprima cookie banner" className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedReport;
