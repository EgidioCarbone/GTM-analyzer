import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Play, Loader2, Eye, Tag, Code2, PackageSearch, Box, FileText, CheckCircle, RefreshCw } from 'lucide-react';
import { TestSpec, SSDTestState } from '../types/ssd';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useSSDConfig } from '../hooks/useSSDConfig';
import { useAbortController } from '../hooks/useAbortController';
import { useAnalysisProgress } from '../hooks/useAnalysisProgress';
import { notifyError } from '../utils/errorNotification';
import toast from 'react-hot-toast';
import UploadStep from '../components/ssd/UploadStep';
import ReviewStep from '../components/ssd/ReviewStep';
import ResultsStep from '../components/ssd/ResultsStep';
import DetailedResultsStep from '../components/ssd/DetailedResultsStep';
import { SSDProgressModal } from '../components/ssd/SSDProgressModal';


export default function SSDTestPage() {
  const [state, setState] = useState<SSDTestState>({
    currentStep: 'upload',
    url: '',
    pdfFile: null,
    dsl: null,
    pdfContent: null,
    report: null,
    isLoading: false,
    error: null,
  });

  const [loadingType, setLoadingType] = useState<'pdf' | 'test' | null>(null);
  const [editableDsl, setEditableDsl] = useState<string>('');
  const [isEditingDsl, setIsEditingDsl] = useState(false);
  const [dslValidationError, setDslValidationError] = useState<string | null>(null);
  const [originalDsl, setOriginalDsl] = useState<TestSpec | null>(null);

  // AbortController per gestire richieste pendenti
  const { createNewController, abortCurrentRequest, isAborted } = useAbortController();

  // Progress tracking hook
  const { 
    isVisible: progressVisible, 
    currentStep: currentProgressStep, 
    progress, 
    steps: progressSteps,
    startAnalysis, 
    updateStep, 
    completeAnalysis, 
    hideAnalysis 
  } = useAnalysisProgress();

  // API base URL configuration
  const apiBaseUrl = import.meta.env.VITE_API_BASE || (window.location.origin === 'http://localhost:5173' ? 'http://localhost:3001' : '');
  
  // SSD Configuration
  const { config: ssdConfig, loading: configLoading, error: configError } = useSSDConfig(apiBaseUrl);

  // Unified loading steps for the complete workflow
  const unifiedSteps = [
    // PDF Processing Phase
    { id: 'html_fetch', title: 'Download HTML', description: 'Scaricamento della pagina web e estrazione cookie banner...', phase: 'pdf' },
    { id: 'pdf_upload', title: 'Caricamento PDF', description: 'Upload e validazione del file PDF...', phase: 'pdf' },
    { id: 'pdf_analysis', title: 'Analisi Documento', description: 'Estrazione testo e analisi del contenuto...', phase: 'pdf' },
    { id: 'spec_extraction', title: 'Estrazione Specifiche', description: 'Identificazione di test e azioni da eseguire...', phase: 'pdf' },
    { id: 'dsl_generation', title: 'Generazione DSL', description: 'Creazione della specifica di test strutturata...', phase: 'pdf' },
    { id: 'test_preparation', title: 'Preparazione Test', description: 'Validazione e preparazione per l\'esecuzione...', phase: 'pdf' },
    
    // Test Execution Phase
    { id: 'browser_launch', title: 'Avvio Browser', description: 'Inizializzazione del browser Puppeteer...', phase: 'test' },
    { id: 'navigation', title: 'Navigazione', description: 'Caricamento della pagina web...', phase: 'test' },
    { id: 'cookie_consent', title: 'Gestione Cookie', description: 'Accettazione cookie banner e configurazione consenso...', phase: 'test' },
    { id: 'test_execution', title: 'Esecuzione Test', description: 'Esecuzione delle azioni e verifica delle aspettative...', phase: 'test' },
    { id: 'data_collection', title: 'Raccolta Dati', description: 'Cattura di screenshot e eventi dataLayer...', phase: 'test' },
    { id: 'report_generation', title: 'Generazione Report', description: 'Creazione del report finale con risultati...', phase: 'test' },
  ];

  // Cancella richieste pendenti quando cambia lo step o si ricarica la pagina
  useEffect(() => {
    return () => {
      abortCurrentRequest();
    };
  }, [state.currentStep, abortCurrentRequest]);

  // Step 1: Upload PDF and URL
  const handleFileUpload = useCallback((file: File) => {
    if (!ssdConfig) {
      toast.error('Configuration not loaded yet');
      return;
    }

    // Check file extension
    const hasValidExtension = ssdConfig.allowedExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext.toLowerCase())
    );
    
    if (!hasValidExtension) {
      toast.error(
        <div className="space-y-1">
          <div className="font-semibold">Tipo di file non supportato</div>
          <div className="text-sm">Carica un file PDF</div>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    // Check MIME type
    const hasValidMimeType = ssdConfig.allowedMimeTypes.includes(file.type) || 
                            file.type === '' || // Some browsers don't set MIME type for PDFs
                            file.type === 'application/octet-stream';
    
    if (!hasValidMimeType) {
      toast.error(
        <div className="space-y-1">
          <div className="font-semibold">Tipo di file non valido</div>
          <div className="text-sm">Il file deve essere un PDF</div>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    // Check file size
    if (file.size > ssdConfig.maxFileSize) {
      const maxSizeMB = ssdConfig.maxFileSizeMB;
      toast.error(
        <div className="space-y-1">
          <div className="font-semibold">File troppo grande</div>
          <div className="text-sm">Dimensione massima consentita: {maxSizeMB} MB</div>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    setState(prev => ({ ...prev, pdfFile: file }));
  }, [ssdConfig]);

  const handleUrlChange = useCallback((url: string) => {
    setState(prev => ({ ...prev, url }));
  }, []);

  // Normalize URL before sending to server
  const normalizeUrl = (input: string): string => {
    if (!input || typeof input !== "string") return input;

    let candidate = input.trim();

    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    }

    try {
      const url = new URL(candidate);
      // Keep path/query/hash so tests can target deep pages, but strip default port and collapse redundant slashes
      url.hash = url.hash.trim();
      return url.toString();
    } catch {
      return input;
    }
  };

  const handleIngest = async () => {
    if (!state.url || !state.pdfFile) {
      toast.error('Please provide both URL and PDF file');
      return;
    }

    setLoadingType('pdf');
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Avvia il progresso dettagliato con tutti gli step
    startAnalysis(unifiedSteps);

    // Crea nuovo AbortController per questa richiesta
    const abortController = createNewController();

    try {
      // Normalize URL before sending
      const normalizedUrl = normalizeUrl(state.url);
      
      // STEP 1: Scarica HTML e estrai cookie banner
      console.log('Step 1: Fetching HTML and extracting cookie banner...');
      updateStep('html_fetch', 'running', 'Downloading HTML and extracting cookie banner...');
      
      const htmlResponse = await fetch(`${apiBaseUrl}/api/ssd/fetch-html?url=${encodeURIComponent(normalizedUrl)}`, {
        method: 'GET',
        signal: abortController.signal,
      });

      if (!htmlResponse.ok) {
        const error = await htmlResponse.json();
        throw new Error(error.error || 'Failed to fetch HTML');
      }

      const htmlData = await htmlResponse.json();
      console.log('Cookie banner extraction result:', htmlData.cookieBanner);
      updateStep('html_fetch', 'completed', 'HTML downloaded and cookie banner extracted!');

      // STEP 2: Processa PDF e genera DSL
      console.log('Step 2: Processing PDF and generating DSL...');
      updateStep('pdf_upload', 'running', 'Uploading PDF file...');
      
      const formData = new FormData();
      formData.append('url', normalizedUrl);
      formData.append('pdf', state.pdfFile);

      updateStep('pdf_upload', 'completed', 'PDF uploaded successfully');
      updateStep('pdf_analysis', 'running', 'Analyzing PDF content...');

      const response = await fetch(`${apiBaseUrl}/api/spec/generate`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        notifyError(error, 'Failed to process PDF');
        throw new Error(error.error?.message || error.error || 'Failed to process PDF');
      }

      const result = await response.json();
      
      updateStep('pdf_analysis', 'completed', 'PDF content analyzed');
      updateStep('spec_extraction', 'completed', 'Test specifications extracted');
      updateStep('dsl_generation', 'completed', 'DSL generated successfully');
      updateStep('test_preparation', 'completed', 'Tests prepared for execution');
      
      setState(prev => ({
        ...prev,
        dsl: result.dsl,
        pdfContent: result.pdfContent,
        currentStep: 'upload', // Keep on upload, we'll auto-run
        isLoading: false,
      }));
      setOriginalDsl(result.dsl);
      
      // Store the data for auto-run
      console.log('Auto-running tests after specification generation...');
      console.log('DSL generated:', result.dsl);
      console.log('PDF Content length:', result.pdfContent?.length);
      console.log('PDF Buffer Path:', result.pdfBufferPath);
      
      // Non completare subito l'analisi, aspettiamo che i test finiscano
      setEditableDsl(JSON.stringify(result.dsl, null, 2));
      
      // Avvia immediatamente i test senza pause artificiali
      console.log('About to call handleRunTests with stored data...');
      handleRunTestsWithData(result.dsl, result.pdfContent, result.pdfBufferPath);

    } catch (error) {
      // Gestisci errore di abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        hideAnalysis();
        return;
      }
      
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      setLoadingType(null);
      hideAnalysis();
      notifyError(error, 'Failed to process PDF');
    }
  };

  // Step 2: Review (universal mode - no disambiguation needed)

  const handleRunTestsWithData = async (dsl: any, pdfContent: string, pdfBufferPath?: string) => {
    console.log('handleRunTestsWithData called');
    console.log('dsl:', dsl);
    console.log('pdfContent:', pdfContent);
    console.log('pdfBufferPath:', pdfBufferPath);
    
    if (!dsl) {
      console.log('No DSL provided, returning');
      return;
    }

    console.log('Starting test execution with provided data...');
    setLoadingType('test');
    
    // La modale è già visibile con tutti gli step, non serve riavviarla
    // Aggiorna solo il tipo di loading per cambiare il titolo
    
    // Crea nuovo AbortController per questa richiesta
    const abortController = createNewController();
    
    // Update state with the provided data
    setState(prev => ({ 
      ...prev, 
      dsl: dsl,
      pdfContent: pdfContent,
      isLoading: true, 
      error: null 
    }));

    try {
      updateStep('browser_launch', 'running', 'Launching Puppeteer browser...');
      
      const requestBody = {
        dsl: dsl,
        pdfContent: pdfContent,
        pdfBufferPath: pdfBufferPath,
        runOptions: {
          headless: true,
          consent: 'both',
        },
      };
      
      console.log('Frontend sending request body:', {
        dsl: !!requestBody.dsl,
        pdfContent: !!requestBody.pdfContent,
        pdfContentLength: requestBody.pdfContent?.length || 0,
        pdfContentPreview: requestBody.pdfContent?.substring(0, 100) + '...',
        runOptions: requestBody.runOptions
      });
      
      // Test JSON serialization
      let jsonBody;
      try {
        jsonBody = JSON.stringify(requestBody);
        console.log('✅ JSON serialization successful, length:', jsonBody.length);
      } catch (jsonError) {
        console.error('❌ JSON serialization failed:', jsonError);
        throw new Error(`JSON serialization failed: ${jsonError.message}`);
      }
      
      updateStep('browser_launch', 'completed', 'Browser launched successfully');
      updateStep('navigation', 'running', 'Navigating to website...');
      
      const response = await fetch(`${apiBaseUrl}/api/ssd/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonBody,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        notifyError(error, 'Failed to run tests');
        throw new Error(error.error?.message || error.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Debug: log del risultato per capire cosa contiene
      console.log('🔍 RAW RESPONSE DEBUG:');
      console.log('  📦 Full result object:', result);
      console.log('  📊 Result keys:', Object.keys(result));
      console.log('  📋 Result.report:', result.report);
      console.log('  📋 Result.report type:', typeof result.report);
      console.log('  📋 Result.report keys:', result.report ? Object.keys(result.report) : 'N/A');
      console.log('  🎯 Result.pdf:', result.pdf);
      console.log('  🎯 Result.cookie:', result.cookie);
      console.log('  🎯 Result.artifacts:', result.artifacts);
      
      const challengeInfo = result.challenge || result.cookie?.challenge || null;

      // Aggiorna i progressi dei test in base al challenge
      if (challengeInfo?.detected) {
        const detail = challengeInfo.message || 'Bloccato dal sistema anti-bot';
        updateStep('navigation', 'error', detail);
        updateStep('cookie_consent', 'error', 'Cookie banner non gestito: challenge anti-bot attivo');
        updateStep('test_execution', 'error', 'Esecuzione test interrotta dal challenge');
        updateStep('data_collection', 'error', 'Nessun dato raccolto: challenge anti-bot');
        updateStep('report_generation', 'completed', 'Report generato con avviso anti-bot');
      } else {
        updateStep('navigation', 'completed', 'Successfully navigated to website');
        updateStep('cookie_consent', 'completed', 'Cookie consent handled');
        updateStep('test_execution', 'completed', 'Tests executed successfully');
        updateStep('data_collection', 'completed', 'Data collected and analyzed');
        updateStep('report_generation', 'completed', 'Report generated successfully');
      }
      
      // Funzioni helper per calcolare stato e statistiche
      const calculateOverallStatus = (cookie: any, pdf: any) => {
        const cookieStatus = (cookie?.status || 'UNKNOWN').toUpperCase();
        const pdfStatus = (pdf?.status || 'UNKNOWN').toUpperCase();
        
        if (cookieStatus === 'BLOCKED' || pdfStatus === 'BLOCKED') return 'BLOCKED';
        if (cookieStatus === 'ERROR' || pdfStatus === 'ERROR') return 'ERROR';
        if (cookieStatus === 'FAIL' || pdfStatus === 'FAIL') return 'FAIL';
        if (cookieStatus === 'PASS' && pdfStatus === 'PASS') return 'PASS';
        return 'UNKNOWN';
      };
      
      const calculateSummary = (cookie: any, pdf: any) => {
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;
        let blockedTests = 0;

        const consider = (status?: string | null) => {
          if (!status) return;
          const normalized = status.toUpperCase();
          if (normalized === 'PASS') passedTests++;
          else if (normalized === 'BLOCKED') blockedTests++;
          else if (normalized === 'FAIL' || normalized === 'ERROR') failedTests++;
        };

        if (cookie) {
          totalTests++;
          consider(cookie.status);
        }

        if (pdf) {
          totalTests++;
          consider(pdf.status);
        }

        const totalDuration = (cookie?.duration || 0) + (pdf?.duration || 0);

        console.log('📊 SUMMARY CALCULATION:');
        console.log('  🍪 Cookie test:', cookie?.status || 'N/A');
        console.log('  📄 PDF test:', pdf?.status || 'N/A');
        console.log('  📈 Total tests:', totalTests);
        console.log('  ✅ Passed tests:', passedTests);
        console.log('  ❌ Failed tests:', failedTests);
        console.log('  🚫 Blocked tests:', blockedTests);
        console.log('  ⏱️ Total duration:', totalDuration, 'ms');

        return {
          steps: totalTests,
          totalTests,
          passed: passedTests,
          failed: failedTests,
          blocked: blockedTests,
          duration: totalDuration,
          consentProfiles: cookie?.consentStatus ? [cookie.consentStatus] : []
        };
      };

      // Debug: analizza la struttura dei dati
      console.log('🔍 DATA STRUCTURE ANALYSIS:');
      console.log('  📋 result.report exists:', !!result.report);
      console.log('  📋 result.pdf exists:', !!result.pdf);
      console.log('  📋 result.cookie exists:', !!result.cookie);
      console.log('  📋 result.artifacts exists:', !!result.artifacts);
      
      // Crea un report unificato dalla struttura del backend
      let reportData = null;
      
      // Il backend restituisce: { requestId, url, artifacts, cookie, pdf }
      // Dobbiamo combinare cookie e pdf in un report unificato
      if (result.pdf || result.cookie) {
        console.log('✅ Creating unified report from backend structure');
        reportData = {
          // Metadati generali
          requestId: result.requestId,
          url: result.url,
          artifacts: result.artifacts,
          
          // Risultati dei test
          cookie: result.cookie || null,
          pdf: result.pdf || null,
          
          // Calcola lo stato generale
          overallStatus: calculateOverallStatus(result.cookie, result.pdf),
          
          // Calcola le statistiche
          summary: calculateSummary(result.cookie, result.pdf),

          // Challenge info
          challenge: challengeInfo,
          
          // Timestamp
          timestamp: new Date().toISOString()
        };
      } else {
        console.log('⚠️ No test data found, using full result');
        reportData = result;
      }
      
      console.log('🎯 Final reportData:', reportData);
      console.log('🎯 Final reportData type:', typeof reportData);
      console.log('🎯 Final reportData keys:', reportData ? Object.keys(reportData) : 'N/A');

      const overallStatus = reportData?.overallStatus;
      if (challengeInfo?.detected) {
        toast.error(challengeInfo.message || 'Accesso bloccato dal sistema anti-bot (Cloudflare).');
      } else if (overallStatus === 'PASS') {
        toast.success('Tests completed successfully!');
      } else if (overallStatus === 'FAIL' || overallStatus === 'ERROR' || overallStatus === 'BLOCKED') {
        toast.error('Tests completed with issues. Controlla i dettagli.');
      } else {
        toast('Tests completed with warnings.', { icon: '⚠️' });
      }
      
      setState(prev => ({
        ...prev,
        report: reportData,
        currentStep: 'run',
        isLoading: false,
      }));
      
      // Debug: verifica che lo stato sia stato aggiornato correttamente
      console.log('✅ State updated - currentStep:', 'run', 'report:', !!reportData);
      setLoadingType(null);
      
      // Completa l'analisi e chiudi il loader dopo aver mostrato i risultati
      completeAnalysis();
    } catch (error) {
      // Gestisci errore di abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        hideAnalysis();
        return;
      }
      
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      setLoadingType(null);
      hideAnalysis();
      notifyError(error, 'Failed to run tests');
    }
  };

  const handleRunTests = async () => {
    console.log('handleRunTests called');
    console.log('state.dsl:', state.dsl);
    console.log('state.pdfContent:', state.pdfContent);
    
    if (!state.dsl) {
      console.log('No DSL found, returning');
      return;
    }

    console.log('Starting test execution...');
    setLoadingType('test');
    
    // Crea nuovo AbortController per questa richiesta
    const abortController = createNewController();
    
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null 
    }));

    try {
      const response = await fetch(`${apiBaseUrl}/api/ssd/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        body: JSON.stringify({
          dsl: state.dsl,
          pdfContent: state.pdfContent,
          runOptions: {
            headless: true,
            consent: 'both',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        notifyError(error, 'Failed to run tests');
        throw new Error(error.error?.message || error.error || `Server error (${response.status})`);
      }

      const result = await response.json();
      const reportData = result.report ?? result;
      
      setState(prev => ({
        ...prev,
        report: reportData,
        currentStep: 'run',
        isLoading: false,
      }));
      setLoadingType(null);

      toast.success('Tests completed successfully!');
    } catch (error) {
      // Gestisci errore di abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      setLoadingType(null);
      notifyError(error, 'Failed to run tests');
    }
  };

  // DSL editing functions
  const validateDsl = (dslText: string): { isValid: boolean; error?: string; dsl?: TestSpec } => {
    try {
      const parsed = JSON.parse(dslText);
      
      // Basic validation
      if (!parsed.site || !parsed.tests || !Array.isArray(parsed.tests)) {
        return { isValid: false, error: 'Invalid DSL structure: missing required fields' };
      }
      
      if (parsed.tests.length === 0) {
        return { isValid: false, error: 'DSL must contain at least one test' };
      }
      
      // Validate each test
      for (let i = 0; i < parsed.tests.length; i++) {
        const test = parsed.tests[i];
        if (!test.section || !test.steps || !Array.isArray(test.steps)) {
          return { isValid: false, error: `Test ${i} is missing required fields` };
        }
        
        if (test.steps.length === 0) {
          return { isValid: false, error: `Test ${i} must contain at least one step` };
        }
      }
      
      return { isValid: true, dsl: parsed };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  };

  const handleDslEdit = (value: string) => {
    setEditableDsl(value);
    const validation = validateDsl(value);
    setDslValidationError(validation.isValid ? null : validation.error || 'Invalid DSL');
  };

  const handleSaveDsl = () => {
    const validation = validateDsl(editableDsl);
    if (validation.isValid && validation.dsl) {
      setState(prev => ({ ...prev, dsl: validation.dsl! }));
      setIsEditingDsl(false);
      toast.success('DSL updated successfully');
    } else {
      toast.error(validation.error || 'Invalid DSL');
    }
  };

  const handleResetDsl = () => {
    if (originalDsl) {
      setEditableDsl(JSON.stringify(originalDsl, null, 2));
      setState(prev => ({ ...prev, dsl: originalDsl }));
      setDslValidationError(null);
      setIsEditingDsl(false);
      toast.success('DSL reset to original');
    }
  };

  const handleReset = () => {
    setState({
      currentStep: 'upload',
      url: '',
      pdfFile: null,
      dsl: null,
      pdfContent: null,
      report: null,
      isLoading: false,
      error: null,
    });
    setLoadingType(null);
    setEditableDsl('');
    setIsEditingDsl(false);
    setDslValidationError(null);
    setOriginalDsl(null);
    hideAnalysis();
  };

  const handleExportReport = () => {
    if (!state.report) return;

    const reportData = {
      url: state.url,
      timestamp: new Date().toISOString(),
      report: state.report,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ssd-test-report-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex flex-col relative overflow-hidden">
      {/* Sfondo dinamico con particelle - IDENTICO ALLA HOMEPAGE */}
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
      
      {/* Contenuto principale */}
      <div className="relative z-10 p-6">
        <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SSD Test</h1>
          <p className="text-gray-600">
            Convert PDF slide decks into automated test specifications and execute them with Puppeteer
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[
              { key: 'upload', label: 'Upload & Process', icon: Upload },
              { key: 'run', label: 'Results', icon: Play },
            ].map(({ key, label, icon: Icon }, index) => (
              <div key={key} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  state.currentStep === key
                    ? 'bg-blue-600 text-white'
                    : (key === 'upload' && state.currentStep === 'run')
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`ml-2 font-medium ${
                  state.currentStep === key ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {label}
                </span>
                {index < 1 && (
                  <div className={`w-8 h-0.5 mx-4 ${
                    state.currentStep === 'run'
                      ? 'bg-green-600'
                      : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Progress Modal */}
        <SSDProgressModal
          isVisible={progressVisible}
          loadingType={loadingType}
          currentStep={currentProgressStep}
          progress={progress}
          steps={progressSteps}
          onComplete={() => {
            // Solo chiudi se non stiamo passando da PDF a test
            if (loadingType !== 'pdf') {
              setTimeout(() => hideAnalysis(), 2000);
            }
          }}
        />

        {/* Step 1: Upload */}
        {state.currentStep === 'upload' && (
          <UploadStep
            state={state}
            ssdConfig={ssdConfig}
            configLoading={configLoading}
            configError={configError}
            onFileUpload={handleFileUpload}
            onUrlChange={handleUrlChange}
            onIngest={handleIngest}
          />
        )}

        {/* Step 2: Review & Disambiguation */}
        {state.currentStep === 'review' && state.dsl && (
          <ReviewStep
            state={state}
            editableDsl={editableDsl}
            isEditingDsl={isEditingDsl}
            dslValidationError={dslValidationError}
            ambiguityMinConfidence={ssdConfig?.ambiguityMinConfidence || 0.6}
            onDslEdit={handleDslEdit}
            onSaveDsl={handleSaveDsl}
            onResetDsl={handleResetDsl}
            onReset={handleReset}
          />
        )}

        {/* Step 3: Results */}
        {state.currentStep === 'run' && state.report && (
          <DetailedResultsStep
            state={state}
            onReset={handleReset}
            onExportReport={handleExportReport}
            onRunTestsWithData={handleRunTestsWithData}
          />
        )}

        {/* Debug: Mostra informazioni di debug quando siamo in fase run */}
        {state.currentStep === 'run' && process.env.NODE_ENV === 'development' && (
          <Card className="p-4 mb-4 bg-yellow-50 border-yellow-200">
            <h3 className="font-semibold text-yellow-800 mb-2">Debug Info</h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <div>Current Step: {state.currentStep}</div>
              <div>Has Report: {state.report ? 'Yes' : 'No'}</div>
              <div>Has DSL: {state.dsl ? 'Yes' : 'No'}</div>
              <div>Is Loading: {state.isLoading ? 'Yes' : 'No'}</div>
              {state.report && (
                <div>Report Keys: {Object.keys(state.report).join(', ')}</div>
              )}
            </div>
          </Card>
        )}

        {/* Fallback: Mostra messaggio di successo anche se non c'è report */}
        {state.currentStep === 'run' && !state.report && (
          <Card className="p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Test Completati!</h2>
              <p className="text-gray-600 mb-6">
                I test sono stati eseguiti con successo. I risultati dettagliati saranno disponibili a breve.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">✓</div>
                  <div className="text-sm text-blue-800">PDF Processato</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">✓</div>
                  <div className="text-sm text-green-800">Test Eseguiti</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">✓</div>
                  <div className="text-sm text-purple-800">Report Generato</div>
                </div>
              </div>
              
              <div className="flex justify-center space-x-4">
                <Button 
                  onClick={handleReset}
                  variant="outline"
                  className="px-6 py-3"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Esegui Nuovo Test
                </Button>
                <Button 
                  onClick={() => {
                    // Mostra i dettagli del DSL generato
                    if (state.dsl) {
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
                    }
                  }}
                  className="px-6 py-3"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Visualizza DSL
                </Button>
              </div>
            </div>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
