import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, Loader2, Circle, Shield, Clock, Lock, Check, Globe, Megaphone, Cookie } from 'lucide-react';
import ConsentReportWrapper from './ConsentReportWrapper';
import { getApiBaseUrl } from '../utils/api-base';

interface ConsentTestOptions {
  timeoutSoftMs: number;
  timeoutHardMs: number;
  captureScreens: boolean;
  trace: boolean;
  region: 'EU' | 'US';
  onlyReject: boolean;
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
    functionality_storage: string;
    security_storage: string;
  };
  consentSource?: 'consentMode' | 'onetrust' | 'behavior' | 'unknown';
  activeGroups?: string[];
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
  artifacts: {
    screenshotPath?: string;
    screenshotDataUrl?: string;
    cookieBannerScreenshotPath?: string;
    tracePath?: string;
  };
  warnings?: string[];
  skipped?: boolean;
}


export default function ConsentTestBPage() {
  const [url, setUrl] = useState('');
  const [options] = useState<ConsentTestOptions>({
    timeoutSoftMs: 10000,
    timeoutHardMs: 25000,
    captureScreens: true,
    trace: false,
    region: 'EU',
    onlyReject: false
  });
  const [loading, setLoading] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsStatus, setStepsStatus] = useState<string[]>([]);
  const [result, setResult] = useState<ConsentTestResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>('reject');
  const [showTransition, setShowTransition] = useState(false);
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

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

      const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/consent/audit-pw` : '/api/consent/audit-pw';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          options,
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
      if (!data.results || !data.results.reject || (!data.results.accept && !options.onlyReject)) {
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


  const handleDownloadPdf = () => {
    if (!result) {
      toast.error('Nessun report da esportare');
      return;
    }

    const container = reportContainerRef.current;
    if (!container) {
      toast.error('Sezione report non disponibile');
      return;
    }

    const promise = (async () => {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const hostname = (() => {
        try {
          return new URL(result.url).hostname;
        } catch {
          return 'report';
        }
      })();

      const dateStr = new Date(result.generatedAt || Date.now()).toISOString().split('T')[0];
      pdf.save(`ai-sentinel-${hostname}-${dateStr}.pdf`);
    })();

    toast.promise(promise, {
      loading: 'Generazione PDF in corso...',
      success: 'PDF scaricato con successo',
      error: (err) => `Errore durante l\'esportazione: ${err instanceof Error ? err.message : 'Operazione fallita'}`
    });
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(168,85,247,0.12),_transparent_60%)]" />
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="absolute bottom-0 right-12 h-72 w-72 rounded-full bg-purple-200/50 blur-3xl" />
      </div>

      <main className="relative z-10 flex-1 px-4 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center space-y-12">
          {/* Mostra la schermata iniziale solo se non ci sono risultati */}
          {!result && (
            <>
              <header className="space-y-8 text-center">
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-lg shadow-indigo-300/60">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
                        AI Sentinel
                      </p>
                      <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
                        Audit cookie &amp; tracking con IA
                      </h1>
                    </div>
                  </div>
                  <p className="mx-auto max-w-3xl text-base text-slate-600 sm:text-lg">
                    Questa sezione avvia Playwright in due browser isolati (Reject ➜ Accept), intercetta banner CMP, misura il Google Consent Mode, fotografa la UI e archivia rete GA/Ads. Al termine ottieni un report unico per compliance, team marketing e stakeholder legali.
                  </p>
                </div>

                <div className="mx-auto grid w-full max-w-4xl gap-4 rounded-2xl border border-slate-200 bg-white/80 px-6 py-6 shadow-sm backdrop-blur md:grid-cols-3">
                  <div className="text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Engine
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      Playwright · Chromium headless
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Browser pulito per ciascuno scenario, con geolocalizzazione EU/US configurabile.
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pipeline
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      Detect → Interact → Convalida
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      LLM identifica il CMP, Playwright clicca, il sistema verifica dataLayer, cookie e network.
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ultimo aggiornamento
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {new Date().toLocaleDateString('it-IT')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Config e CMP matcher aggiornati automaticamente con ogni deploy.
                    </p>
                  </div>
                </div>
              </header>

              <section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleRunTest();
                  }}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur"
                >
                  <div className="absolute -right-24 -top-24 h-60 w-60 rounded-full bg-gradient-to-br from-blue-100 via-purple-100 to-transparent blur-3xl" />
                  <div className="relative space-y-6">
                    <div className="space-y-2 text-left">
                      <label htmlFor="url" className="text-sm font-semibold text-slate-700">
                        URL del sito da analizzare
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                          <Globe className="h-5 w-5" />
                        </div>
                        <input
                          type="url"
                          id="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://www.esempio.it"
                          className="w-full rounded-xl border border-slate-200 bg-white px-12 py-3 text-base text-slate-900 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-200/60 disabled:cursor-not-allowed disabled:bg-slate-100"
                          disabled={loading}
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Supportiamo domini pubblici in HTTPS con CMP compatibili. Lo scenario reject è obbligatorio; l&apos;accept viene simulato in sequenza.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Timeout
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          Soft {options.timeoutSoftMs / 1000}s · Hard {options.timeoutHardMs / 1000}s
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Output
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          Screenshot CMP, payload dataLayer, richieste GA/Ads
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-600">
                          <Lock className="h-4 w-4" />
                          GDPR-first
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-600">
                          <Check className="h-4 w-4" />
                          Dual scenario
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 font-medium text-purple-600">
                          <Megaphone className="h-4 w-4" />
                          Marketing signals
                        </span>
                      </div>
                      <button
                        type="submit"
                        disabled={loading || !url}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-400/50 transition-transform hover:-translate-y-0.5 hover:brightness-110 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-indigo-300/60 disabled:translate-y-0 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Test in corso...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 text-white" />
                            <span className="text-white">Avvia test consenso</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                <aside className="rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-200/50 backdrop-blur">
                  <h3 className="text-sm font-semibold text-slate-900">Cosa verifichiamo</h3>
                  <ul className="mt-4 space-y-4 text-sm text-slate-600">
                    <li className="flex items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Stato CMP e pulsanti critici</p>
                        <p className="text-xs text-slate-500">Rileviamo banner, iframe e fallback LLM per garantire l&apos;interazione.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                        <Cookie className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Cookie &amp; storage per categoria</p>
                        <p className="text-xs text-slate-500">Classifichiamo la consent string e i cookie bloccati/attivi per profilo.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-purple-500">
                        <Megaphone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Chiamate GA/Ads &amp; dataLayer</p>
                        <p className="text-xs text-slate-500">Monitoriamo richieste marketing e push dataLayer durante i due scenari.</p>
                      </div>
                    </li>
                  </ul>
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-xs text-slate-500">
                    Report esportabile in PDF con timeline, insight IA e screenshot ad alta risoluzione.
                  </div>
                </aside>
              </section>
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
                    setActiveTab('reject');
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  <span>Ripeti Test</span>
                </button>
                
                <button
                  onClick={handleDownloadPdf}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
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
              </div>
            </div>
            
            {/* Report completo - senza box, integrato nella pagina */}
            <div className="pr-32"> {/* Spazio per la sezione laterale */}
              <div ref={reportContainerRef}>
                <ConsentReportWrapper result={result} activeTab={activeTab} />
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
};
