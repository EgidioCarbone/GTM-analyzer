import React, { useState } from 'react';
import { RefreshCw, Edit3, Save, RotateCcw, XCircle, AlertTriangle, Undo2, CheckCircle, Target } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ReviewStepProps } from '../../types/ssd';
import { detectAmbiguities } from '../../services/ssdValidation';
import { useDisambiguation } from '../../hooks/useDisambiguation';

export default function ReviewStep({
  state,
  editableDsl,
  isEditingDsl,
  dslValidationError,
  ambiguityMinConfidence,
  onDslEdit,
  onSaveDsl,
  onResetDsl,
  onReset
}: ReviewStepProps) {
  if (!state.dsl) return null;

  // Hook per gestire la disambiguazione
  const {
    disambiguationState,
    disambiguatedDsl,
    stats,
    addChoice,
    undoLastChoice,
    resetAllChoices,
    hasChoices,
    canUndo
  } = useDisambiguation(state.dsl);

  // Detect ambiguities in the DSL (usa il DSL disambiguato se disponibile)
  const dslToAnalyze = disambiguatedDsl || state.dsl;
  const ambiguities = detectAmbiguities(dslToAnalyze, ambiguityMinConfidence);

  // Stato per le scelte di disambiguazione
  const [selectedAmbiguity, setSelectedAmbiguity] = useState<string | null>(null);
  const [disambiguationChoices, setDisambiguationChoices] = useState<{[key: string]: any}>({});

  // Funzioni per gestire le scelte di disambiguazione
  const handleDisambiguationChoice = (stepPath: string, choice: any, reason: string) => {
    // Trova il target originale nel DSL
    const pathParts = stepPath.split('.');
    let current = state.dsl;
    
    for (const part of pathParts) {
      if (part.includes('[') && part.includes(']')) {
        const [key, indexStr] = part.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        current = current[key][index];
      } else {
        current = current[part];
      }
    }
    
    const originalTarget = current;
    
    // Aggiungi la scelta
    addChoice(stepPath, originalTarget, choice, reason);
    
    // Aggiorna lo stato locale
    setDisambiguationChoices(prev => ({
      ...prev,
      [stepPath]: choice
    }));
    
    setSelectedAmbiguity(null);
  };

  const handleUndoLastChoice = () => {
    undoLastChoice();
    setDisambiguationChoices({});
  };

  const handleResetAllChoices = () => {
    resetAllChoices();
    setDisambiguationChoices({});
    setSelectedAmbiguity(null);
  };

  return (
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
                onClick={() => {/* setIsEditingDsl(true) */}}
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
                  onClick={onSaveDsl}
                  disabled={!!dslValidationError}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </Button>
                <Button
                  onClick={onResetDsl}
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

        {/* Disambiguation Stats */}
        {hasChoices && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800">
                    Disambiguation Active ({stats.totalChoices} choices)
                  </h4>
                  <p className="text-xs text-blue-600">
                    Last modified: {stats.lastModified}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleUndoLastChoice}
                  disabled={!canUndo}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Undo2 className="w-4 h-4" />
                  Undo Last
                </Button>
                <Button
                  onClick={handleResetAllChoices}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 text-red-600 hover:text-red-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset All
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Ambiguities Warning */}
        {ambiguities.length > 0 && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-yellow-800 mb-2">
                  Potential Ambiguities Detected ({ambiguities.length})
                </h4>
                <div className="space-y-3">
                  {ambiguities.map((ambiguity, index) => (
                    <div key={index} className="text-sm text-yellow-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="font-mono bg-yellow-100 px-2 py-1 rounded text-xs">
                            {ambiguity.stepPath}
                          </span>
                          <span className="ml-2">{ambiguity.reason}</span>
                        </div>
                        {ambiguity.candidates && ambiguity.candidates.length > 0 && (
                          <Button
                            onClick={() => setSelectedAmbiguity(selectedAmbiguity === ambiguity.stepPath ? null : ambiguity.stepPath)}
                            variant="outline"
                            size="sm"
                            className="ml-2"
                          >
                            <Target className="w-4 h-4 mr-1" />
                            Disambiguate
                          </Button>
                        )}
                      </div>
                      
                      {/* Disambiguation Options */}
                      {selectedAmbiguity === ambiguity.stepPath && ambiguity.candidates && (
                        <div className="mt-2 p-3 bg-white rounded border">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">Choose target:</h5>
                          <div className="space-y-2">
                            {ambiguity.candidates.map((candidate, candidateIndex) => (
                              <Button
                                key={candidateIndex}
                                onClick={() => handleDisambiguationChoice(ambiguity.stepPath, candidate, `Chose candidate ${candidateIndex + 1}`)}
                                variant="outline"
                                size="sm"
                                className="w-full text-left justify-start"
                              >
                                <pre className="text-xs font-mono">
                                  {JSON.stringify(candidate, null, 2)}
                                </pre>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-yellow-600">
                  Confidence threshold: {ambiguityMinConfidence}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {isEditingDsl ? (
          <div className="space-y-4">
            <textarea
              value={editableDsl}
              onChange={(e) => onDslEdit(e.target.value)}
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
              {JSON.stringify(disambiguatedDsl || state.dsl, null, 2)}
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
          onClick={onReset} 
          variant="outline"
          className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4" />
          Start Over
        </Button>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            Review the test specification and proceed to results
          </p>
          <p className="text-xs text-gray-500 mb-3">
            {ambiguities.length > 0 ? `${ambiguities.length} potential ambiguities detected` : 'No ambiguities detected'}
          </p>
        </div>
        <Button 
          onClick={() => {
            // This will be handled by the parent component
            window.location.reload();
          }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200"
        >
          View Results
        </Button>
      </div>
    </div>
  );
}
