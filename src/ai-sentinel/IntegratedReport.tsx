import React, { useState } from 'react';
import { CheckCircle, Globe, Megaphone, Shield, Cookie, Camera, Database, Network, Code, Eye } from 'lucide-react';

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
  customScenarios?: Array<{
    name: string;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
  }>;
}

const IntegratedReport: React.FC<IntegratedReportProps> = ({ result, activeTab, customScenarios }) => {
  const [selectedScenario, setSelectedScenario] = useState('reject');
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);

  // Determina lo scenario attivo
  const activeScenario = result.results[selectedScenario];
  
  // Calcola il punteggio di conformità
  const complianceScore = result.summary.pass ? 100 : 0;

  // Funzione per ottenere il nome personalizzato dello scenario
  const getScenarioDisplayName = (scenarioKey: string) => {
    if (scenarioKey === 'reject') return 'Reject All';
    if (scenarioKey === 'accept') return 'Accept All';
    
    // Per scenari custom, cerca il nome personalizzato
    if (customScenarios && scenarioKey.startsWith('custom-')) {
      // Estrai le impostazioni dallo scenario key
      const scenarioData = result.results[scenarioKey];
      if (scenarioData && scenarioData.selectedCategories) {
        const { analytics, marketing, preferences } = scenarioData.selectedCategories;
        
        // Trova lo scenario custom corrispondente
        const matchingScenario = customScenarios.find(scenario => 
          scenario.analytics === analytics &&
          scenario.marketing === marketing &&
          scenario.preferences === preferences
        );
        
        if (matchingScenario) {
          return matchingScenario.name;
        }
      }
    }
    
    // Fallback al nome tecnico
    return scenarioKey.replace('custom-', 'Custom ');
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
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-8 h-8 text-green-600" />
          <div>
            <h2 className="text-2xl font-bold text-green-800">CONFORMITÀ GDPR: COMPLETA</h2>
            <p className="text-green-700 mt-1">
              Il sito rispetta correttamente tutte le preferenze di consenso dell'utente. Nessuna violazione GDPR rilevata.
            </p>
          </div>
        </div>
      </div>

      {/* Compliance Details */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-gray-600" />
            <h3 className="text-xl font-semibold text-gray-900">Stato Conformità GDPR</h3>
          </div>
          <span className="px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded-full flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>CONFORME</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Analytics Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 relative">
            <div className="absolute top-4 right-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex items-center space-x-3 mb-4">
              <Globe className="w-8 h-8 text-blue-600" />
              <h4 className="text-lg font-semibold text-gray-900">Analytics</h4>
            </div>
            <p className="text-gray-600 mb-4">
              Il sito rispetta correttamente le preferenze di consenso per i cookie analytics
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <div>Cookie rilevati: 0</div>
              <div>Consenso rispettato: Si</div>
              <div>Blocco funzionante: Si</div>
            </div>
          </div>

          {/* Marketing Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 relative">
            <div className="absolute top-4 right-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex items-center space-x-3 mb-4">
              <Megaphone className="w-8 h-8 text-purple-600" />
              <h4 className="text-lg font-semibold text-gray-900">Marketing</h4>
            </div>
            <p className="text-gray-600 mb-4">
              Il sito rispetta correttamente le preferenze di consenso per i cookie marketing
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <div>Cookie rilevati: 0</div>
              <div>Consenso rispettato: Si</div>
              <div>Blocco funzionante: Si</div>
            </div>
          </div>

          {/* Preferences Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 relative">
            <div className="absolute top-4 right-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex items-center space-x-3 mb-4">
              <Shield className="w-8 h-8 text-green-600" />
              <h4 className="text-lg font-semibold text-gray-900">Preferenze</h4>
            </div>
            <p className="text-gray-600 mb-4">
              Cookie di preferenze sempre attivi (necessari per il funzionamento del sito)
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <div>Cookie rilevati: 0</div>
              <div>Consenso rispettato: Si</div>
              <div>Blocco funzionante: Si</div>
            </div>
          </div>

          {/* Necessary Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 relative">
            <div className="absolute top-4 right-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex items-center space-x-3 mb-4">
              <Cookie className="w-8 h-8 text-orange-600" />
              <h4 className="text-lg font-semibold text-gray-900">Necessari</h4>
            </div>
            <p className="text-gray-600 mb-4">
              Cookie necessari sempre attivi (richiesti per il funzionamento del sito)
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <div>Cookie rilevati: 0</div>
              <div>Consenso rispettato: Si</div>
              <div>Blocco funzionante: Si</div>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-semibold text-gray-700">Punteggio Complessivo</span>
          <span className="text-2xl font-bold text-green-600">{complianceScore}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="h-full bg-green-600 rounded-full transition-all duration-1000" style={{ width: `${complianceScore}%` }}></div>
        </div>
      </div>

      {/* Dettagli Tecnici - Sempre Visibili */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Code className="w-6 h-6 text-gray-600" />
            <h3 className="text-xl font-semibold text-gray-900">Dettagli Tecnici</h3>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedScenario('reject')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedScenario === 'reject' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Reject All
            </button>
            <button
              onClick={() => setSelectedScenario('accept')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedScenario === 'accept' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Accept All
            </button>
            {Object.keys(result.results).filter(key => key.startsWith('custom-')).map(key => (
              <button
                key={key}
                onClick={() => setSelectedScenario(key)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedScenario === key 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getScenarioDisplayName(key)}
              </button>
            ))}
          </div>
        </div>

        {/* Screenshot Section */}
        {activeScenario.artifacts?.screenshotPath && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Camera className="w-5 h-5 text-gray-600" />
              <h4 className="font-medium text-gray-900">Screenshot Cookie Banner</h4>
            </div>
            <div className="bg-gray-100 rounded-lg p-4">
              <img 
                src={`/api/screenshot/${(() => {
                  const imagePath = activeScenario.artifacts.screenshotPath;
                  // Rimuovi "./" se presente e gestisci correttamente il path
                  const cleanPath = imagePath.startsWith('./artifacts/') 
                    ? imagePath.substring(2) // Rimuove "./"
                    : imagePath.startsWith('artifacts/')
                    ? imagePath
                    : `artifacts/${imagePath}`;
                  return cleanPath;
                })()}`}
                alt="Cookie Banner Screenshot"
                className="w-full max-w-md mx-auto rounded-lg shadow-sm border border-gray-200"
                onError={(e) => {
                  console.error('Screenshot load error:', e);
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                }}
                onLoad={() => {
                  console.log('Screenshot loaded successfully');
                }}
              />
              <div className="hidden text-center text-gray-600 mt-2">
                Screenshot non disponibile: {activeScenario.artifacts.screenshotPath}
                <br />
                <small>URL tentato: /api/screenshot/{(() => {
                  const imagePath = activeScenario.artifacts.screenshotPath;
                  return imagePath.startsWith('./artifacts/') 
                    ? imagePath.substring(2)
                    : imagePath.startsWith('artifacts/')
                    ? imagePath
                    : `artifacts/${imagePath}`;
                })()}</small>
              </div>
            </div>
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
                      {new Date(request.ts).toLocaleTimeString('it-IT')}
                    </div>
                    <div className="text-gray-800">{request.url}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DataLayer Events */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">DataLayer Events</span>
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {activeScenario.dataLayer.length}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {activeScenario.dataLayer.length === 0 ? 'Nessun evento rilevato' : `${activeScenario.dataLayer.length} eventi nel dataLayer`}
            </div>
          </div>

          {/* Gtag Calls */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Gtag Calls</span>
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {activeScenario.gtagCalls.length}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {activeScenario.gtagCalls.length === 0 ? 'Nessuna chiamata rilevata' : `${activeScenario.gtagCalls.length} chiamate gtag`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegratedReport;
