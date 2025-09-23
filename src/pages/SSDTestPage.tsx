import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Play, Loader2, Eye, Tag, Code2, PackageSearch, Box, FileText, CheckCircle } from 'lucide-react';
import { TestSpec, SSDTestState } from '../types/ssd';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useSSDConfig } from '../hooks/useSSDConfig';
import { useAbortController } from '../hooks/useAbortController';
import { notifyError } from '../utils/errorNotification';
import toast from 'react-hot-toast';
import UploadStep from '../components/ssd/UploadStep';
import ReviewStep from '../components/ssd/ReviewStep';
import ResultsStep from '../components/ssd/ResultsStep';
import LoadingOverlay from '../components/ssd/LoadingOverlay';

/*─────────────────────────── type-writer hook ───────────────────────────*/
function useCyclingTypewriter(
  texts: string[],
  speed = 70,
  hold  = 3000,
): { text: string; step: number } {
  const [step, setStep]       = useState(0);        // frase corrente
  const [sub,  setSub]        = useState(0);        // indice carattere
  const [text, setText]       = useState("");

  useEffect(() => {
    // Controlla che texts sia valido e non vuoto
    if (!texts || texts.length === 0) {
      setText("");
      return;
    }

    let t: NodeJS.Timeout;

    /* fase di typing -----------------------------------------------------*/
    if (sub < texts[step]?.length) {
      setText(texts[step].slice(0, sub + 1));
      t = setTimeout(() => setSub(sub + 1), speed);
      return () => clearTimeout(t);
    }

    /* fase di pausa ------------------------------------------------------*/
    t = setTimeout(() => {
      setSub(0);
      setStep((s) => (s + 1) % texts.length);
    }, hold);
    return () => clearTimeout(t);
  }, [sub, step, texts, speed, hold]);

  return { text, step };
}

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

  // API base URL configuration
  const apiBaseUrl = import.meta.env.VITE_API_BASE || (window.location.origin === 'http://localhost:5173' ? 'http://localhost:4000' : '');
  
  // SSD Configuration
  const { config: ssdConfig, loading: configLoading, error: configError } = useSSDConfig(apiBaseUrl);

  // Loading steps for different operations
  const pdfSteps = [
    { label: "Download HTML e estrazione cookie banner…", icon: Eye },
    { label: "Caricamento PDF in corso…",   icon: FileText },
    { label: "Analisi del documento…",      icon: Tag },
    { label: "Estrazione delle specifiche…", icon: Code2 },
    { label: "Generazione DSL…",            icon: PackageSearch },
    { label: "Preparazione test…",          icon: Box },
  ];

  const testSteps = [
    { label: "Avvio browser…",              icon: Play },
    { label: "Navigazione al sito…",        icon: Eye },
    { label: "Esecuzione test…",            icon: CheckCircle },
    { label: "Raccolta evidenze…",          icon: PackageSearch },
    { label: "Generazione report…",         icon: FileText },
  ];

  const currentSteps = loadingType === 'pdf' ? pdfSteps : testSteps;
  const stepLabels = currentSteps && currentSteps.length > 0 ? currentSteps.map((s) => s.label) : ['Loading...'];
  const { text: typing, step } = useCyclingTypewriter(
    stepLabels,
    70,   // ms/carattere
    3000, // pausa
  );

  const CurrentIcon =
    currentSteps && currentSteps[step] && typeof currentSteps[step].icon === "function" ? currentSteps[step].icon : Loader2;

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
    
    let s = input.trim();
    
    // Add https:// if no protocol is provided
    if (!/^https?:\/\//i.test(s)) {
      s = "https://" + s;
    }
    
    try {
      const url = new URL(s);
      return url.origin; // Return normalized origin
    } catch {
      return input; // Return original if invalid
    }
  };

  const handleIngest = async () => {
    if (!state.url || !state.pdfFile) {
      toast.error('Please provide both URL and PDF file');
      return;
    }

    setLoadingType('pdf');
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Crea nuovo AbortController per questa richiesta
    const abortController = createNewController();

    try {
      // Normalize URL before sending
      const normalizedUrl = normalizeUrl(state.url);
      
      // STEP 1: Scarica HTML e estrai cookie banner
      console.log('Step 1: Fetching HTML and extracting cookie banner...');
      toast.loading('Downloading HTML and extracting cookie banner...', { id: 'html-fetch' });
      
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
      toast.success('HTML downloaded and cookie banner extracted!', { id: 'html-fetch' });

      // STEP 2: Processa PDF e genera DSL
      console.log('Step 2: Processing PDF and generating DSL...');
      toast.loading('Processing PDF and generating DSL...', { id: 'pdf-process' });
      
      const formData = new FormData();
      formData.append('url', normalizedUrl);
      formData.append('pdf', state.pdfFile);

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
      
      // Use setTimeout to ensure state is updated
      setTimeout(() => {
        console.log('About to call handleRunTests with stored data...');
        handleRunTestsWithData(result.dsl, result.pdfContent, result.pdfBufferPath);
      }, 1000);
      setEditableDsl(JSON.stringify(result.dsl, null, 2));
      setLoadingType(null);

      toast.success('PDF processed successfully!', { id: 'pdf-process' });
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
      
      setState(prev => ({
        ...prev,
        report: result.report,
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
    
    // Update state with the provided data
    setState(prev => ({ 
      ...prev, 
      dsl: dsl,
      pdfContent: pdfContent,
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
          dsl: dsl,
          pdfContent: pdfContent,
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
      
      setState(prev => ({
        ...prev,
        report: result.report,
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
      report: null,
      isLoading: false,
      error: null,
    });
    setLoadingType(null);
    setEditableDsl('');
    setIsEditingDsl(false);
    setDslValidationError(null);
    setOriginalDsl(null);
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
    <div className="min-h-screen bg-gray-50 p-6">
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

        {/* Loading Overlay */}
        <LoadingOverlay
          isLoading={state.isLoading}
          loadingType={loadingType}
          typing={typing}
          CurrentIcon={CurrentIcon}
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
          <ResultsStep
            state={state}
            originalDsl={originalDsl}
            onReset={handleReset}
            onExportReport={handleExportReport}
            onRunTestsWithData={handleRunTestsWithData}
          />
        )}
      </div>
    </div>
  );
}

