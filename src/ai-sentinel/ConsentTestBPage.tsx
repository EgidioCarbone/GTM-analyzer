import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, Loader2, Circle, Shield, Clock, Lock, Check, Globe, Megaphone, Cookie } from 'lucide-react';
import ConsentReportWrapper from './ConsentReportWrapper';

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
    [key: string]: ScenarioResult; // Support for custom scenarios
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

interface CustomScenario {
  name: string;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
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
  const [activeTab, setActiveTab] = useState<string>('reject');
  const [customScenarios, setCustomScenarios] = useState<CustomScenario[]>([]);
  const [showCustomScenario, setShowCustomScenario] = useState(false);
  const [showTransition, setShowTransition] = useState(false);

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
          options,
          customScenarios: customScenarios.length > 0 ? customScenarios.map(scenario => 
            ({
              custom: {
                analytics: scenario.analytics,
                marketing: scenario.marketing,
                preferences: scenario.preferences
              }
            })
          ) : undefined
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
      
      // Attiva la transizione fluida
      setTimeout(() => {
        setShowTransition(true);
        toast.success('Test completato con successo!');
      }, 500);
      
      // Chiude la modal dopo la transizione
      setTimeout(() => {
        setShowProgressModal(false);
        setShowTransition(false);
      }, 1500);
      
    } catch (error) {
      console.error('Errore durante il test:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      setShowProgressModal(false);
      toast.error(`Errore: ${errorMessage}`, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const addCustomScenario = () => {
    const nameInput = document.getElementById('scenario-name') as HTMLInputElement;
    const analyticsInput = document.getElementById('analytics-enabled') as HTMLInputElement;
    const marketingInput = document.getElementById('marketing-enabled') as HTMLInputElement;
    const preferencesInput = document.getElementById('preferences-enabled') as HTMLInputElement;
    
    const name = nameInput.value;
    
    if (!name) {
      toast.error('Inserire un nome per lo scenario');
      return;
    }

    const newScenario: CustomScenario = {
      name,
      analytics: analyticsInput.checked,
      marketing: marketingInput.checked,
      preferences: preferencesInput.checked
    };

    setCustomScenarios(prev => [...prev, newScenario]);
    
    // Reset form
    nameInput.value = '';
    analyticsInput.checked = false;
    marketingInput.checked = false;
    preferencesInput.checked = false;
    
    toast.success('Scenario custom aggiunto');
  };

  const removeCustomScenario = (index: number) => {
    setCustomScenarios(prev => prev.filter((_, i) => i !== index));
    toast.success('Scenario custom rimosso');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 relative overflow-hidden flex flex-col">
      {/* Sfondo dinamico con particelle - stesso della HomePage */}
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

      {/* Main Content - Centrato verticalmente come HomePage */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto relative z-10">
        <div className="w-full">
          {/* Mostra la schermata iniziale solo se non ci sono risultati */}
          {!result && (
            <>
          {/* Header */}
          <div className="text-center mb-8">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent mb-4 drop-shadow-sm">
                  AI Sentinel
                </h1>
                <p className="text-lg text-gray-600 font-medium">
              Test automatico di conformità GDPR per la gestione del consenso cookie
            </p>
          </div>

        {/* Input Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 mb-8">
          <div className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                URL del sito da testare
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Custom Scenarios */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Scenari Custom</h3>
                <button
                  onClick={() => setShowCustomScenario(!showCustomScenario)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  {showCustomScenario ? 'Nascondi' : 'Aggiungi Scenario'}
                </button>
              </div>

              {showCustomScenario && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="scenario-name" className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Scenario
                      </label>
                      <input
                        type="text"
                        id="scenario-name"
                        placeholder="es. Solo Analytics"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          id="analytics-enabled"
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Analytics</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          id="marketing-enabled"
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Marketing</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          id="preferences-enabled"
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Preferenze</span>
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={addCustomScenario}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    Aggiungi Scenario
                  </button>
                </div>
              )}

              {customScenarios.length > 0 && (
                <div className="space-y-2">
                  {customScenarios.map((scenario, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div>
                        <span className="font-medium text-gray-900">{scenario.name}</span>
                        <div className="text-sm text-gray-600">
                          Analytics: {scenario.analytics ? 'ON' : 'OFF'}, 
                          Marketing: {scenario.marketing ? 'ON' : 'OFF'}, 
                          Preferences: {scenario.preferences ? 'ON' : 'OFF'}
                        </div>
                      </div>
                      <button
                        onClick={() => removeCustomScenario(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

                  <div className="flex justify-center">
            <button
              onClick={handleRunTest}
              disabled={loading || !url}
                      className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Test in corso...' : 'Avvia Test Consenso'}
            </button>
          </div>
        </div>
              </div>
            </>
          )}

        {/* Progress Modal with Smooth Transition */}
        {showProgressModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`bg-white rounded-xl shadow-2xl p-8 w-full mx-4 border border-gray-100 transition-all duration-1000 ease-in-out ${
              showTransition ? 'max-w-4xl' : 'max-w-md'
            }`}>
              
              {!showTransition ? (
                // Progress View
                <>
                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-4">
                      <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      AI Sentinel
                    </h3>
                    <p className="text-sm text-gray-600">
                      Analisi conformità GDPR in corso
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-700">Progresso</span>
                      <span className="text-sm text-gray-500">
                        {Math.round((stepsStatus.filter(s => s === 'completed').length / consentTestSteps.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-out"
                        style={{ 
                          width: `${(stepsStatus.filter(s => s === 'completed').length / consentTestSteps.length) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Steps */}
              <div className="space-y-3">
                {consentTestSteps.map((step, index) => (
                      <div key={step.id} className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {stepsStatus[index] === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : stepsStatus[index] === 'running' ? (
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${
                            stepsStatus[index] === 'completed' ? 'text-green-700' :
                            stepsStatus[index] === 'running' ? 'text-blue-700' :
                            'text-gray-500'
                          }`}>
                            {step.title}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>~60s</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Lock className="w-3 h-3" />
                        <span>Sicuro</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                // Transition to Results View
                <div className="animate-in fade-in duration-1000">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">GDPR Compliance Report</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {new URL(result?.url || '').hostname} • Test eseguito il {new Date().toLocaleDateString('it-IT')} alle ore {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                        Condividi
                      </button>
                      <button className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                        Invia Email
                      </button>
                      <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1">
                        <span>PDF</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Compliance Status Banner */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-3">
                      <Check className="w-6 h-6 text-green-600" />
                      <div>
                        <h3 className="text-lg font-semibold text-green-800">CONFORMITÀ GDPR: COMPLETA</h3>
                        <p className="text-sm text-green-700 mt-1">
                          Il sito rispetta correttamente tutte le preferenze di consenso dell'utente. Nessuna violazione GDPR rilevata.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Compliance Details */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-5 h-5 text-gray-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Stato Conformità GDPR</h3>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full flex items-center space-x-1">
                        <Check className="w-4 h-4" />
                        <span>CONFORME</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Analytics Card */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 relative">
                        <div className="absolute top-3 right-3">
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex items-center space-x-3 mb-3">
                          <Globe className="w-6 h-6 text-blue-600" />
                          <h4 className="font-medium text-gray-900">Analytics</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Il sito rispetta correttamente le preferenze di consenso per i cookie analytics
                        </p>
                        <div className="space-y-1 text-xs text-gray-500">
                          <div>Cookie rilevati: 0</div>
                          <div>Consenso rispettato: Si</div>
                          <div>Blocco funzionante: Si</div>
                        </div>
                      </div>

                      {/* Marketing Card */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 relative">
                        <div className="absolute top-3 right-3">
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex items-center space-x-3 mb-3">
                          <Megaphone className="w-6 h-6 text-purple-600" />
                          <h4 className="font-medium text-gray-900">Marketing</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Il sito rispetta correttamente le preferenze di consenso per i cookie marketing
                        </p>
                        <div className="space-y-1 text-xs text-gray-500">
                          <div>Cookie rilevati: 0</div>
                          <div>Consenso rispettato: Si</div>
                          <div>Blocco funzionante: Si</div>
                        </div>
                      </div>

                      {/* Preferences Card */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 relative">
                        <div className="absolute top-3 right-3">
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex items-center space-x-3 mb-3">
                          <Shield className="w-6 h-6 text-green-600" />
                          <h4 className="font-medium text-gray-900">Preferenze</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Cookie di preferenze sempre attivi (necessari per il funzionamento del sito)
                        </p>
                        <div className="space-y-1 text-xs text-gray-500">
                          <div>Cookie rilevati: 0</div>
                          <div>Consenso rispettato: Si</div>
                          <div>Blocco funzionante: Si</div>
                        </div>
                      </div>

                      {/* Necessary Card */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4 relative">
                        <div className="absolute top-3 right-3">
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex items-center space-x-3 mb-3">
                          <Cookie className="w-6 h-6 text-orange-600" />
                          <h4 className="font-medium text-gray-900">Necessari</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Cookie necessari sempre attivi (richiesti per il funzionamento del sito)
                        </p>
                        <div className="space-y-1 text-xs text-gray-500">
                          <div>Cookie rilevati: 0</div>
                          <div>Consenso rispettato: Si</div>
                          <div>Blocco funzionante: Si</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Overall Score */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Punteggio Complessivo</span>
                      <span className="text-sm font-semibold text-green-600">100%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="h-full bg-green-600 rounded-full w-full"></div>
                    </div>
                  </div>
              </div>
              )}
            </div>
          </div>
        )}

        {/* Results - Solo se non abbiamo la transizione fluida */}
        {result && !showProgressModal && !showTransition && (
          <div className="w-full relative">
            {/* Sezione fissa laterale */}
            <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-40">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4 space-y-3">
                <button
                  onClick={() => {
                    setResult(null);
                    setUrl('');
                    setCustomScenarios([]);
                    setActiveTab('reject');
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  <span>Ripeti Test</span>
                </button>
                
                <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <span>Scarica PDF</span>
                </button>
                
                <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  <span>Invia Email</span>
                </button>
                
                <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  <span>Impostazioni</span>
                </button>
              </div>
            </div>
            
            {/* Report completo - senza box, integrato nella pagina */}
            <div className="pr-32"> {/* Spazio per la sezione laterale */}
              <ConsentReportWrapper result={result} activeTab={activeTab} customScenarios={customScenarios} />
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
};