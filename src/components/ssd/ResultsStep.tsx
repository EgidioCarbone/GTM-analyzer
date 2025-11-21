import React from 'react';
import { CheckCircle, XCircle, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { ResultsStepProps } from '../../types/ssd';

export default function ResultsStep({
  state,
  originalDsl,
  onReset,
  onExportReport,
  onRunTestsWithData
}: ResultsStepProps) {
  if (!state.report) return null;

  const challenge = state.report.challenge || state.report.cookie?.challenge || null;
  const summary = state.report.summary || null;
  const totalSteps = summary?.steps ?? summary?.totalTests ?? 0;
  const passedSteps = summary?.passed ?? 0;
  const failedSteps = summary?.failed ?? 0;
  const blockedSteps = summary?.blocked ?? 0;
  const durationMs = summary?.duration ?? summary?.durationMs ?? 0;
  const durationSeconds =
    typeof durationMs === 'number' ? Math.round(durationMs / 1000) : null;

  return (
    <div className="space-y-6">
      {challenge?.detected && (
        <Card className="border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-amber-600" />
            <div>
              <h2 className="text-lg font-semibold">
                Accesso bloccato dal sistema anti-bot{challenge.provider ? ` (${challenge.provider})` : ''}
              </h2>
              <p className="mt-1 text-sm">
                {challenge.message ||
                  'Cloudflare ha richiesto una verifica umana, impedendo l’esecuzione automatica dei test.'}
              </p>
              {challenge.url && (
                <p className="mt-2 text-xs text-amber-700 break-all">
                  Pagina rilevata: {challenge.url}
                </p>
              )}
              <p className="mt-3 text-sm">
                Sblocca manualmente il dominio o richiedi al team tecnico un accesso autorizzato
                prima di rilanciare il test.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Test Results Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{totalSteps}</div>
            <div className="text-sm text-gray-600">Total Steps</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{passedSteps}</div>
            <div className="text-sm text-gray-600">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{failedSteps}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{blockedSteps}</div>
            <div className="text-sm text-gray-600">Blocked</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {durationSeconds != null ? `${durationSeconds}s` : '–'}
            </div>
            <div className="text-sm text-gray-600">Duration</div>
          </div>
        </div>
      </Card>

      {/* Detailed Results */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Detailed Results</h2>
        <div className="space-y-4">
          {state.report.results?.map((result, index) => {
            const normalizedStatus = (result.status || '').toUpperCase();
            const isPass = normalizedStatus === 'PASS';
            const isBlocked = normalizedStatus === 'BLOCKED';
            const cardClasses = isPass
              ? 'border-green-200 bg-green-50'
              : isBlocked
                ? 'border-amber-200 bg-amber-50'
                : 'border-red-200 bg-red-50';
            const IconComponent = isPass ? CheckCircle : isBlocked ? AlertTriangle : XCircle;
            const badgeVariant = isPass ? 'success' : isBlocked ? 'warning' : 'error';

            return (
              <div
                key={index}
                className={`border rounded-lg p-4 ${cardClasses}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <IconComponent className={`w-5 h-5 mr-2 ${isPass ? 'text-green-600' : isBlocked ? 'text-amber-600' : 'text-red-600'}`} />
                    <span className="font-medium">{result.section}</span>
                    <Badge variant={badgeVariant} className="ml-2">
                      {result.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-gray-600">
                    {result.timings?.duration || 0}ms
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
                  {result.evidence?.dataLayerEvents?.length ? (
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
                  ) : null}

                  {result.evidence?.trackingHits?.length ? (
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
                              <div
                                className={`text-xs mt-1 ${
                                  hit.status >= 200 && hit.status < 300 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                Status: {hit.status}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {result.evidence?.screenshotPathOrB64 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Screenshot:</p>
                      <div className="mt-2">
                        <img
                          src={`data:image/png;base64,${result.evidence?.screenshotPathOrB64}`}
                          alt={`Screenshot for ${result.section} step ${result.stepIndex}`}
                          className="max-w-full h-auto rounded border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            const newWindow = window.open();
                            if (newWindow) {
                              newWindow.document.write(`
                                <html>
                                  <head><title>Screenshot - ${result.section} Step ${result.stepIndex}</title></head>
                                  <body style="margin:0; padding:20px; background:#f5f5f5;">
                                    <img src="data:image/png;base64,${result.evidence?.screenshotPathOrB64}" 
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
            );
          })}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 bg-gray-50 rounded-lg">
        <Button 
          onClick={onReset} 
          variant="outline"
          className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Start Over
        </Button>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button 
            onClick={onExportReport} 
            variant="outline"
            className="flex items-center gap-2 px-6 py-3 border-2 border-blue-300 text-blue-700 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            Export Report
          </Button>
          <Button 
            onClick={() => onRunTestsWithData(originalDsl, state.pdfContent || '', undefined, state.moduleSource ?? null)} 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 w-full sm:w-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Run Again
          </Button>
        </div>
      </div>
    </div>
  );
}
