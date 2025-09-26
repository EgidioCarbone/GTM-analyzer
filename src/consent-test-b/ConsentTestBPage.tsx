import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

interface ConsentTestOptions {
  timeoutSoftMs: number;
  timeoutHardMs: number;
  captureScreens: boolean;
  trace: boolean;
  region: string;
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
  };
  env: {
    userAgent: string;
    locale: string;
    region: string;
  };
}

interface ScenarioResult {
  latestConsent: {
    ad_user_data: string;
    ad_personalization: string;
    ad_storage: string;
    analytics_storage: string;
  };
  cookies: Array<{
    name: string;
    domain: string;
    expires: number;
  }>;
  gaAdsRequests: Array<{
    url: string;
    ts: number;
  }>;
  gtagCalls: any[];
  dataLayer: any[];
  artifacts: {
    screenshotPath?: string;
    tracePath?: string;
  };
}

export default function ConsentTestBPage() {
  const [url, setUrl] = useState('');
  const [options, setOptions] = useState<ConsentTestOptions>({
    timeoutSoftMs: 10000,
    timeoutHardMs: 25000,
    captureScreens: true,
    trace: false,
    region: 'EU'
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConsentTestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'reject' | 'accept'>('reject');

  const handleRunTest = async () => {
    if (!url) {
      toast.error('Inserisci un URL valido');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error('L\'URL deve iniziare con http:// o https://');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('http://localhost:4000/api/consent/audit-pw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          options
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Errore ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Fallback al testo dell'errore
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Validazione preliminare dei dati ricevuti
      if (!data.results || !data.results.reject || !data.results.accept) {
        throw new Error('Dati del test incompleti o corrotti');
      }
      
      setResult(data);
      toast.success('Test completato con successo!');
    } catch (error) {
      console.error('Errore durante il test:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      toast.error(`Errore: ${errorMessage}`, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setUrl('');
    setResult(null);
    setActiveTab('reject');
  };

  const getStatusIcon = (scenario: 'reject' | 'accept') => {
    if (!result) return null;
    
    const scenarioResult = result.results[scenario];
    const hasIssues = scenarioResult.cookies.length > 0 || scenarioResult.gaAdsRequests.length > 0;
    
    if (scenario === 'reject') {
      return hasIssues ? (
        <span className="text-red-500 text-lg">❌</span>
      ) : (
        <span className="text-green-500 text-lg">✅</span>
      );
    } else {
      return hasIssues ? (
        <span className="text-green-500 text-lg">✅</span>
      ) : (
        <span className="text-red-500 text-lg">❌</span>
      );
    }
  };

  const getStatusText = (scenario: 'reject' | 'accept') => {
    if (!result) return '';
    
    const scenarioResult = result.results[scenario];
    const hasIssues = scenarioResult.cookies.length > 0 || scenarioResult.gaAdsRequests.length > 0;
    
    if (scenario === 'reject') {
      return hasIssues ? 'FAIL - Cookie/richieste rilevate' : 'PASS - Nessun cookie/richiesta';
    } else {
      return hasIssues ? 'PASS - Cookie/richieste rilevate' : 'FAIL - Nessun cookie/richiesta';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Consent Test B - Playwright
          </h1>
          <p className="text-lg text-gray-600">
            Test di consenso GDPR/CCPA con browser separati per scenario Reject/Accept
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="space-y-6">
            {/* URL Input */}
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                URL del sito web *
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
            </div>

            {/* Advanced Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="timeoutSoft" className="block text-sm font-medium text-gray-700 mb-1">
                  Timeout Soft (ms)
                </label>
                <input
                  type="number"
                  id="timeoutSoft"
                  value={options.timeoutSoftMs}
                  onChange={(e) => setOptions(prev => ({ ...prev, timeoutSoftMs: parseInt(e.target.value) || 10000 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="timeoutHard" className="block text-sm font-medium text-gray-700 mb-1">
                  Timeout Hard (ms)
                </label>
                <input
                  type="number"
                  id="timeoutHard"
                  value={options.timeoutHardMs}
                  onChange={(e) => setOptions(prev => ({ ...prev, timeoutHardMs: parseInt(e.target.value) || 25000 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
                  Regione
                </label>
                <select
                  id="region"
                  value={options.region}
                  onChange={(e) => setOptions(prev => ({ ...prev, region: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="EU">EU</option>
                  <option value="US">US</option>
                  <option value="UK">UK</option>
                </select>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.captureScreens}
                  onChange={(e) => setOptions(prev => ({ ...prev, captureScreens: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={loading}
                />
                <span className="ml-2 text-sm text-gray-700">Cattura Screenshot</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.trace}
                  onChange={(e) => setOptions(prev => ({ ...prev, trace: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={loading}
                />
                <span className="ml-2 text-sm text-gray-700">Traccia Browser</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={handleRunTest}
                disabled={loading || !url}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="mr-2 animate-spin">⏳</span>
                    Eseguendo test...
                  </>
                ) : (
                  <>
                    <span className="mr-2">▶️</span>
                    Esegui test (Playwright)
                  </>
                )}
              </button>

              <button
                onClick={reset}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* Summary */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Risultati del Test</h2>
              
              <div className="flex items-center space-x-4 mb-4">
                <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                  result.summary.pass 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {result.summary.pass ? 'PASS' : 'FAIL'}
                </div>
                <div className="text-sm text-gray-600">
                  {result.generatedAt ? new Date(result.generatedAt).toLocaleString('it-IT') : ''}
                </div>
              </div>

              {result.summary.notes.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <h3 className="text-sm font-medium text-yellow-800 mb-2">Note:</h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {result.summary.notes.map((note, index) => (
                      <li key={index}>• {note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('reject')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'reject'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {getStatusIcon('reject')}
                    <span>Scenario REJECT</span>
                    <span className="text-xs text-gray-500">({getStatusText('reject')})</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('accept')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'accept'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {getStatusIcon('accept')}
                    <span>Scenario ACCEPT</span>
                    <span className="text-xs text-gray-500">({getStatusText('accept')})</span>
                  </div>
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab && result.results[activeTab] && (
              <ScenarioDetails 
                scenario={activeTab} 
                data={result.results[activeTab]} 
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Componente per i dettagli dello scenario
function ScenarioDetails({ scenario, data }: { scenario: 'reject' | 'accept', data: ScenarioResult }) {
  return (
    <div className="space-y-6">
      {/* Consent Mode v2 */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Google Consent Mode v2</h3>
        <div className="bg-gray-50 rounded-md p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-700">ad_user_data:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                data.latestConsent.ad_user_data === 'granted' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {data.latestConsent.ad_user_data}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">ad_personalization:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                data.latestConsent.ad_personalization === 'granted' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {data.latestConsent.ad_personalization}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">ad_storage:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                data.latestConsent.ad_storage === 'granted' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {data.latestConsent.ad_storage}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">analytics_storage:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                data.latestConsent.analytics_storage === 'granted' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {data.latestConsent.analytics_storage}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitive Cookies */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          Cookie Sensibili ({data.cookies.length})
        </h3>
        {data.cookies.length > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="space-y-2">
              {data.cookies.map((cookie, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-red-800">{cookie.name}</span>
                  <span className="text-red-600">{cookie.domain}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-800 text-sm">Nessun cookie sensibile rilevato</p>
          </div>
        )}
      </div>

      {/* GA/Ads Network Requests */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          Richieste GA/Ads ({data.gaAdsRequests.length})
        </h3>
        {data.gaAdsRequests.length > 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {data.gaAdsRequests.map((request, index) => (
                <div key={index} className="text-sm">
                  <div className="font-mono text-blue-800 break-all">{request.url}</div>
                  <div className="text-blue-600 text-xs">
                    {new Date(request.ts).toLocaleTimeString('it-IT')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-800 text-sm">Nessuna richiesta GA/Ads rilevata</p>
          </div>
        )}
      </div>

      {/* Artifacts */}
      {data.artifacts.screenshotPath && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Screenshot</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <a
              href={`http://localhost:4000/artifacts/${data.artifacts.screenshotPath.replace('./artifacts/', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Visualizza Screenshot
            </a>
          </div>
        </div>
      )}
    </div>
  );
}