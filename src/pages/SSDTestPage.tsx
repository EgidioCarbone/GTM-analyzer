import React, { useState, useCallback } from 'react';
import { Upload, FileText, Play, CheckCircle, XCircle, AlertTriangle, Eye, Download, RefreshCw } from 'lucide-react';
import { TestSpec, Ambiguity, TestReport, SSDTestState, DisambiguationItem } from '../types/ssd';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/Badge';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import toast from 'react-hot-toast';

export default function SSDTestPage() {
  const [state, setState] = useState<SSDTestState>({
    currentStep: 'upload',
    url: '',
    pdfFile: null,
    dsl: null,
    ambiguities: [],
    report: null,
    isLoading: false,
    error: null,
  });

  const [disambiguationItems, setDisambiguationItems] = useState<DisambiguationItem[]>([]);

  // Step 1: Upload PDF and URL
  const handleFileUpload = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    setState(prev => ({ ...prev, pdfFile: file }));
  }, []);

  const handleUrlChange = useCallback((url: string) => {
    setState(prev => ({ ...prev, url }));
  }, []);

  const handleIngest = async () => {
    if (!state.url || !state.pdfFile) {
      toast.error('Please provide both URL and PDF file');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const formData = new FormData();
      formData.append('url', state.url);
      formData.append('pdf', state.pdfFile);

      const response = await fetch('http://localhost:4000/api/ssd/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process PDF');
      }

      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        dsl: result.dsl,
        ambiguities: result.ambiguities,
        currentStep: 'review',
        isLoading: false,
      }));

      // Prepare disambiguation items
      const items: DisambiguationItem[] = result.ambiguities.map((ambiguity: Ambiguity) => {
        const [testIndex, stepIndex] = parseStepPath(ambiguity.stepPath);
        const step = result.dsl.tests[testIndex]?.steps[stepIndex];
        return {
          stepPath: ambiguity.stepPath,
          step,
          ambiguity,
          suggestedTargets: ambiguity.candidates || [],
        };
      });
      setDisambiguationItems(items);

      toast.success('PDF processed successfully!');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      toast.error('Failed to process PDF');
    }
  };

  // Step 2: Review and Disambiguation
  const handleDisambiguationFix = (stepPath: string, newTarget: any) => {
    if (!state.dsl) return;

    const [testIndex, stepIndex] = parseStepPath(stepPath);
    const updatedDsl = { ...state.dsl };
    updatedDsl.tests[testIndex].steps[stepIndex].target = newTarget;
    updatedDsl.tests[testIndex].steps[stepIndex].confidence = 0.9; // Mark as fixed

    setState(prev => ({ ...prev, dsl: updatedDsl }));

    // Remove from disambiguation items
    setDisambiguationItems(prev => 
      prev.filter(item => item.stepPath !== stepPath)
    );

    toast.success('Target updated successfully');
  };

  const handleRunTests = async () => {
    if (!state.dsl) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('http://localhost:4000/api/ssd/run', {
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
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to run tests');
      }

      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        report: result.report,
        currentStep: 'run',
        isLoading: false,
      }));

      toast.success('Tests completed successfully!');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      toast.error('Failed to run tests');
    }
  };

  const handleReset = () => {
    setState({
      currentStep: 'upload',
      url: '',
      pdfFile: null,
      dsl: null,
      ambiguities: [],
      report: null,
      isLoading: false,
      error: null,
    });
    setDisambiguationItems([]);
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
        {state.isLoading && <LoadingOverlay />}

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
                  placeholder="https://example.com"
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
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Generated from PDF
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-6 overflow-auto max-h-96 border">
                <pre className="text-sm text-green-400 font-mono leading-relaxed">
                  {JSON.stringify(state.dsl, null, 2)}
                </pre>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>Total tests: {state.dsl?.tests?.length || 0}</span>
                <span>Total steps: {state.dsl?.tests?.reduce((sum, test) => sum + test.steps.length, 0) || 0}</span>
              </div>
            </Card>

            {/* Ambiguities */}
            {disambiguationItems.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                  Ambiguous Targets ({disambiguationItems.length})
                </h2>
                <div className="space-y-4">
                  {disambiguationItems.map((item, index) => (
                    <div key={index} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {item.step.description || `Step ${item.step.action}`}
                          </p>
                          <p className="text-sm text-gray-600">{item.ambiguity.reason}</p>
                        </div>
                        <Badge variant="warning">Confidence: {item.step.confidence}</Badge>
                      </div>
                      
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Suggested fixes:</p>
                        <div className="space-y-2">
                          {item.suggestedTargets.map((target, targetIndex) => (
                            <button
                              key={targetIndex}
                              onClick={() => handleDisambiguationFix(item.stepPath, target)}
                              className="block w-full text-left p-2 bg-white border border-gray-200 rounded hover:bg-gray-50"
                            >
                              <span className="font-medium">{target.kind}</span>: {target.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

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
                <Button
                  onClick={handleRunTests}
                  disabled={state.isLoading}
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
                    <div className="mt-3 space-y-2">
                      {result.evidence.dataLayerEvents.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">DataLayer Events:</p>
                          <div className="bg-gray-100 rounded p-2 text-xs font-mono">
                            {result.evidence.dataLayerEvents.length} events captured
                          </div>
                        </div>
                      )}
                      
                      {result.evidence.trackingHits.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Tracking Hits:</p>
                          <div className="bg-gray-100 rounded p-2 text-xs font-mono">
                            {result.evidence.trackingHits.length} network requests captured
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

// Helper function to parse step path like "tests[0].steps[2]"
function parseStepPath(stepPath: string): [number, number] {
  const match = stepPath.match(/tests\[(\d+)\]\.steps\[(\d+)\]/);
  if (!match) throw new Error('Invalid step path');
  return [parseInt(match[1]), parseInt(match[2])];
}
