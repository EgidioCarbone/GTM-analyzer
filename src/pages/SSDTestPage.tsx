import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Play, CheckCircle, XCircle, AlertTriangle, Eye, Download, RefreshCw, Loader2, Tag, ToggleLeft, Code2, PackageSearch, Box, Edit3, Save, RotateCcw } from 'lucide-react';
import { TestSpec, Ambiguity, TestReport, SSDTestState, DisambiguationItem } from '../types/ssd';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/Badge';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import animationData from '../assets/background-ai-loader.json';
import toast from 'react-hot-toast';

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
    report: null,
    isLoading: false,
    error: null,
  });

  const [loadingType, setLoadingType] = useState<'pdf' | 'test' | null>(null);
  const [editableDsl, setEditableDsl] = useState<string>('');
  const [isEditingDsl, setIsEditingDsl] = useState(false);
  const [dslValidationError, setDslValidationError] = useState<string | null>(null);
  const [originalDsl, setOriginalDsl] = useState<TestSpec | null>(null);

  // API base URL configuration
  const apiBaseUrl = import.meta.env.VITE_API_BASE || (window.location.origin === 'http://localhost:5173' ? 'http://localhost:4000' : '');

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

  // Step 1: Upload PDF and URL
  const handleFileUpload = useCallback((file: File) => {
    // Basic client-side check: file extension ends with .pdf (case-insensitive)
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }
    setState(prev => ({ ...prev, pdfFile: file }));
  }, []);

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

    try {
      // Normalize URL before sending
      const normalizedUrl = normalizeUrl(state.url);
      
      // STEP 1: Scarica HTML e estrai cookie banner
      console.log('Step 1: Fetching HTML and extracting cookie banner...');
      toast.loading('Downloading HTML and extracting cookie banner...', { id: 'html-fetch' });
      
      const htmlResponse = await fetch(`${apiBaseUrl}/api/ssd/fetch-html?url=${encodeURIComponent(normalizedUrl)}`, {
        method: 'GET',
        signal: AbortSignal.timeout(60000), // 1 minute timeout
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
        signal: AbortSignal.timeout(120000), // 2 minute timeout
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Show precise error messages based on status codes
        if (response.status === 400) {
          throw new Error(error.error || 'Invalid request');
        } else if (response.status === 413) {
          throw new Error(error.error || 'File too large');
        } else if (response.status === 415) {
          throw new Error(error.error || 'Invalid file type');
        } else if (response.status === 422) {
          throw new Error(error.error || 'Validation error');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(error.error || `Server error (${response.status})`);
        }
      }

      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        dsl: result.dsl,
        currentStep: 'review',
        isLoading: false,
      }));
      setOriginalDsl(result.dsl);
      setEditableDsl(JSON.stringify(result.dsl, null, 2));
      setLoadingType(null);

      toast.success('PDF processed successfully!', { id: 'pdf-process' });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      setLoadingType(null);
      toast.error('Failed to process PDF');
    }
  };

  // Step 2: Review (universal mode - no disambiguation needed)

  const handleRunTests = async () => {
    if (!state.dsl) return;

    setLoadingType('test');
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${apiBaseUrl}/api/ssd/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dsl: state.dsl,
          runOptions: {
            headless: true,
            consent: 'both',
          },
        }),
        signal: AbortSignal.timeout(300000), // 5 minute timeout
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 422) {
          throw new Error(`Test execution error: ${error.error}`);
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(error.error || `Server error (${response.status})`);
        }
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
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      setLoadingType(null);
      toast.error('Failed to run tests');
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
              { key: 'upload', label: 'Upload', icon: Upload },
              { key: 'review', label: 'Review', icon: Eye },
              { key: 'run', label: 'Run', icon: Play },
            ].map(({ key, label, icon: Icon }, index) => (
              <div key={key} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  state.currentStep === key
                    ? 'bg-blue-600 text-white'
                    : ['upload', 'review', 'run'].indexOf(state.currentStep) > index
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
                {index < 2 && (
                  <div className={`w-8 h-0.5 mx-4 ${
                    ['upload', 'review', 'run'].indexOf(state.currentStep) > index
                      ? 'bg-green-600'
                      : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Loading Overlay */}
        {state.isLoading && (
          <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-black flex items-center justify-center overflow-hidden">
            <div className="absolute -top-48 -left-48  w-[600px] h-[600px] bg-purple-400 opacity-30 blur-3xl rounded-full" />
            <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-pink-400   opacity-30 blur-3xl rounded-full" />

            <div className="relative flex flex-col items-center">
              <div className="w-[500px] max-w-[90%]">
                <Lottie animationData={animationData} loop autoplay />
                <div className="flex items-center justify-center gap-2 mt-4">
                  <CurrentIcon className="w-5 h-5 text-purple-600 shrink-0" />
                  <p className="text-gray-800 dark:text-white text-lg font-semibold min-h-[1.5rem]">
                    {typing || "Stiamo analizzando il tuo container…"}
                  </p>
                  <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {state.currentStep === 'upload' && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Upload PDF and Target URL</h2>
            
            <div className="space-y-6">
              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Website URL
                </label>
                <Input
                  type="url"
                  placeholder="https://fibra.aruba.it"
                  value={state.url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SSD PDF Document
                </label>
                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                  state.pdfFile 
                    ? 'border-green-400 bg-green-50' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}>
                  <FileText className={`w-16 h-16 mx-auto mb-4 ${
                    state.pdfFile ? 'text-green-500' : 'text-gray-400'
                  }`} />
                  <div className="space-y-3">
                    <p className={`text-sm font-medium ${
                      state.pdfFile ? 'text-green-700' : 'text-gray-600'
                    }`}>
                      {state.pdfFile ? state.pdfFile.name : 'Click to upload PDF or drag and drop'}
                    </p>
                    {state.pdfFile && (
                      <p className="text-xs text-green-600">
                        ✓ PDF ready for processing
                      </p>
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                    >
                      {state.pdfFile ? 'Change File' : 'Choose File'}
                    </label>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <XCircle className="w-5 h-5 text-red-400 mr-2" />
                    <p className="text-sm text-red-800">{state.error}</p>
                  </div>
                </div>
              )}


              {/* Action Button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleIngest}
                  disabled={!state.url || !state.pdfFile || state.isLoading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {state.isLoading ? (
                    <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5 mr-3" />
                  )}
                  {state.isLoading ? 'Processing PDF...' : 'Process PDF'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Review & Disambiguation */}
        {state.currentStep === 'review' && state.dsl && (
          <div className="space-y-6">
            {/* DSL Preview */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Test Specification Preview</h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Generated from PDF
                  </div>
                  {!isEditingDsl ? (
                    <Button
                      onClick={() => setIsEditingDsl(true)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Advanced: Edit JSON
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleSaveDsl}
                        disabled={!!dslValidationError}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </Button>
                      <Button
                        onClick={handleResetDsl}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {dslValidationError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center">
                    <XCircle className="w-5 h-5 text-red-400 mr-2" />
                    <p className="text-sm text-red-800">{dslValidationError}</p>
                  </div>
                </div>
              )}
              
              {isEditingDsl ? (
                <div className="space-y-4">
                  <textarea
                    value={editableDsl}
                    onChange={(e) => handleDslEdit(e.target.value)}
                    className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Edit your DSL here..."
                  />
                  <div className="text-sm text-gray-600">
                    Edit the DSL above. Invalid JSON will be highlighted in red.
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg p-6 overflow-auto max-h-96 border">
                  <pre className="text-sm text-green-400 font-mono leading-relaxed">
                    {JSON.stringify(state.dsl, null, 2)}
                  </pre>
                </div>
              )}
              
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>Total tests: {state.dsl?.tests?.length || 0}</span>
                <span>Total steps: {state.dsl?.tests?.reduce((sum, test) => sum + test.steps.length, 0) || 0}</span>
              </div>
            </Card>

            {/* Generated by info */}
            <Card className="p-4 bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-4">
                  <span>Generated by: {state.dsl?.meta?.model || 'Unknown'}</span>
                  <span>Tokens: {state.dsl?.meta?.tokens?.input || 0} input, {state.dsl?.meta?.tokens?.output || 0} output</span>
                </div>
                <div className="text-xs text-gray-500">
                  Universal mode - executes exactly what the LLM returns
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-between items-center gap-4">
              <Button 
                onClick={handleReset} 
                variant="outline"
                className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
              >
                <RefreshCw className="w-4 h-4" />
                Start Over
              </Button>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Ready to execute the generated test specification?
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  The runner will execute exactly what the LLM generated - no hidden modifications
                </p>
                <Button
                  onClick={handleRunTests}
                  disabled={state.isLoading || !!dslValidationError}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {state.isLoading ? (
                    <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 mr-3" />
                  )}
                  {state.isLoading ? 'Running Tests...' : 'Run Tests'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {state.currentStep === 'run' && state.report && (
          <div className="space-y-6">
            {/* Summary */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Test Results Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{state.report.summary.steps}</div>
                  <div className="text-sm text-gray-600">Total Steps</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{state.report.summary.passed}</div>
                  <div className="text-sm text-gray-600">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{state.report.summary.failed}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(state.report.summary.duration / 1000)}s
                  </div>
                  <div className="text-sm text-gray-600">Duration</div>
                </div>
              </div>
            </Card>

            {/* Detailed Results */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Detailed Results</h2>
              <div className="space-y-4">
                {state.report.results.map((result, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      result.status === 'PASS'
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        {result.status === 'PASS' ? (
                          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 mr-2" />
                        )}
                        <span className="font-medium">{result.section}</span>
                        <Badge
                          variant={result.status === 'PASS' ? 'success' : 'error'}
                          className="ml-2"
                        >
                          {result.status}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-600">
                        {result.timings.duration}ms
                      </span>
                    </div>
                    
                    {result.description && (
                      <p className="text-sm text-gray-700 mb-2">{result.description}</p>
                    )}
                    
                    {result.reasons && result.reasons.length > 0 && (
                      <div className="text-sm text-red-700">
                        <p className="font-medium">Reasons:</p>
                        <ul className="list-disc list-inside">
                          {result.reasons.map((reason, reasonIndex) => (
                            <li key={reasonIndex}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Evidence */}
                    <div className="mt-3 space-y-3">
                      {result.evidence.dataLayerEvents.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">DataLayer Events:</p>
                          <div className="bg-gray-100 rounded p-3 text-xs font-mono max-h-32 overflow-y-auto">
                            {result.evidence.dataLayerEvents.map((event, eventIndex) => (
                              <div key={eventIndex} className="mb-2 p-2 bg-white rounded border">
                                <div className="text-blue-600 font-semibold">
                                  {event.payload?.event || 'Unknown Event'}
                                </div>
                                <div className="text-gray-600 mt-1">
                                  {new Date(event.timestamp).toLocaleTimeString()}
                                </div>
                                <div className="text-gray-800 mt-1">
                                  {JSON.stringify(event.payload, null, 2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {result.evidence.trackingHits.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Tracking Hits:</p>
                          <div className="bg-gray-100 rounded p-3 text-xs font-mono max-h-32 overflow-y-auto">
                            {result.evidence.trackingHits.map((hit, hitIndex) => (
                              <div key={hitIndex} className="mb-2 p-2 bg-white rounded border">
                                <div className="flex items-center justify-between">
                                  <span className="text-green-600 font-semibold">{hit.domain}</span>
                                  <span className="text-gray-500">{hit.method}</span>
                                </div>
                                <div className="text-gray-600 mt-1">
                                  {new Date(hit.timestamp).toLocaleTimeString()}
                                </div>
                                <div className="text-gray-800 mt-1 truncate">
                                  {hit.url}
                                </div>
                                {hit.status && (
                                  <div className={`text-xs mt-1 ${
                                    hit.status >= 200 && hit.status < 300 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    Status: {hit.status}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.evidence.screenshotPathOrB64 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Screenshot:</p>
                          <div className="mt-2">
                            <img
                              src={`data:image/png;base64,${result.evidence.screenshotPathOrB64}`}
                              alt={`Screenshot for ${result.section} step ${result.stepIndex}`}
                              className="max-w-full h-auto rounded border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => {
                                // Open screenshot in new tab
                                const newWindow = window.open();
                                if (newWindow) {
                                  newWindow.document.write(`
                                    <html>
                                      <head><title>Screenshot - ${result.section} Step ${result.stepIndex}</title></head>
                                      <body style="margin:0; padding:20px; background:#f5f5f5;">
                                        <img src="data:image/png;base64,${result.evidence.screenshotPathOrB64}" 
                                             style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 4px 8px rgba(0,0,0,0.1);" />
                                      </body>
                                    </html>
                                  `);
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 bg-gray-50 rounded-lg">
              <Button 
                onClick={handleReset} 
                variant="outline"
                className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Start Over
              </Button>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button 
                  onClick={handleExportReport} 
                  variant="outline"
                  className="flex items-center gap-2 px-6 py-3 border-2 border-blue-300 text-blue-700 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 w-full sm:w-auto"
                >
                  <Download className="w-4 h-4" />
                  Export Report
                </Button>
                <Button 
                  onClick={handleRunTests} 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 w-full sm:w-auto"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run Again
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

