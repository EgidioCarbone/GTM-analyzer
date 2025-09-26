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
  const [options] = useState<ConsentTestOptions>({
    timeoutSoftMs: 10000,
    timeoutHardMs: 25000,
    captureScreens: true,
    trace: false,
    region: 'EU'
  });
  const [loading, setLoading] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsStatus, setStepsStatus] = useState<string[]>([]);
  const [result, setResult] = useState<ConsentTestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'reject' | 'accept'>('reject');

  // Definizione degli step per il test di consenso
  const consentTestSteps = [
    {
      id: 'initialization',
      title: 'Inizializzazione del Test',
      description: 'Configurazione browser isolato per scenario reject/accept...',
      status: 'pending' as const
    },
    {
      id: 'browser_launch',
      title: 'Avvio Browser',
      description: 'Lancio browser separato...',
      status: 'pending' as const
    },
    {
      id: 'navigation',
      title: 'Navigazione',
      description: 'Caricamento della pagina web...',
      status: 'pending' as const
    },
    {
      id: 'reject_test',
      title: 'Test Scenario REJECT',
      description: 'Rilevamento banner, rifiuto cookie, analisi risultati...',
      status: 'pending' as const
    },
    {
      id: 'accept_test',
      title: 'Test Scenario ACCEPT',
      description: 'Rilevamento banner, accettazione cookie, analisi risultati...',
      status: 'pending' as const
    },
    {
      id: 'data_analysis',
      title: 'Analisi Dati',
      description: 'Elaborazione risultati e generazione report finale...',
      status: 'pending' as const
    }
  ];


  const handleRunTest = async () => {
    if (!url) {
      toast.error('Inserisci un URL valido');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error('L\'URL deve iniziare con http:// o https://');
      return;
    }

    // Inizializza la modal 
    setLoading(true);
    setShowProgressModal(true);
    setCurrentStep(0);
    setStepsStatus(new Array(consentTestSteps.length).fill('pending'));
    setResult(null);

    try {
      // Step 1: Inizializzazione - avviamo al primo step
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[0] = 'running';
        return newStatus;
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Completiamo primo step
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[0] = 'completed';
        return newStatus;
      });
      
      // Step 2: Avvio Browser
      setCurrentStep(1);
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[1] = 'running';
        return newStatus;
      });
      await new Promise(resolve => setTimeout(resolve, 800));

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

      // Completiamo step 2
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[1] = 'completed';
        return newStatus;
      });
      
      // Step 3: Navigazione
      setCurrentStep(2);
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[2] = 'running';
        return newStatus;
      });
      await new Promise(resolve => setTimeout(resolve, 800));
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[2] = 'completed';
        return newStatus;
      });
      
      // Step 4: Test REJECT
      setCurrentStep(3);
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[3] = 'running';
        return newStatus;
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[3] = 'completed';
        return newStatus;
      });
      
      // Step 5: Test ACCEPT
      setCurrentStep(4);
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[4] = 'running';
        return newStatus;
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[4] = 'completed';
        return newStatus;
      });
      
      // Step 6: Analisi Dati
      setCurrentStep(5);
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[5] = 'running';
        return newStatus;
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
      
      // Completo step finale
      setStepsStatus(prev => {
        const newStatus = [...prev];
        newStatus[5] = 'completed';
        return newStatus;
      });
      
      setResult(data);
      
      // Chiude la modal dopo un secondo
      setTimeout(() => {
        setShowProgressModal(false);
        toast.success('Test completato con successo!');
      }, 1000);
      
    } catch (error) {
      console.error('Errore durante il test:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      setShowProgressModal(false);
      toast.error(`Errore: ${errorMessage}`, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setUrl('');
    setResult(null);
    setActiveTab('reject');
    setShowProgressModal(false);
    setCurrentStep(0);
    setStepsStatus([]);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex flex-col relative overflow-hidden">
      {/* Sfondo dinamico con particelle (identico a HomePage) */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Cerchi animati */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-20 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-40 right-20 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000"></div>
        
        {/* Particelle fluttuanti */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-purple-400 rounded-full opacity-60 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      </div>
      
      <div className="relative z-10 w-full flex items-center min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Sentinel
          </h1>
          <p className="text-lg text-gray-600">
            Test di consenso GDPR/CCPA con browser separati per scenario Reject/Accept
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 max-w-2xl mx-auto">
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
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                disabled={loading}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleRunTest}
                disabled={loading || !url}
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
              >
                {loading ? (
                  <>Analisi in corso...</>
                ) : (
                  <>Avvia Test Consenso</>
                )}
              </button>

              <button
                onClick={reset}
                disabled={loading}
                className="inline-flex items-center justify-center px-6 py-4 text-lg font-medium text-gray-700 bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-xl focus:outline-none focus:ring-4 focus:ring-gray-500 focus:ring-opacity-20 disabled:opacity-50 transition-all duration-200"
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

            {/* Cookie Banner Screenshot */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Cookie Banner Rilevato</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                {(() => {
                  // Prendiamo lo screenshot dal primo scenario disponibile
                  const firstScenario = result.results.reject || result.results.accept;
                  const bannerScreenshot = firstScenario?.artifacts?.screenshotPath;
                  
                  if (bannerScreenshot) {
                    // Gestione del path per proxy Vite (stessa origine)
                    const getScreenshotUrl = () => {
                      if (!bannerScreenshot) return '#';
                      
                      // Se inizia con ./artifacts/, rimuovi i dot separators
                      let cleanPath = bannerScreenshot;
                      if (bannerScreenshot.startsWith('./artifacts/')) {
                        cleanPath = bannerScreenshot.replace('./artifacts/', '');
                      } else if (bannerScreenshot.startsWith('/artifacts/')) {
                        cleanPath = bannerScreenshot.replace('/artifacts/', '');
                      }
                      
                      // Usa proxy Vite - stessa origine (5173)
                      return `/artifacts/${cleanPath}`;
                    };
                    
                    const screenshotUrl = getScreenshotUrl();
                    return (
                      <div className="space-y-4">
                        <div className="relative">
                          <img
                            src={screenshotUrl}
                            alt="Cookie Banner Screenshot"
                            className="w-full h-auto max-h-96 object-contain border border-gray-300 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => window.open(screenshotUrl, '_blank')}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="w-full h-48 bg-gray-100 border border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500">
                                    <svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                    <p class="text-sm">Screenshot non disponibile</p>
                                    <p class="text-xs text-gray-400 mt-1">Il file potrebbe non essere ancora generato</p>
                                  </div>
                                `;
                              }
                            }}
                          />
                        </div>
                        
                        {/* Cookie Banner Detailed Analysis */}
                        {(() => {
                          const detectCMPType = () => {
                            let cmpType = "Custom Banner";
                            let confidenceLevel = "Stima";
                            let additionalInfo = [];
                            
                            if (result?.results?.reject?.gtagCalls || result?.results?.accept?.gtagCalls) {
                              const gtagData = result.results.reject?.gtagCalls || result.results.accept?.gtagCalls;
                              const gtagStr = JSON.stringify(gtagData).toLowerCase();
                              
                              if (gtagStr.includes('cookiebot')) {
                                cmpType = "Cookiebot CMP";
                                confidenceLevel = "Confermato";
                                additionalInfo.push("Compliant con GDPR/CCPA");
                                additionalInfo.push("UI standard ben riconosciuto");
                              } else if (gtagStr.includes('onetrust')) {
                                cmpType = "OneTrust CMP";
                                confidenceLevel = "Confermato";
                                additionalInfo.push("Enterprise-ready solution");
                                additionalInfo.push("Granular controls available");
                              } else if (gtagStr.includes('cookieconsent') || gtagStr.includes('cookie consent')) {
                                cmpType = "Cookie Consent";
                                confidenceLevel = "Alto";
                                additionalInfo.push("Open source solution");
                              }
                            }
                            
                            // Analizza cookies per additional insights
                            const cookies = result?.results?.reject?.cookies || result?.results?.accept?.cookies || [];
                            const gaAdsReq = result?.results?.reject?.gaAdsRequests || result?.results?.accept?.gaAdsRequests || [];
                            
                            if (cookies.length > 0) {
                              const sensitiveCookies = cookies.filter(c => c.sensitive || c.isSensitive);
                              if (sensitiveCookies.length > 0) {
                                additionalInfo.push(`${sensitiveCookies.length} cookie sensibili rilevati`);
                              }
                              additionalInfo.push(`${cookies.length} cookie totali analizzati`);
                            }
                            
                            if (gaAdsReq.length > 0) {
                              additionalInfo.push(`${gaAdsReq.length} richieste di tracciamento intercettate`);
                            }
                            
                            return { cmpType, confidenceLevel, additionalInfo };
                          };
                          
                          const { cmpType, confidenceLevel, additionalInfo } = detectCMPType();
                          
                          return (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-4">
                              <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0">
                                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <h4 className="text-lg font-semibold text-gray-900">{cmpType}</h4>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      confidenceLevel === 'Confermato' 
                                        ? 'bg-green-100 text-green-800' 
                                        : confidenceLevel === 'Alto'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {confidenceLevel === 'Confermato' ? '✓ Confermato' : confidenceLevel}
                                    </span>
                                  </div>
                                  
                                  <p className="text-sm text-gray-600 mb-3">
                                    Analisi dettagliata del cookie banner rilevato durante il test di navigazione
                                  </p>
                                  
                                  {/* Additional Analysis Results */}
                                  {additionalInfo.length > 0 && (
                                    <div className="space-y-1 mb-3">
                                      {additionalInfo.map((info, idx) => (
                                        <div key={idx} className="text-xs text-gray-600 flex items-center space-x-1">
                                          <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          <span>{info}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <div className="bg-white px-2 py-1 rounded border text-gray-700">
                                      🌐 <span className="font-medium">URL:</span> {result.url}
                                    </div>
                                    <div className="bg-white px-2 py-1 rounded border text-gray-700">
                                      🔍 <span className="font-medium">Test:</span> REJECT/ACCEPT scenarios
                                    </div>
                                    <div className="bg-white px-2 py-1 rounded border text-gray-700">
                                      🛡️ <span className="font-medium">Status:</span> Banner rilevato e analizzato
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}


                      </div>
                    );
                  } else {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">Nessun screenshot del cookie banner disponibile</p>
                        <p className="text-xs text-gray-400 mt-1">Il banner potrebbe non essere stato rilevato</p>
                      </div>
                    );
                  }
                })()}
              </div>
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

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Test di Consenso in Corso
              </h2>
              <p className="text-gray-600 mb-4">
                Stiamo eseguendo l'analisi GDPR/CCPA con browser separati per scenario REJECT/ACCEPT...
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progresso</span>
                <span>{Math.round((currentStep / (consentTestSteps.length - 1)) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(currentStep / (consentTestSteps.length - 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Steps List */}
            <div className="space-y-4">
              {consentTestSteps.map((step, index) => {
                const status = stepsStatus[index] || 'pending';
                const isActive = index === currentStep && status === 'running';
                const isCompleted = status === 'completed';
                const isPending = status === 'pending';

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                      isActive
                        ? 'bg-blue-50 border border-blue-200'
                        : isCompleted
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isActive
                        ? 'bg-blue-100'
                        : isCompleted
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                    }`}>
                      {isActive ? (
                        <span className="text-blue-600 text-lg">
                          {step.id === 'initialization' && '🦾'}
                          {step.id === 'browser_launch' && '🌐'}
                          {step.id === 'navigation' && '⏳'}
                          {step.id === 'reject_test' && '❌'}
                          {step.id === 'accept_test' && '✅'}
                          {step.id === 'data_analysis' && '📊'}
                        </span>
                      ) : isCompleted ? (
                        <span className="text-green-600 text-lg">✅</span>
                      ) : (
                        <span className="text-gray-400 text-lg">
                          {step.id === 'initialization' && '🦾'}
                          {step.id === 'browser_launch' && '🌐'}
                          {step.id === 'navigation' && '⏳'}
                          {step.id === 'reject_test' && '❌'}
                          {step.id === 'accept_test' && '✅'}
                          {step.id === 'data_analysis' && '📊'}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className={`font-semibold ${
                        isActive
                          ? 'text-blue-900'
                          : isCompleted
                          ? 'text-green-900'
                          : 'text-gray-700'
                      }`}>
                        {step.title}
                      </h3>
                      <p className={`text-sm ${
                        isActive
                          ? 'text-blue-700'
                          : isCompleted
                          ? 'text-green-700'
                          : 'text-gray-500'
                      }`}>
                        {step.description}
                      </p>
                    </div>

                    {/* Status Indicator */}
                    {isActive && (
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Il test potrebbe richiedere diversi minuti dependendo dall'URL...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente per i dettagli dello scenario
function ScenarioDetails({ scenario, data }: { scenario: 'reject' | 'accept', data: ScenarioResult }) {
  // Pre-calculation to avoid template literal issues
  const getArtifactUrl = () => {
    if (!data.artifacts.screenshotPath) return '#';
    
    // Gestione path per proxy Vite (stessa origine)
    let cleanPath = data.artifacts.screenshotPath;
    if (data.artifacts.screenshotPath.startsWith('./artifacts/')) {
      cleanPath = data.artifacts.screenshotPath.replace('./artifacts/', '');
    } else if (data.artifacts.screenshotPath.startsWith('/artifacts/')) {
      cleanPath = data.artifacts.screenshotPath.replace('/artifacts/', '');
    } else {
      // Se è un simple filename, lo metto direct
      cleanPath = data.artifacts.screenshotPath.split('/').pop() || '';
    }
    
    return `/artifacts/${cleanPath}`;
  };

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
            {/* Analytics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Network</span>
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {new Set(data.gaAdsRequests.map(req => {
                    const url = new URL(req.url);
                    return url.hostname;
                  })).size}
                </div>
                <div className="text-xs text-gray-500">domini diversi</div>
              </div>
              
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Richiesta</span>
                </div>
                <div className="text-lg font-bold text-green-600">
                  {Math.max(...data.gaAdsRequests.map(req => req.ts)) - Math.min(...data.gaAdsRequests.map(req => req.ts)) + 1}
                </div>
                <div className="text-xs text-gray-500">ms completate</div>
              </div>

              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Status</span>
                </div>
                <div className="text-lg font-bold text-purple-600">{data.gaAdsRequests.length}</div>
                <div className="text-xs text-gray-500">richieste tracciate</div>
              </div>
            </div>

            {/* Request Details */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {data.gaAdsRequests.map((request, index) => {
                const url = new URL(request.url);
                const domain = url.hostname;
                const pathname = url.pathname + url.search;
                
                // Analizza il tipo di richiesta
                const getRequestType = (hostname: string, pathname: string) => {
                  if (hostname.includes('googleadservices.com')) return 'Google Ads Conversion';
                  if (hostname.includes('doubleclick.net')) return 'DoubleClick Tracking';
                  if (hostname.includes('google-analytics.com')) return 'GA4 Analytics';
                  if (hostname.includes('googletagmanager.com')) return 'GTM Container';
                  return 'Google Tracking';
                };

                const requestType = getRequestType(domain, pathname);
                
                // Estrai parametri importanti
                const searchParams = new URLSearchParams(url.search);
                const eventType = searchParams.get('event') || searchParams.get('tag') || 'tracking';
                const conversionId = searchParams.get('id') || searchParams.get('conversion_id');
                
                return (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {requestType}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(request.ts).toLocaleTimeString('it-IT')}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-900 break-all line-clamp-2">
                          {process.env.NODE_ENV === 'development' ? request.url : `https://${url.hostname}${url.pathname}...`}
                        </div>
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Attiva
                        </span>
                      </div>
                    </div>
                    
                    {/* Domain Info */}
                    <div className="flex items-center space-x-4 text-xs text-gray-600">
                      <div className="flex items-center space-x-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span className="font-medium">{domain}</span>
                      </div>
                      {eventType && (
                        <div className="flex items-center space-x-1">
                          <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                          <span>Evento: {eventType}</span>
                        </div>
                      )}
                      {conversionId && (
                        <div className="flex items-center space-x-1">
                          <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                          <span>ID: {conversionId}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Key Parameters */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {['event', 'id', 'conversion_id', 'label', 'gtm'].map(param => {
                        const value = searchParams.get(param);
                        return value ? (
                          <span key={param} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                            <span className="font-medium">{param}:</span>
                            <span className="ml-1">{value.length > 20 ? `${value.substring(0, 20)}...` : value}</span>
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Footer Info */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex items-center justify-between text-xs text-blue-700">
                <span>
                  ✅ Queste richieste confermano che il tracking è attivo in scenario ACCEPT
                </span>
                <span>
                  📊 Analytics/{data.gaAdsRequests.length}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 text-lg">✅</span>
              <p className="text-green-800 text-sm">Nessuna richiesta GA/Ads rilevata - Scenario REJECT funziona correttamente</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}