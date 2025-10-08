import React, { useState } from 'react';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { useAnalysisProgress } from '../hooks/useAnalysisProgress';
import { runWebsiteChecklist } from '../services/websiteChecklist';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Globe, Play, CheckCircle, AlertTriangle } from 'lucide-react';

const ANALYSIS_STEPS = [
  { id: 'navigation', title: 'Navigazione al sito' },
  { id: 'html_extraction', title: 'Estrazione HTML' },
  { id: 'gtm_detection', title: 'Rilevamento GTM' },
  { id: 'consent_analysis', title: 'Analisi Consenso' },
  { id: 'performance_metrics', title: 'Metriche Performance' },
  { id: 'interactive_tests', title: 'Test Interattivi' },
  { id: 'ai_analysis', title: 'Analisi AI' }
];

export default function TestingPage() {
  const [url, setUrl] = useState('https://example.com');
  const [result, setResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { 
    isVisible, 
    currentStep, 
    progress, 
    steps,
    startAnalysis, 
    updateStep, 
    completeAnalysis, 
    hideAnalysis 
  } = useAnalysisProgress();

  const handleAnalyze = async () => {
    if (!url.trim()) return;

    setIsAnalyzing(true);
    setResult(null);

    try {
      // Inizia l'analisi con progresso
      startAnalysis(ANALYSIS_STEPS);

      const analysisResult = await runWebsiteChecklist(url, (step, status, details) => {
        updateStep(step, status, details);
      });

      setResult(analysisResult);
      completeAnalysis();
    } catch (error) {
      console.error('Analysis failed:', error);
      completeAnalysis();
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-6 rounded-xl shadow-lg text-white">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Globe className="w-8 h-8" />
          Test di Analisi Siti Web
        </h1>
        <p className="text-blue-100 mt-2">
          Testa l'analisi completa con progresso dettagliato passo per passo
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurazione Test</CardTitle>
          <CardDescription>
            Inserisci l'URL del sito da analizzare e avvia il test
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleAnalyze} 
              disabled={isAnalyzing || !url.trim()}
              className="px-8"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Analizzando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Avvia Test
                </>
              )}
            </Button>
          </div>

          {result && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800 dark:text-green-200">Performance</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{result.performanceScore}%</div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800 dark:text-blue-200">Accessibilità</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{result.accessibilityScore}%</div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-800 dark:text-purple-200">SEO</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">{result.seoScore}%</div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Risultati Check</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(result.checks).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      {value ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">{key}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                <h3 className="font-semibold mb-2">Riepilogo AI</h3>
                <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {result.aiSummary}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Modal */}
      <AnalysisProgress
        isVisible={isVisible}
        currentStep={currentStep}
        progress={progress}
        steps={steps}
        onComplete={() => {
          setTimeout(() => hideAnalysis(), 2000);
        }}
      />
    </div>
  );
}