import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { 
  Tag, 
  Zap, 
  Variable, 
  Search, 
  Filter, 
  Trash2, 
  Play, 
  Pause,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertCircle,
  X,
  Edit,
  Eye
} from "lucide-react";
import { useContainer } from "../context/ContainerContext";
import { GTMTag, GTMTrigger, GTMVariable, IssueCategory } from "../types/gtm";
import { QualityMetrics } from "../services/containerQualityService";
import { typeIcons } from "../utils/iconMap";
import { typeLabels } from "../utils/typeLabels";
import { getUsedVariableNames } from "../utils/getUsedVariableNames";
import type { GtmMetrics } from "../services/gtm-metrics";
import { 
  getItemsWithIssues, 
  canApplyBulkFix, 
  getBulkFixFunction,
  suggestName,
  fixNaming,
  addDLVFallback,
  addLookupDefault,
  wrapJsTryCatch,
  forceHttps,
  addIdempotencyGuard
} from "../services/fixers";

type TabType = 'tags' | 'triggers' | 'variables';

type AutoFilter = {
  id: string;
  label: string;
  clear: () => void;
};

interface ContainerManagerPageProps {}

// Interfaccia per tracciare la cronologia delle modifiche
interface QualityHistory {
  timestamp: Date;
  score: number;
  metrics: {
    pausedItems: number;
    unusedItems: number;
    uaItems: number;
    namingIssues: number;
  };
  action?: string;
  itemName?: string;
}

// Interfaccia per la modale di conferma
interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  item: any;
  itemType: string;
  dependencies?: string[];
}

// Modale di conferma eliminazione
function DeleteModal({ isOpen, onClose, onConfirm, item, itemType, dependencies }: DeleteModalProps) {
  if (!isOpen) return null;

  const hasDependencies = dependencies && dependencies.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Conferma Eliminazione
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasDependencies ? (
          // Caso: non si può eliminare per dipendenze
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  Impossibile eliminare questo {itemType}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  È collegato ad altri elementi
                </p>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                <strong>{item.name}</strong> non può essere eliminato perché è collegato ai seguenti trigger:
              </p>
              <div className="space-y-2">
                {dependencies.map((triggerName, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {triggerName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              💡 <strong>Suggerimento:</strong> Prima di eliminare il tag, rimuovi o modifica i trigger collegati.
            </div>
          </div>
        ) : (
          // Caso: si può eliminare
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  Conferma eliminazione
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Questa azione non è reversibile
                </p>
              </div>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300">
              Sei sicuro di voler eliminare <strong>"{item.name}"</strong>?
            </p>
            
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tipo: <span className="font-medium">{item.type}</span>
            </p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Annulla
          </button>
          
          {!hasDependencies && (
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Elimina
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Modale di rinomina
function RenameModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  item, 
  itemType, 
  currentName, 
  suggestedName, 
  newName, 
  setNewName 
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  item: any;
  itemType: 'tag' | 'trigger' | 'variable';
  currentName: string;
  suggestedName: string;
  newName: string;
  setNewName: (name: string) => void;
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (newName.trim() && newName.trim() !== currentName) {
      onConfirm();
    }
  };

  const handleUseSuggested = () => {
    setNewName(suggestedName);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Rinomina {itemType === 'tag' ? 'Tag' : itemType === 'trigger' ? 'Trigger' : 'Variabile'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome attuale:
            </label>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400">
              {currentName}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome suggerito:
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                {suggestedName}
              </div>
              <button
                onClick={handleUseSuggested}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Usa
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nuovo nome:
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Inserisci il nuovo nome..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              autoFocus
            />
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            💡 Suggerimento: Usa nomi descrittivi che seguano le convenzioni di naming (es. HTML_, TRG_, DLV_)
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={!newName.trim() || newName.trim() === currentName}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Rinomina
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Modale di conferma toggle pause
function ToggleModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  item, 
  currentPaused 
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  item: any;
  currentPaused: boolean;
}) {
  if (!isOpen) return null;

  const action = currentPaused ? 'riattivare' : 'mettere in pausa';
  const actionCapitalized = currentPaused ? 'Riattivare' : 'Mettere in pausa';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {actionCapitalized} Elemento
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            {currentPaused ? (
              <Play className="w-5 h-5 text-green-600" />
            ) : (
              <Pause className="w-5 h-5 text-orange-600" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Sei sicuro di voler {action} questo elemento?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                <strong>{item?.name}</strong>
              </p>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            {currentPaused ? (
              <p>Riattivando l'elemento, tornerà a funzionare normalmente e verrà eseguito secondo le sue regole di trigger.</p>
            ) : (
              <p>Mettendo in pausa l'elemento, non verrà più eseguito fino a quando non verrà riattivato.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
              currentPaused 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {actionCapitalized}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Modale dei dettagli elemento
function DetailsModal({ 
  isOpen, 
  onClose, 
  item, 
  itemType 
}: {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  itemType: 'tag' | 'trigger' | 'variable';
}) {
  const { container, analysis } = useContainer();
  const [activeTab, setActiveTab] = useState<'overview' | 'configuration' | 'dependencies' | 'issues'>('overview');

  if (!isOpen || !item) return null;

  // Trova le dipendenze e relazioni
  const getDependencies = () => {
    if (!container) return { dependencies: [], dependents: [] };
    
    const dependencies: any[] = [];
    const dependents: any[] = [];
    
    if (itemType === 'tag') {
      // Trova i trigger collegati
      if (item.firingTriggerId) {
        const triggerIds = Array.isArray(item.firingTriggerId) ? item.firingTriggerId : [item.firingTriggerId];
        triggerIds.forEach(id => {
          const trigger = container.trigger?.find(t => t.triggerId === id);
          if (trigger) dependencies.push({ type: 'trigger', item: trigger, relationship: 'Firing Trigger' });
        });
      }
      
      // Trova i tag che usano questo trigger
      container.tag?.forEach(tag => {
        if (tag.firingTriggerId && Array.isArray(tag.firingTriggerId) && tag.firingTriggerId.includes(item.tagId)) {
          dependents.push({ type: 'tag', item: tag, relationship: 'Uses this trigger' });
        }
      });
    }
    
    if (itemType === 'trigger') {
      // Trova i tag che usano questo trigger
      container.tag?.forEach(tag => {
        if (tag.firingTriggerId && Array.isArray(tag.firingTriggerId) && tag.firingTriggerId.includes(item.triggerId)) {
          dependents.push({ type: 'tag', item: tag, relationship: 'Firing Tag' });
        }
      });
    }
    
    if (itemType === 'variable') {
      // Trova dove viene usata questa variabile
      container.tag?.forEach(tag => {
        if (tag.parameter?.some((p: any) => p.value?.includes(item.name))) {
          dependents.push({ type: 'tag', item: tag, relationship: 'Uses this variable' });
        }
      });
      container.trigger?.forEach(trigger => {
        if (trigger.parameter?.some((p: any) => p.value?.includes(item.name))) {
          dependents.push({ type: 'trigger', item: trigger, relationship: 'Uses this variable' });
        }
      });
    }
    
    return { dependencies, dependents };
  };

  // Trova le issues per questo elemento
  const getIssues = () => {
    if (!analysis) return [];
    const itemId = item.tagId || item.triggerId || item.variableId || item.name;
    return analysis.issuesIndex?.byId?.[itemId] || [];
  };

  const { dependencies, dependents } = getDependencies();
  const issues = getIssues();

  const renderTagDetails = (tag: GTMTag) => (
    <div className="space-y-6">
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Header con stato e priorità */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <Tag className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{tag.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tag ID: {tag.tagId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  tag.paused 
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                  {tag.paused ? '⏸️ Pausato' : '✅ Attivo'}
                </span>
                {tag.priority && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
                    Priorità: {tag.priority}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Informazioni principali */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-blue-500">📋</span> Informazioni Base
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
                    <span className="text-gray-900 dark:text-white font-mono">{tag.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Template:</span>
                    <span className="text-gray-900 dark:text-white">{tag.templateId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Firing Triggers:</span>
                    <span className="text-gray-900 dark:text-white">{tag.firingTriggerId?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Blocking Triggers:</span>
                    <span className="text-gray-900 dark:text-white">{tag.blockingTriggerId?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-green-500">⚙️</span> Configurazione
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Parametri:</span>
                    <span className="text-gray-900 dark:text-white">{tag.parameter?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">HTML Custom:</span>
                    <span className="text-gray-900 dark:text-white">{tag.html ? 'Sì' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Built-in:</span>
                    <span className="text-gray-900 dark:text-white">{tag.enableBuiltInVariable ? 'Sì' : 'No'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Issues se presenti */}
          {issues.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <h4 className="font-semibold text-red-900 dark:text-red-200 mb-3 flex items-center gap-2">
                <span className="text-red-500">⚠️</span> Problemi Rilevati ({issues.length})
              </h4>
              <div className="space-y-2">
                {issues.slice(0, 3).map((issue, index) => (
                  <div key={index} className="text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      issue.severity === 'major' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {issue.severity?.toUpperCase()}
                    </span>
                    <span className="ml-2 text-red-700 dark:text-red-300">{issue.reason}</span>
                  </div>
                ))}
                {issues.length > 3 && (
                  <p className="text-xs text-red-600 dark:text-red-400">... e altri {issues.length - 3} problemi</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <div className="space-y-6">
          {/* Parametri */}
          {tag.parameter && Array.isArray(tag.parameter) && tag.parameter.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-purple-500">🔧</span> Parametri di Configurazione
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Chiave</th>
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Valore</th>
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tag.parameter.map((param, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-mono text-gray-900 dark:text-white">{param.key}</td>
                        <td className="py-2">
                          <span className="text-gray-700 dark:text-gray-300 break-all" title={param.value}>
                            {param.value}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500 dark:text-gray-400">{param.type || 'string'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HTML Code */}
          {tag.html && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-orange-500">💻</span> HTML Code
              </h4>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 text-xs whitespace-pre-wrap font-mono">
                  {tag.html}
                </pre>
              </div>
            </div>
          )}

          {/* Trigger Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-yellow-500">⚡</span> Configurazione Trigger
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Firing Triggers</h5>
                {tag.firingTriggerId && Array.isArray(tag.firingTriggerId) && tag.firingTriggerId.length > 0 ? (
                  <div className="space-y-1">
                    {tag.firingTriggerId.map((id, index) => (
                      <div key={index} className="text-sm bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                        {id}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nessun firing trigger</p>
                )}
              </div>
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Blocking Triggers</h5>
                {tag.blockingTriggerId && Array.isArray(tag.blockingTriggerId) && tag.blockingTriggerId.length > 0 ? (
                  <div className="space-y-1">
                    {tag.blockingTriggerId.map((id, index) => (
                      <div key={index} className="text-sm bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                        {id}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nessun blocking trigger</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dependencies Tab */}
      {activeTab === 'dependencies' && (
        <div className="space-y-6">
          {/* Dipendenze */}
          {dependencies.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-blue-500">🔗</span> Dipendenze ({dependencies.length})
              </h4>
              <div className="space-y-3">
                {dependencies.map((dep, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      {dep.type === 'trigger' && <Zap className="w-4 h-4 text-blue-600" />}
                      {dep.type === 'tag' && <Tag className="w-4 h-4 text-blue-600" />}
                      {dep.type === 'variable' && <Variable className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{dep.item.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{dep.relationship}</p>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {dep.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dipendenti */}
          {dependents.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-green-500">🎯</span> Elementi che Dipendono ({dependents.length})
              </h4>
              <div className="space-y-3">
                {dependents.map((dep, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                      {dep.type === 'trigger' && <Zap className="w-4 h-4 text-green-600" />}
                      {dep.type === 'tag' && <Tag className="w-4 h-4 text-green-600" />}
                      {dep.type === 'variable' && <Variable className="w-4 h-4 text-green-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{dep.item.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{dep.relationship}</p>
                    </div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {dep.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dependencies.length === 0 && dependents.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔗</span>
              </div>
              <p>Nessuna dipendenza rilevata</p>
            </div>
          )}
        </div>
      )}

      {/* Issues Tab */}
      {activeTab === 'issues' && (
        <div className="space-y-6">
          {issues.length > 0 ? (
            <div className="space-y-4">
              {issues.map((issue, index) => (
                <div key={index} className={`rounded-lg p-4 border-l-4 ${
                  issue.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                  issue.severity === 'major' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500' :
                  'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          issue.severity === 'major' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {issue.severity?.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {issue.categories.join(', ').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-white mb-2">{issue.reason}</p>
                      {issue.suggestion && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3 mt-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">💡 Suggerimento:</span> {issue.suggestion}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✅</span>
              </div>
              <p>Nessun problema rilevato per questo elemento</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderTriggerDetails = (trigger: GTMTrigger) => (
    <div className="space-y-6">
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Header con stato */}
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{trigger.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Trigger ID: {trigger.triggerId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  trigger.paused 
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                  {trigger.paused ? '⏸️ Pausato' : '✅ Attivo'}
                </span>
              </div>
            </div>
          </div>

          {/* Informazioni principali */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-yellow-500">📋</span> Informazioni Base
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
                    <span className="text-gray-900 dark:text-white font-mono">{trigger.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Auto Event Filters:</span>
                    <span className="text-gray-900 dark:text-white">{trigger.autoEventFilter?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Custom Event Filters:</span>
                    <span className="text-gray-900 dark:text-white">{trigger.customEventFilter?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Parametri:</span>
                    <span className="text-gray-900 dark:text-white">{trigger.parameter?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-green-500">⚙️</span> Configurazione
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Event Name:</span>
                    <span className="text-gray-900 dark:text-white">{trigger.eventName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Wait for Tags:</span>
                    <span className="text-gray-900 dark:text-white">{trigger.waitForTags ? 'Sì' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Check Validation:</span>
                    <span className="text-gray-900 dark:text-white">{trigger.checkValidation ? 'Sì' : 'No'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Issues se presenti */}
          {issues.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <h4 className="font-semibold text-red-900 dark:text-red-200 mb-3 flex items-center gap-2">
                <span className="text-red-500">⚠️</span> Problemi Rilevati ({issues.length})
              </h4>
              <div className="space-y-2">
                {issues.slice(0, 3).map((issue, index) => (
                  <div key={index} className="text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      issue.severity === 'major' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {issue.severity?.toUpperCase()}
                    </span>
                    <span className="ml-2 text-red-700 dark:text-red-300">{issue.reason}</span>
                  </div>
                ))}
                {issues.length > 3 && (
                  <p className="text-xs text-red-600 dark:text-red-400">... e altri {issues.length - 3} problemi</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <div className="space-y-6">
          {/* Parametri */}
          {trigger.parameter && Array.isArray(trigger.parameter) && trigger.parameter.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-purple-500">🔧</span> Parametri di Configurazione
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Chiave</th>
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Valore</th>
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trigger.parameter.map((param, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-mono text-gray-900 dark:text-white">{param.key}</td>
                        <td className="py-2">
                          <span className="text-gray-700 dark:text-gray-300 break-all" title={param.value}>
                            {param.value}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500 dark:text-gray-400">{param.type || 'string'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Event Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-blue-500">🔍</span> Event Filters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Auto Event Filters ({trigger.autoEventFilter?.length || 0})</h5>
                {trigger.autoEventFilter && Array.isArray(trigger.autoEventFilter) && trigger.autoEventFilter.length > 0 ? (
                  <div className="space-y-2">
                    {trigger.autoEventFilter.map((filter, index) => (
                      <div key={index} className="text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-2 rounded">
                        {JSON.stringify(filter, null, 2)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nessun auto event filter</p>
                )}
              </div>
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Event Filters ({trigger.customEventFilter?.length || 0})</h5>
                {trigger.customEventFilter && Array.isArray(trigger.customEventFilter) && trigger.customEventFilter.length > 0 ? (
                  <div className="space-y-2">
                    {trigger.customEventFilter.map((filter, index) => (
                      <div key={index} className="text-sm bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 p-2 rounded">
                        {JSON.stringify(filter, null, 2)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nessun custom event filter</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dependencies Tab */}
      {activeTab === 'dependencies' && (
        <div className="space-y-6">
          {/* Dipendenze */}
          {dependencies.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-blue-500">🔗</span> Dipendenze ({dependencies.length})
              </h4>
              <div className="space-y-3">
                {dependencies.map((dep, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      {dep.type === 'trigger' && <Zap className="w-4 h-4 text-blue-600" />}
                      {dep.type === 'tag' && <Tag className="w-4 h-4 text-blue-600" />}
                      {dep.type === 'variable' && <Variable className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{dep.item.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{dep.relationship}</p>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {dep.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dipendenti */}
          {dependents.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-green-500">🎯</span> Elementi che Dipendono ({dependents.length})
              </h4>
              <div className="space-y-3">
                {dependents.map((dep, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                      {dep.type === 'trigger' && <Zap className="w-4 h-4 text-green-600" />}
                      {dep.type === 'tag' && <Tag className="w-4 h-4 text-green-600" />}
                      {dep.type === 'variable' && <Variable className="w-4 h-4 text-green-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{dep.item.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{dep.relationship}</p>
                    </div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {dep.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dependencies.length === 0 && dependents.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔗</span>
              </div>
              <p>Nessuna dipendenza rilevata</p>
            </div>
          )}
        </div>
      )}

      {/* Issues Tab */}
      {activeTab === 'issues' && (
        <div className="space-y-6">
          {issues.length > 0 ? (
            <div className="space-y-4">
              {issues.map((issue, index) => (
                <div key={index} className={`rounded-lg p-4 border-l-4 ${
                  issue.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                  issue.severity === 'major' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500' :
                  'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          issue.severity === 'major' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {issue.severity?.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {issue.categories.join(', ').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-white mb-2">{issue.reason}</p>
                      {issue.suggestion && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3 mt-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">💡 Suggerimento:</span> {issue.suggestion}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✅</span>
              </div>
              <p>Nessun problema rilevato per questo elemento</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderVariableDetails = (variable: GTMVariable) => (
    <div className="space-y-6">
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Header con stato */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <Variable className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{variable.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Variable ID: {variable.variableId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  variable.paused 
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                  {variable.paused ? '⏸️ Pausato' : '✅ Attivo'}
                </span>
                {variable.enableBuiltInVariable && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm">
                    Built-in
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Informazioni principali */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-green-500">📋</span> Informazioni Base
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
                    <span className="text-gray-900 dark:text-white font-mono">{variable.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Formato:</span>
                    <span className="text-gray-900 dark:text-white">{variable.format || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Built-in:</span>
                    <span className="text-gray-900 dark:text-white">{variable.enableBuiltInVariable ? 'Sì' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Parametri:</span>
                    <span className="text-gray-900 dark:text-white">{variable.parameter?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-blue-500">⚙️</span> Configurazione
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Data Layer Variable:</span>
                    <span className="text-gray-900 dark:text-white">{variable.dataLayerVariable || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Default Value:</span>
                    <span className="text-gray-900 dark:text-white">{variable.defaultValue || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Lookup Table:</span>
                    <span className="text-gray-900 dark:text-white">{variable.lookupTable?.length || 0} entries</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Issues se presenti */}
          {issues.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <h4 className="font-semibold text-red-900 dark:text-red-200 mb-3 flex items-center gap-2">
                <span className="text-red-500">⚠️</span> Problemi Rilevati ({issues.length})
              </h4>
              <div className="space-y-2">
                {issues.slice(0, 3).map((issue, index) => (
                  <div key={index} className="text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      issue.severity === 'major' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {issue.severity?.toUpperCase()}
                    </span>
                    <span className="ml-2 text-red-700 dark:text-red-300">{issue.reason}</span>
                  </div>
                ))}
                {issues.length > 3 && (
                  <p className="text-xs text-red-600 dark:text-red-400">... e altri {issues.length - 3} problemi</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <div className="space-y-6">
          {/* Parametri */}
          {variable.parameter && Array.isArray(variable.parameter) && variable.parameter.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-purple-500">🔧</span> Parametri di Configurazione
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Chiave</th>
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Valore</th>
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variable.parameter.map((param, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-mono text-gray-900 dark:text-white">{param.key}</td>
                        <td className="py-2">
                          <span className="text-gray-700 dark:text-gray-300 break-all" title={param.value}>
                            {param.value}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500 dark:text-gray-400">{param.type || 'string'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lookup Table */}
          {variable.lookupTable && Array.isArray(variable.lookupTable) && variable.lookupTable.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-indigo-500">🔍</span> Lookup Table ({variable.lookupTable.length} entries)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Input</th>
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variable.lookupTable.map((entry, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-mono text-gray-900 dark:text-white">{entry.input || 'N/A'}</td>
                        <td className="py-2 text-gray-700 dark:text-gray-300">{entry.output || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Configurazione specifica per tipo */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-cyan-500">⚙️</span> Configurazione Specifica
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Data Layer</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Variable:</span>
                    <span className="text-gray-900 dark:text-white font-mono">{variable.dataLayerVariable || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Default Value:</span>
                    <span className="text-gray-900 dark:text-white">{variable.defaultValue || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Regex</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Pattern:</span>
                    <span className="text-gray-900 dark:text-white font-mono text-xs">{variable.regexPattern || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Group:</span>
                    <span className="text-gray-900 dark:text-white">{variable.regexGroup || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dependencies Tab */}
      {activeTab === 'dependencies' && (
        <div className="space-y-6">
          {/* Dipendenze */}
          {dependencies.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-blue-500">🔗</span> Dipendenze ({dependencies.length})
              </h4>
              <div className="space-y-3">
                {dependencies.map((dep, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      {dep.type === 'trigger' && <Zap className="w-4 h-4 text-blue-600" />}
                      {dep.type === 'tag' && <Tag className="w-4 h-4 text-blue-600" />}
                      {dep.type === 'variable' && <Variable className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{dep.item.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{dep.relationship}</p>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {dep.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dipendenti */}
          {dependents.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-green-500">🎯</span> Elementi che Dipendono ({dependents.length})
              </h4>
              <div className="space-y-3">
                {dependents.map((dep, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                      {dep.type === 'trigger' && <Zap className="w-4 h-4 text-green-600" />}
                      {dep.type === 'tag' && <Tag className="w-4 h-4 text-green-600" />}
                      {dep.type === 'variable' && <Variable className="w-4 h-4 text-green-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{dep.item.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{dep.relationship}</p>
                    </div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {dep.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dependencies.length === 0 && dependents.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔗</span>
              </div>
              <p>Nessuna dipendenza rilevata</p>
            </div>
          )}
        </div>
      )}

      {/* Issues Tab */}
      {activeTab === 'issues' && (
        <div className="space-y-6">
          {issues.length > 0 ? (
            <div className="space-y-4">
              {issues.map((issue, index) => (
                <div key={index} className={`rounded-lg p-4 border-l-4 ${
                  issue.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                  issue.severity === 'major' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500' :
                  'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          issue.severity === 'major' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {issue.severity?.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {issue.categories.join(', ').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-white mb-2">{issue.reason}</p>
                      {issue.suggestion && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3 mt-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">💡 Suggerimento:</span> {issue.suggestion}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✅</span>
              </div>
              <p>Nessun problema rilevato per questo elemento</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const getItemTypeLabel = () => {
    switch (itemType) {
      case 'tag': return 'Tag';
      case 'trigger': return 'Trigger';
      case 'variable': return 'Variabile';
      default: return 'Elemento';
    }
  };

  const tabs = [
    { id: 'overview', label: 'Panoramica', icon: '📊' },
    { id: 'configuration', label: 'Configurazione', icon: '⚙️' },
    { id: 'dependencies', label: 'Dipendenze', icon: '🔗' },
    { id: 'issues', label: 'Problemi', icon: '⚠️' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full mx-4 shadow-xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {itemType === 'tag' && <Tag className="w-6 h-6 text-blue-600" />}
            {itemType === 'trigger' && <Zap className="w-6 h-6 text-yellow-600" />}
            {itemType === 'variable' && <Variable className="w-6 h-6 text-green-600" />}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Dettagli {getItemTypeLabel()}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{item?.name || 'Elemento senza nome'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {itemType === 'tag' && item && renderTagDetails(item)}
          {itemType === 'trigger' && item && renderTriggerDetails(item)}
          {itemType === 'variable' && item && renderVariableDetails(item)}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 pt-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Chiudi
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Funzione per convertire GtmMetrics in QualityMetrics
const fromAnalysisToQuality = (m: GtmMetrics): QualityMetrics => ({
  overallScore: Number(m.score.total.toFixed(1)), // Usa la stessa precisione
  pausedItems: m.kpi.paused,
  unusedItems: m.kpi.unused.total,
  uaItems: m.kpi.uaObsolete,
  namingIssues: m.kpi.namingIssues.total,
  totalItems: (m.counts.tags ?? 0) + (m.counts.triggers ?? 0) + (m.counts.variables ?? 0),
  qualityBreakdown: {
    tags: { 
      score: m.quality.tags,
      total: m.counts.tags,
      paused: m.kpi.paused,
      unused: 0, // Not directly available in GtmMetrics
      ua: m.kpi.uaObsolete,
      namingIssues: m.kpi.namingIssues.tags
    },
    triggers: { 
      score: m.quality.triggers,
      total: m.counts.triggers,
      paused: 0, // Not directly available in GtmMetrics
      unused: m.kpi.unused.triggers,
      ua: 0, // Not applicable for triggers
      namingIssues: m.kpi.namingIssues.triggers
    },
    variables: { 
      score: m.quality.variables,
      total: m.counts.variables,
      paused: 0, // Not directly available in GtmMetrics
      unused: m.kpi.unused.variables,
      ua: 0, // Not applicable for variables
      namingIssues: m.kpi.namingIssues.variables
    },
  },
});

export default function ContainerManagerPage({}: ContainerManagerPageProps) {
  const { container, setContainer, analysis, activity, applyContainerChange } = useContainer();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('tags');
  const [searchTerm, setSearchTerm] = useState('');

  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [previousQuality, setPreviousQuality] = useState<number>(0);
  const [showQualityImprovement, setShowQualityImprovement] = useState(false);
  
  // Cronologia della qualità per tracciare i progressi
  const [qualityHistory, setQualityHistory] = useState<QualityHistory[]>([]);
  const [initialQuality, setInitialQuality] = useState<QualityMetrics | null>(null);

  // Filtri per sidebar
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showUA, setShowUA] = useState(false);
  const [showPaused, setShowPaused] = useState(false);
  const [showUnused, setShowUnused] = useState(false);
  
  // Filtri qualità - Tags
  const [showNaming, setShowNaming] = useState(false);
  const [showNoTrigger, setShowNoTrigger] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [showHtmlSecurityCritical, setShowHtmlSecurityCritical] = useState(false);
  const [showHtmlSecurityMajor, setShowHtmlSecurityMajor] = useState(false);
  const [showHtmlSecurityMinor, setShowHtmlSecurityMinor] = useState(false);
  
  // Filtri qualità - Triggers
  const [showTrgAllPages, setShowTrgAllPages] = useState(false);
  const [showTrgTiming, setShowTrgTiming] = useState(false);
  const [showTrgUnused, setShowTrgUnused] = useState(false);
  const [showTrgDuplicate, setShowTrgDuplicate] = useState(false);
  
  // Filtri qualità - Variables
  const [showVarDlv, setShowVarDlv] = useState(false);
  const [showVarLookup, setShowVarLookup] = useState(false);
  const [showVarRegex, setShowVarRegex] = useState(false);
  const [showVarCss, setShowVarCss] = useState(false);
  const [showVarJs, setShowVarJs] = useState(false);
  const [showVarUnused, setShowVarUnused] = useState(false);
  const [showVarDuplicate, setShowVarDuplicate] = useState(false);

  const [autoFilters, setAutoFilters] = useState<AutoFilter[]>([]);

  // Stato per la modale di eliminazione
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    item: any;
    itemType: string;
    dependencies?: string[];
  }>({
    isOpen: false,
    item: null,
    itemType: '',
    dependencies: []
  });

  // Stato per la modale di rinomina
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    item: any;
    itemType: 'tag' | 'trigger' | 'variable';
    currentName: string;
    suggestedName: string;
    newName: string;
  }>({
    isOpen: false,
    item: null,
    itemType: 'tag',
    currentName: '',
    suggestedName: '',
    newName: ''
  });

  // Stato per la modale di toggle pause
  const [toggleModal, setToggleModal] = useState<{
    isOpen: boolean;
    item: any;
    currentPaused: boolean;
  }>({
    isOpen: false,
    item: null,
    currentPaused: false
  });

  // Stato per la modale dei dettagli
  const [detailsModal, setDetailsModal] = useState<{
    isOpen: boolean;
    item: any;
    itemType: 'tag' | 'trigger' | 'variable';
  }>({
    isOpen: false,
    item: null,
    itemType: 'tag'
  });

  // Stato per la modale di bulk rename
  const [bulkRenameModal, setBulkRenameModal] = useState<{
    isOpen: boolean;
    items: any[] | null;
    totalCount: number;
  }>({
    isOpen: false,
    items: null,
    totalCount: 0
  });

  const resetFilters = () => {
    setSelectedTypes([]);
    setShowUA(false);
    setShowPaused(false);
    setShowUnused(false);
    setShowNaming(false);
    setShowNoTrigger(false);
    setShowConsent(false);
    setShowHtmlSecurityCritical(false);
    setShowHtmlSecurityMajor(false);
    setShowHtmlSecurityMinor(false);
    setShowTrgAllPages(false);
    setShowTrgTiming(false);
    setShowTrgUnused(false);
    setShowTrgDuplicate(false);
    setShowVarDlv(false);
    setShowVarLookup(false);
    setShowVarRegex(false);
    setShowVarCss(false);
    setShowVarJs(false);
    setShowVarUnused(false);
    setShowVarDuplicate(false);
  };

  const applyNavFilter = (navFilter: string, navTab?: string): AutoFilter[] => {
    const filters: AutoFilter[] = [];

    const addToggle = (
      id: string,
      label: string,
      setter: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
      setter(true);
      filters.push({
        id,
        label,
        clear: () => setter(false),
      });
    };

    const addSelectedTypesFilter = (id: string, label: string, types: string[]) => {
      const uniqueTypes = [...new Set(types)];
      setSelectedTypes(() => uniqueTypes);
      filters.push({
        id,
        label,
        clear: () =>
          setSelectedTypes((prev) => prev.filter((type) => !uniqueTypes.includes(type))),
      });
    };

    switch (navFilter) {
      case 'ua':
        addToggle('ua', 'Tag UA (obsoleti)', setShowUA);
        break;
      case 'paused':
        addToggle('paused', 'Tag in pausa', setShowPaused);
        break;
      case 'unused':
        addToggle('unused', 'Elementi non utilizzati', setShowUnused);
        break;
      case 'naming':
        addToggle('naming', 'Naming non standard', setShowNaming);
        break;
      case 'no-trigger':
        addToggle('no-trigger', 'Tag senza trigger', setShowNoTrigger);
        break;
      case 'ga4':
        addSelectedTypesFilter(
          'ga4',
          'Tag GA4 (config & event)',
          ['googtag', 'ga4', 'gaawe', 'gaawc', 'ga4_config']
        );
        break;
      case 'marketing':
      case 'consent':
        addToggle('consent', 'Consent mancanti', setShowConsent);
        break;
      case 'quality':
        if (navTab === 'triggers') {
          addToggle('quality:trg:allpages', 'Trigger · All Pages', setShowTrgAllPages);
          addToggle('quality:trg:timing', 'Trigger · Timing', setShowTrgTiming);
          addToggle('quality:trg:unused', 'Trigger · Non utilizzati', setShowTrgUnused);
          addToggle('quality:trg:duplicate', 'Trigger · Duplicati', setShowTrgDuplicate);
        } else if (navTab === 'variables') {
          addToggle('quality:var:dlv', 'Variabili · DLV senza fallback', setShowVarDlv);
          addToggle('quality:var:lookup', 'Variabili · Lookup senza default', setShowVarLookup);
          addToggle('quality:var:regex', 'Variabili · Regex fragili', setShowVarRegex);
          addToggle('quality:var:css', 'Variabili · CSS fragili', setShowVarCss);
          addToggle('quality:var:js', 'Variabili · JS non sicuro', setShowVarJs);
          addToggle('quality:var:unused', 'Variabili · Non utilizzate', setShowVarUnused);
          addToggle('quality:var:duplicate', 'Variabili · Duplicate', setShowVarDuplicate);
        } else {
          addToggle('quality:tag:naming', 'Tag · Naming non standard', setShowNaming);
          addToggle('quality:tag:no-trigger', 'Tag · Senza trigger', setShowNoTrigger);
        }
        break;
      case 'html-security-critical':
        addToggle('html:critical', 'Sicurezza HTML · Critici', setShowHtmlSecurityCritical);
        break;
      case 'html-security-major':
        addToggle('html:major', 'Sicurezza HTML · Maggiori', setShowHtmlSecurityMajor);
        break;
      case 'html-security-minor':
        addToggle('html:minor', 'Sicurezza HTML · Minori', setShowHtmlSecurityMinor);
        break;
      case 'html':
        addToggle('html:critical', 'Sicurezza HTML · Critici', setShowHtmlSecurityCritical);
        addToggle('html:major', 'Sicurezza HTML · Maggiori', setShowHtmlSecurityMajor);
        addToggle('html:minor', 'Sicurezza HTML · Minori', setShowHtmlSecurityMinor);
        break;
      case 'trg-allpages':
        addToggle('quality:trg:allpages', 'Trigger · All Pages', setShowTrgAllPages);
        break;
      case 'trg-timing':
        addToggle('quality:trg:timing', 'Trigger · Timing', setShowTrgTiming);
        break;
      case 'trg-unused':
        addToggle('quality:trg:unused', 'Trigger · Non utilizzati', setShowTrgUnused);
        break;
      case 'trg-duplicate':
        addToggle('quality:trg:duplicate', 'Trigger · Duplicati', setShowTrgDuplicate);
        break;
      case 'var-dlv':
        addToggle('quality:var:dlv', 'Variabili · DLV senza fallback', setShowVarDlv);
        break;
      case 'var-lookup':
        addToggle('quality:var:lookup', 'Variabili · Lookup senza default', setShowVarLookup);
        break;
      case 'var-regex':
        addToggle('quality:var:regex', 'Variabili · Regex fragili', setShowVarRegex);
        break;
      case 'var-css':
        addToggle('quality:var:css', 'Variabili · CSS fragili', setShowVarCss);
        break;
      case 'var-js':
        addToggle('quality:var:js', 'Variabili · JS non sicuro', setShowVarJs);
        break;
      case 'var-unused':
        addToggle('quality:var:unused', 'Variabili · Non utilizzate', setShowVarUnused);
        break;
      case 'var-duplicate':
        addToggle('quality:var:duplicate', 'Variabili · Duplicate', setShowVarDuplicate);
        break;
      default:
        break;
    }

    return filters;
  };

  const clearAutoFilters = () => {
    resetFilters();
    setAutoFilters([]);
    setSearchTerm('');
  };

  const handleRemoveAutoFilter = (filter: AutoFilter) => {
    filter.clear();
    setAutoFilters((prev) => prev.filter((f) => f.id !== filter.id));
  };

  // Gestisci i parametri di navigazione dalla Dashboard
  useEffect(() => {
    resetFilters();
    setAutoFilters([]);
    setSearchTerm('');

    if (!location.state) {
      return;
    }

    const { activeTab: navTab, autoFilter: navFilter } = location.state;

    if (navTab && ['tags', 'triggers', 'variables'].includes(navTab)) {
      setActiveTab(navTab as TabType);
    }

    if (navFilter) {
      const applied = applyNavFilter(navFilter, navTab);
      setAutoFilters(applied);
    }
  }, [location.state]);

  // Calcola la qualità del container quando cambia
  useEffect(() => {
    if (!container || !analysis) return;
    
    // Single source of truth: usa analysis dal context
    const currentQuality = fromAnalysisToQuality(analysis);
    console.log("✅ Qualità calcolata da analysis:", currentQuality.overallScore);
    
    setQualityMetrics(currentQuality);
    
    // Salva la qualità iniziale se è la prima volta
    if (qualityHistory.length === 0) {
      setInitialQuality(currentQuality);
      setQualityHistory([{
        timestamp: new Date(),
        score: currentQuality.overallScore,
        metrics: {
          pausedItems: currentQuality.pausedItems,
          unusedItems: currentQuality.unusedItems,
          uaItems: currentQuality.uaItems,
          namingIssues: currentQuality.namingIssues
        },
        action: 'Container caricato'
      }]);
    }
    
    // Mostra miglioramento se la qualità è aumentata
    if (previousQuality > 0 && currentQuality.overallScore > previousQuality) {
      setShowQualityImprovement(true);
      setTimeout(() => setShowQualityImprovement(false), 3000);
    }
  }, [container, analysis, previousQuality, qualityHistory.length]);

  // Salva la qualità precedente per il confronto
  useEffect(() => {
    if (qualityMetrics) {
      setPreviousQuality(qualityMetrics.overallScore);
    }
  }, [qualityMetrics]);

  // Traccia i cambiamenti di qualità quando l'analysis cambia
  useEffect(() => {
    if (analysis && qualityHistory.length > 0) {
      const currentQuality = fromAnalysisToQuality(analysis);
      const lastEntry = qualityHistory[qualityHistory.length - 1];
      
      // Solo se il punteggio è cambiato, aggiungi una nuova entry
      if (lastEntry.score !== currentQuality.overallScore) {
        setQualityHistory(prev => [...prev, {
          timestamp: new Date(),
          score: currentQuality.overallScore,
          metrics: {
            pausedItems: currentQuality.pausedItems,
            unusedItems: currentQuality.unusedItems,
            uaItems: currentQuality.uaItems,
            namingIssues: currentQuality.namingIssues
          },
          action: 'Container modificato'
        }]);
      }
    }
  }, [analysis, qualityHistory.length]);

  if (!container) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Container non caricato
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Carica un container GTM per iniziare l'ottimizzazione
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'tags', label: 'Tag', icon: Tag, count: container.tag?.length || 0 },
    { id: 'triggers', label: 'Trigger', icon: Zap, count: container.trigger?.length || 0 },
    { id: 'variables', label: 'Variabili', icon: Variable, count: container.variable?.length || 0 }
  ];

  // Ottieni i tipi disponibili per il tab attivo
  const getCurrentItems = () => {
    switch (activeTab) {
      case 'tags':
        return container.tag || [];
      case 'triggers':
        return container.trigger || [];
      case 'variables':
        return container.variable || [];
      default:
        return [];
    }
  };

  const currentItems = getCurrentItems();
  const typesFound = Array.from(new Set(currentItems.map((i) => i.type).filter(Boolean))).sort();

  // Ottieni nomi delle variabili utilizzate per il filtro "non utilizzate"
  const usedVarNames = useMemo(() => {
    if (!container || activeTab !== 'variables') return new Set<string>();
    return getUsedVariableNames(container);
  }, [container, activeTab]);

  // Controlla le dipendenze di un tag
  const checkTagDependencies = (tagName: string): string[] => {
    if (activeTab !== 'tags') return [];
    
    console.log('🔍 Controllo dipendenze per tag:', tagName);
    
    // 1. Trova il tag che si vuole eliminare
    const tagToDelete = container.tag?.find(t => t.name === tagName);
    if (!tagToDelete) {
      console.log('❌ Tag non trovato');
      return [];
    }
    
    console.log('📋 Tag trovato:', tagToDelete);
    
    // 2. Controlla se ha firingTriggerId
    if (!tagToDelete.firingTriggerId) {
      console.log('✅ Tag non ha trigger collegati');
      return [];
    }
    
    // 3. Ottieni gli ID dei trigger collegati
    const triggerIds = Array.isArray(tagToDelete.firingTriggerId) 
      ? tagToDelete.firingTriggerId 
      : [tagToDelete.firingTriggerId];
    
    console.log('🎯 Trigger ID collegati:', triggerIds);
    
    // 4. Trova i trigger corrispondenti
    const dependencies: string[] = [];
    const triggers = container.trigger || [];
    
    triggerIds.forEach(triggerId => {
      const trigger = triggers.find(t => t.triggerId === triggerId);
      if (trigger) {
        console.log('✅ Trigger collegato trovato:', trigger.name, 'ID:', trigger.triggerId);
        dependencies.push(trigger.name);
      } else {
        console.log('⚠️ Trigger ID non trovato:', triggerId);
      }
    });
    
    console.log('📊 Dipendenze finali:', dependencies);
    return dependencies;
  };

  // Funzione per filtrare per issues usando l'issuesIndex
  const filterByIssues = (items: any[]): any[] => {
    if (!analysis) return items;
    const { issuesIndex } = analysis;
    const map = issuesIndex?.byCategory || {};

    const ids = (cats: IssueCategory[]) =>
      new Set(cats.flatMap(c => map[c] || []));

    let filteredItems = items;

    // Filtri per Tags
    if (activeTab === 'tags') {
      if (showNaming) {
        filteredItems = filteredItems.filter(i => ids(['naming']).has(i.tagId || i.name));
      }
      if (showNoTrigger) {
        filteredItems = filteredItems.filter(i => ids(['no_trigger']).has(i.tagId || i.name));
      }
      if (showConsent) {
        filteredItems = filteredItems.filter(i => ids(['consent_missing']).has(i.tagId || i.name));
      }
      if (showHtmlSecurityCritical) {
        filteredItems = filteredItems.filter(i => ids(['html_security_critical']).has(i.tagId || i.name));
      }
      if (showHtmlSecurityMajor) {
        filteredItems = filteredItems.filter(i => ids(['html_security_major']).has(i.tagId || i.name));
      }
      if (showHtmlSecurityMinor) {
        filteredItems = filteredItems.filter(i => ids(['html_security_minor']).has(i.tagId || i.name));
      }
    }

    // Filtri per Triggers
    if (activeTab === 'triggers') {
      if (showTrgAllPages) {
        filteredItems = filteredItems.filter(i => ids(['trigger_all_pages']).has(i.triggerId || i.name));
      }
      if (showTrgTiming) {
        filteredItems = filteredItems.filter(i => ids(['trigger_timing']).has(i.triggerId || i.name));
      }
      if (showTrgUnused) {
        filteredItems = filteredItems.filter(i => ids(['trigger_unused']).has(i.triggerId || i.name));
      }
      if (showTrgDuplicate) {
        filteredItems = filteredItems.filter(i => ids(['trigger_duplicate']).has(i.triggerId || i.name));
      }
    }

    // Filtri per Variables
    if (activeTab === 'variables') {
      if (showVarDlv) {
        filteredItems = filteredItems.filter(i => ids(['variable_dlv_fallback']).has(i.variableId || i.name));
      }
      if (showVarLookup) {
        filteredItems = filteredItems.filter(i => ids(['variable_lookup_default']).has(i.variableId || i.name));
      }
      if (showVarRegex) {
        filteredItems = filteredItems.filter(i => ids(['variable_regex_bad']).has(i.variableId || i.name));
      }
      if (showVarCss) {
        filteredItems = filteredItems.filter(i => ids(['variable_css_fragile']).has(i.variableId || i.name));
      }
      if (showVarJs) {
        filteredItems = filteredItems.filter(i => ids(['variable_js_unsafe']).has(i.variableId || i.name));
      }
      if (showVarUnused) {
        filteredItems = filteredItems.filter(i => ids(['variable_unused']).has(i.variableId || i.name));
      }
      if (showVarDuplicate) {
        filteredItems = filteredItems.filter(i => ids(['variable_duplicate']).has(i.variableId || i.name));
      }
    }

    return filteredItems;
  };

  const getFilteredItems = () => {
    let items = currentItems;

    // Applica filtro di ricerca
    if (searchTerm) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Applica filtri della sidebar
    if (selectedTypes.length > 0) {
      items = items.filter(item => selectedTypes.includes(item.type));
    }

    if (showUA) {
      items = items.filter(item => 
        item.type.includes('UA') || 
        item.type.includes('Universal') ||
        item.type === 'ua'
      );
    }

    if (showPaused) {
      items = items.filter(item => item.paused === true);
    }

    if (showUnused && activeTab === 'variables') {
      items = items.filter(item => !usedVarNames.has(item.name));
    }

    // Applica filtri qualità usando il nuovo sistema di checkbox
    items = filterByIssues(items);

    return items;
  };

  const handleDeleteClick = (item: any) => {
    let dependencies: string[] = [];
    
    // Controlla le dipendenze solo per i tag
    if (activeTab === 'tags') {
      dependencies = checkTagDependencies(item.name);
    }
    
    setDeleteModal({
      isOpen: true,
      item,
      itemType: activeTab.slice(0, -1), // Rimuovi la 's' finale
      dependencies
    });
  };

  const handleDeleteConfirm = () => {
    if (!container || !deleteModal.item) return;

    const itemName = deleteModal.item.name;
    let itemType: 'tag' | 'trigger' | 'variable' = 'tag';
    
    // Trova il tipo di elemento
    if (container.tag?.find(t => t.name === itemName)) itemType = 'tag';
    else if (container.trigger?.find(t => t.name === itemName)) itemType = 'trigger';
    else if (container.variable?.find(t => t.name === itemName)) itemType = 'variable';

    // Usa applyContainerChange per eliminare l'elemento
    applyContainerChange(
      'DELETE_' + itemType.toUpperCase(),
      { type: itemType, id: deleteModal.item.tagId || deleteModal.item.triggerId || deleteModal.item.variableId || itemName, name: itemName },
      (draft) => {
        if (draft[itemType]) {
          draft[itemType] = draft[itemType]!.filter(item => item.name !== itemName);
        }
      }
    );
    
    // Chiudi la modale
    setDeleteModal({ isOpen: false, item: null, itemType: '', dependencies: [] });
  };

  const handleRenameConfirm = () => {
    if (!container || !renameModal.item || !renameModal.newName.trim()) return;

    const itemType = renameModal.itemType;
    const oldName = renameModal.currentName;
    const newName = renameModal.newName.trim();

    // Usa applyContainerChange per rinominare l'elemento
    applyContainerChange(
      'RENAME_' + itemType.toUpperCase(),
      { type: itemType, id: renameModal.item.tagId || renameModal.item.triggerId || renameModal.item.variableId || oldName, name: oldName },
      (draft) => {
        if (draft[itemType]) {
          const index = draft[itemType]!.findIndex(item => item.name === oldName);
          if (index !== -1) {
            draft[itemType]![index] = {
              ...draft[itemType]![index],
              name: newName
            };
          }
        }
      }
    );

    // Chiudi la modale
    setRenameModal({
      isOpen: false,
      item: null,
      itemType: 'tag',
      currentName: '',
      suggestedName: '',
      newName: ''
    });
  };

  const handleTogglePause = (itemId: string) => {
    if (!container) return;

    // Trova l'elemento
    let item = null;
    let itemType: 'tag' | 'trigger' | 'variable' = 'tag';
    
    if (container.tag?.find(t => t.name === itemId)) {
      itemType = 'tag';
      item = container.tag.find(t => t.name === itemId);
    } else if (container.trigger?.find(t => t.name === itemId)) {
      itemType = 'trigger';
      item = container.trigger.find(t => t.name === itemId);
    } else if (container.variable?.find(t => t.name === itemId)) {
      itemType = 'variable';
      item = container.variable.find(t => t.name === itemId);
    }

    if (item) {
      setToggleModal({
        isOpen: true,
        item: item,
        currentPaused: item.paused
      });
    }
  };

  const handleToggleConfirm = () => {
    if (!container || !toggleModal.item) return;

    const itemId = toggleModal.item.name;
    let itemType: 'tag' | 'trigger' | 'variable' = 'tag';
    
    // Trova il tipo di elemento
    if (container.tag?.find(t => t.name === itemId)) itemType = 'tag';
    else if (container.trigger?.find(t => t.name === itemId)) itemType = 'trigger';
    else if (container.variable?.find(t => t.name === itemId)) itemType = 'variable';

    // Usa applyContainerChange per toggle dello stato paused
    applyContainerChange(
      toggleModal.currentPaused ? 'RESUME_' + itemType.toUpperCase() : 'PAUSE_' + itemType.toUpperCase(),
      { type: itemType, id: toggleModal.item.tagId || toggleModal.item.triggerId || toggleModal.item.variableId || itemId, name: itemId },
      (draft) => {
        if (draft[itemType]) {
          const item = draft[itemType]!.find(i => i.name === itemId);
          if (item) {
            item.paused = !item.paused;
          }
        }
      }
    );

    // Chiudi la modale
    setToggleModal({
      isOpen: false,
      item: null,
      currentPaused: false
    });
  };

  const handleBulkRename = () => {
    if (!container) return;
    
    const itemsWithNamingIssues = getFilteredItems().filter(item => {
      const itemId = item.tagId || item.triggerId || item.variableId || item.name;
      const issues = analysis?.issuesIndex?.byId?.[itemId] || [];
      return issues.some(i => i.categories.includes('naming'));
    });
    
    if (itemsWithNamingIssues.length === 0) return;
    
    setBulkRenameModal({
      isOpen: true,
      items: itemsWithNamingIssues,
      totalCount: itemsWithNamingIssues.length
    });
  };

  const handleBulkRenameConfirm = () => {
    if (!container || !bulkRenameModal.items) return;
    
    const type: 'tag' | 'trigger' | 'variable' = activeTab === 'tags' ? 'tag' : activeTab === 'triggers' ? 'trigger' : 'variable';
    
    console.log('🔄 Inizio bulk rename per', bulkRenameModal.items.length, 'elementi');
    console.log('📋 Elementi da rinominare:', bulkRenameModal.items.map(item => ({
      name: item.name,
      type: item.type,
      tagId: item.tagId,
      triggerId: item.triggerId,
      variableId: item.variableId
    })));
    
    // Rinomina tutti gli elementi con problemi di naming in una singola operazione
    applyContainerChange(
      'rinominato in batch',
      { type, id: 'bulk_rename', name: `${bulkRenameModal.items.length} elementi` },
      (draft) => {
        console.log('📦 Draft container:', {
          tags: draft.tag?.length || 0,
          triggers: draft.trigger?.length || 0,
          variables: draft.variable?.length || 0
        });
        
        bulkRenameModal.items.forEach((item, index) => {
          const suggestedName = suggestName(type, item.name, item.type);
          console.log(`🔄 [${index + 1}/${bulkRenameModal.items.length}] Rinomino: ${item.name} → ${suggestedName}`);
          
          if (activeTab === 'tags') {
            const tag = draft.tag?.find(t => t.tagId === item.tagId || t.name === item.name);
            if (tag) {
              const oldName = tag.name;
              tag.name = suggestedName;
              console.log('✅ Tag rinominato:', oldName, '→', tag.name);
            } else {
              console.warn('❌ Tag non trovato:', { tagId: item.tagId, name: item.name, availableTags: draft.tag?.map(t => ({ id: t.tagId, name: t.name })) });
            }
          } else if (activeTab === 'triggers') {
            const trigger = draft.trigger?.find(t => t.triggerId === item.triggerId || t.name === item.name);
            if (trigger) {
              const oldName = trigger.name;
              trigger.name = suggestedName;
              console.log('✅ Trigger rinominato:', oldName, '→', trigger.name);
            } else {
              console.warn('❌ Trigger non trovato:', { triggerId: item.triggerId, name: item.name, availableTriggers: draft.trigger?.map(t => ({ id: t.triggerId, name: t.name })) });
            }
          } else if (activeTab === 'variables') {
            const variable = draft.variable?.find(v => v.variableId === item.variableId || v.name === item.name);
            if (variable) {
              const oldName = variable.name;
              variable.name = suggestedName;
              console.log('✅ Variable rinominata:', oldName, '→', variable.name);
            } else {
              console.warn('❌ Variable non trovata:', { variableId: item.variableId, name: item.name, availableVariables: draft.variable?.map(v => ({ id: v.variableId, name: v.name })) });
            }
          }
        });
      }
    );
    
    setBulkRenameModal({ isOpen: false, items: null, totalCount: 0 });
  };

  const filteredItems = getFilteredItems();
  const excludedCount = Math.max(0, (currentItems?.length || 0) - filteredItems.length);

  // Calcola le differenze rispetto alla qualità iniziale
  const getQualityDifference = () => {
    if (!initialQuality || !analysis) return null;
    
    return {
      score: analysis.score.total - initialQuality.overallScore,
      pausedItems: initialQuality.pausedItems - (analysis.kpi.paused || 0),
      unusedItems: initialQuality.unusedItems - (analysis.kpi.unused.total || 0),
      uaItems: initialQuality.uaItems - (analysis.kpi.uaObsolete || 0),
      namingIssues: initialQuality.namingIssues - (analysis.kpi.namingIssues.total || 0)
    };
  };

  const qualityDifference = getQualityDifference();

  return (
    <div className="p-6 space-y-6">
      {/* Header con qualità del container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Container Manager
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Qualità Container</p>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <motion.div
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis?.score.total ?? 0}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(analysis?.score.total ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {autoFilters.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                Filtri automatici attivati dalla Dashboard
              </p>
              <button
                onClick={clearAutoFilters}
                className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
              >
                Reset filtri
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {autoFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => handleRemoveAutoFilter(filter)}
                  className="group inline-flex items-center gap-2 px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                >
                  <span>{filter.label}</span>
                  <X className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Timeline del progresso */}
        {initialQuality && qualityMetrics && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
              📈 Timeline del Progresso
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Qualità iniziale vs attuale */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700 dark:text-blue-300">Qualità Iniziale:</span>
                  <span className="font-bold text-blue-800 dark:text-blue-200">{initialQuality.overallScore.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700 dark:text-green-300">Qualità Attuale:</span>
                  <span className="font-bold text-green-800 dark:text-blue-200">{(analysis?.score.total ?? 0).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Miglioramento:</span>
                  <div className="flex items-center gap-1">
                    {qualityDifference && qualityDifference.score > 0 ? (
                      <>
                        <ArrowUpRight className="w-4 h-4 text-green-600" />
                        <span className="font-bold text-green-600">+{qualityDifference.score}%</span>
                      </>
                    ) : qualityDifference && qualityDifference.score < 0 ? (
                      <>
                        <ArrowDownRight className="w-4 h-4 text-red-600" />
                        <span className="font-bold text-red-600">{qualityDifference.score}%</span>
                      </>
                    ) : (
                      <>
                        <Minus className="w-4 h-4 text-gray-600" />
                        <span className="font-bold text-gray-600">0%</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Barra di confronto visivo */}
              <div className="space-y-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">Confronto Visivo:</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-600 dark:text-blue-400">Iniziale</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${initialQuality.overallScore}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 dark:text-green-400">Attuale</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(analysis?.score.total ?? 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metriche di qualità con confronto */}
        {analysis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div 
              className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              onClick={() => setShowPaused(true)}
              title="Clicca per filtrare gli elementi in pausa"
            >
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {analysis.kpi.paused}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">In Pausa</div>
              {qualityDifference && (
                <div className="text-xs mt-1">
                  {qualityDifference.pausedItems > 0 ? (
                    <span className="text-green-600 dark:text-green-400">↓ -{qualityDifference.pausedItems}</span>
                  ) : qualityDifference.pausedItems < 0 ? (
                    <span className="text-red-600 dark:text-red-400">↑ +{Math.abs(qualityDifference.pausedItems)}</span>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400">→ 0</span>
                  )}
                </div>
              )}
            </div>
            <div 
              className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              onClick={() => setShowUnused(true)}
              title="Clicca per filtrare gli elementi non utilizzati"
            >
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {analysis.kpi.unused.total}
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">Non Utilizzati</div>
              {qualityDifference && (
                <div className="text-xs mt-1">
                  {qualityDifference.unusedItems > 0 ? (
                    <span className="text-green-600 dark:text-green-400">↓ -{qualityDifference.unusedItems}</span>
                  ) : qualityDifference.unusedItems < 0 ? (
                    <span className="text-red-600 dark:text-red-400">↑ +{Math.abs(qualityDifference.unusedItems)}</span>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400">→ 0</span>
                  )}
                </div>
              )}
            </div>
            <div 
              className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
              onClick={() => setShowUA(true)}
              title="Clicca per filtrare i tag UA obsoleti"
            >
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {analysis.kpi.uaObsolete}
              </div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">UA Obsoleti</div>
              {qualityDifference && (
                <div className="text-xs mt-1">
                  {qualityDifference.uaItems > 0 ? (
                    <span className="text-green-600 dark:text-green-400">↓ -{qualityDifference.uaItems}</span>
                  ) : qualityDifference.uaItems < 0 ? (
                    <span className="text-red-600 dark:text-red-400">↑ +{Math.abs(qualityDifference.uaItems)}</span>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400">→ 0</span>
                  )}
                </div>
              )}
            </div>
            <div 
              className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              onClick={() => setShowNaming(true)}
              title="Clicca per filtrare gli elementi con problemi di naming"
            >
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analysis.kpi.namingIssues.total}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Naming Issues</div>
              {qualityDifference && (
                <div className="text-xs mt-1">
                  {qualityDifference.namingIssues > 0 ? (
                    <span className="text-green-600 dark:text-green-400">↓ -{qualityDifference.namingIssues}</span>
                  ) : qualityDifference.namingIssues < 0 ? (
                    <span className="text-red-600 dark:text-red-400">↑ +{Math.abs(qualityDifference.namingIssues)}</span>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400">→ 0</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resoconto attività */}
      {activity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            📋 Resoconto Attività
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {activity.slice(0, 10).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {entry.action.replace(/_/g, ' ').toLowerCase()}
                      {entry.entity.name && (
                        <span className="text-gray-600 dark:text-gray-400 ml-1">"{entry.entity.name}"</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(entry.ts).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {entry.deltaScore !== undefined && (
                    <div className="flex items-center gap-1">
                      {entry.deltaScore > 0 ? (
                        <>
                          <ArrowUpRight className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-bold text-green-600">+{entry.deltaScore}%</span>
                        </>
                      ) : entry.deltaScore < 0 ? (
                        <>
                          <ArrowDownRight className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-bold text-red-600">{entry.deltaScore}%</span>
                        </>
                      ) : (
                        <>
                          <Minus className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-bold text-gray-600">0%</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifica miglioramento qualità */}
      <AnimatePresence>
        {showQualityImprovement && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3"
          >
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Qualità del container migliorata!
              </h3>
              <p className="text-sm text-green-600 dark:text-green-400">
                Continua con le ottimizzazioni per migliorare ulteriormente
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cronologia delle modifiche */}
      {qualityHistory.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            📋 Cronologia delle Modifiche
          </h3>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {qualityHistory.slice(1).map((entry, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {entry.action}
                      {entry.itemName && (
                        <span className="text-gray-600 dark:text-gray-400 ml-1">"{entry.itemName}"</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Qualità: {entry.score}%
                  </span>
                  {index > 0 && (
                    <div className="flex items-center gap-1">
                      {entry.score > qualityHistory[index].score ? (
                        <ArrowUpRight className="w-4 h-4 text-green-600" />
                      ) : entry.score < qualityHistory[index].score ? (
                        <ArrowDownRight className="w-4 h-4 text-red-600" />
                      ) : (
                        <Minus className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs di navigazione */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-1 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Contenuto del tab attivo */}
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar con filtri */}
            <div className="lg:w-64 shrink-0 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-6">
              {/* Filtro per tipi */}
              {typesFound.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tipi</h3>
                  {typesFound.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(t)}
                        onChange={() =>
                          setSelectedTypes((prev) =>
                            prev.includes(t) ? prev.filter((p) => p !== t) : [...prev, t]
                          )
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {typeIcons[t] ?? typeIcons.default}
                      <span>{typeLabels[t] ?? t}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Filtri specifici per tag */}
              {activeTab === 'tags' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Potenzialmente eliminabili</h3>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input 
                        type="checkbox" 
                        checked={showUA} 
                        onChange={() => setShowUA(!showUA)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>UA (obsoleti)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showPaused}
                        onChange={() => setShowPaused(!showPaused)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>In pausa</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Problemi di Qualità</h3>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showNaming}
                        onChange={() => setShowNaming(!showNaming)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Naming Issues</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showNoTrigger}
                        onChange={() => setShowNoTrigger(!showNoTrigger)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Senza Trigger</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showConsent}
                        onChange={() => setShowConsent(!showConsent)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Consent mancanti</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sicurezza HTML</h3>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showHtmlSecurityCritical}
                        onChange={() => setShowHtmlSecurityCritical(!showHtmlSecurityCritical)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-red-600">Critici</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showHtmlSecurityMajor}
                        onChange={() => setShowHtmlSecurityMajor(!showHtmlSecurityMajor)}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-orange-600">Maggiori</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showHtmlSecurityMinor}
                        onChange={() => setShowHtmlSecurityMinor(!showHtmlSecurityMinor)}
                        className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                      />
                      <span className="text-yellow-600">Minori</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Filtri specifici per triggers */}
              {activeTab === 'triggers' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Problemi di Qualità</h3>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showTrgAllPages}
                        onChange={() => setShowTrgAllPages(!showTrgAllPages)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>All Pages senza filtri</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showTrgTiming}
                        onChange={() => setShowTrgTiming(!showTrgTiming)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Timing non ottimale</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showTrgUnused}
                        onChange={() => setShowTrgUnused(!showTrgUnused)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Trigger non usati</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showTrgDuplicate}
                        onChange={() => setShowTrgDuplicate(!showTrgDuplicate)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Trigger duplicati</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Filtri specifici per variabili */}
              {activeTab === 'variables' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Extra filtri</h3>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showUnused}
                        onChange={() => setShowUnused(!showUnused)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Variabili non usate</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Problemi di Qualità</h3>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showVarDlv}
                        onChange={() => setShowVarDlv(!showVarDlv)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>DLV senza fallback</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showVarLookup}
                        onChange={() => setShowVarLookup(!showVarLookup)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Lookup senza default</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showVarRegex}
                        onChange={() => setShowVarRegex(!showVarRegex)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Regex malformate</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showVarCss}
                        onChange={() => setShowVarCss(!showVarCss)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Selettori fragili</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showVarJs}
                        onChange={() => setShowVarJs(!showVarJs)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>JS non sicuro</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showVarUnused}
                        onChange={() => setShowVarUnused(!showVarUnused)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Variabili non usate</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <input
                        type="checkbox"
                        checked={showVarDuplicate}
                        onChange={() => setShowVarDuplicate(!showVarDuplicate)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Variabili duplicate</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Reset filtri */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => {
                    setSelectedTypes([]);
                    setShowUA(false);
                    setShowPaused(false);
                    setShowUnused(false);
                    
                    // Reset filtri qualità - Tags
                    setShowNaming(false);
                    setShowNoTrigger(false);
                    setShowConsent(false);
                    setShowHtmlSecurityCritical(false);
                    setShowHtmlSecurityMajor(false);
                    setShowHtmlSecurityMinor(false);
                    
                    // Reset filtri qualità - Triggers
                    setShowTrgAllPages(false);
                    setShowTrgTiming(false);
                    setShowTrgUnused(false);
                    setShowTrgDuplicate(false);
                    
                    // Reset filtri qualità - Variables
                    setShowVarDlv(false);
                    setShowVarLookup(false);
                    setShowVarRegex(false);
                    setShowVarCss(false);
                    setShowVarJs(false);
                    setShowVarUnused(false);
                    setShowVarDuplicate(false);
                  }}
                  className="w-full px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Reset Filtri
                </button>
                {autoFilters.length > 0 && (
                  <button
                    onClick={() => setAutoFilters([])}
                    className="w-full mt-2 px-3 py-2 text-xs text-blue-600 dark:text-blue-300 hover:underline"
                  >
                    Rimuovi filtri automatici
                  </button>
                )}
              </div>
            </div>

            {/* Contenuto principale */}
            <div className="flex-1 space-y-4">
              {/* Barra di ricerca */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder={`Cerca ${activeTab}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Contatore risultati */}
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                <span>
                  {filteredItems.length} di {currentItems.length} {activeTab.slice(0, -1)} trovati
                </span>
                {excludedCount > 0 && (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-100/60 dark:bg-blue-900/40 px-2 py-1 rounded-full">
                    {excludedCount} nascosti dai filtri
                  </span>
                )}
              </div>

              {/* Banner per naming issues */}
              {(() => {
                const namingIssuesCount = getFilteredItems().filter(item => {
                  const itemId = item.tagId || item.triggerId || item.variableId || item.name;
                  const issues = analysis?.issuesIndex?.byId?.[itemId] || [];
                  return issues.some(i => i.categories.includes('naming'));
                }).length;

                if (namingIssuesCount > 0) {
                  return (
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                            <Edit className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <p className="text-gray-800 dark:text-gray-200 font-medium">
                            Abbiamo trovato <span className="font-semibold text-orange-600 dark:text-orange-400">{namingIssuesCount}</span> Naming Issues. Vuoi rinominarli tutti?
                          </p>
                        </div>
                        <button
                          onClick={handleBulkRename}
                          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                          <Edit className="w-4 h-4" />
                          Rinomina tutti
                        </button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Lista elementi */}
              <div className="space-y-3">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nessun {activeTab.slice(0, -1)} trovato con i filtri applicati</p>
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    // Ottieni le issues per questo item
                    const itemId = item.tagId || item.triggerId || item.variableId || item.name;
                    const issues = analysis?.issuesIndex?.byId?.[itemId] || [];

                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {item.name}
                              </h3>
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                                {item.type}
                              </span>
                              {item.paused && (
                                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs rounded-full flex items-center gap-1">
                                  <Pause className="w-3 h-3" />
                                  Pausato
                                </span>
                              )}
                              {activeTab === 'variables' && !usedVarNames.has(item.name) && (
                                <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs rounded-full">
                                  Non Utilizzata
                                </span>
                              )}
                              {activeTab === 'tags' && (item.type === 'ua' || item.type.includes('UA')) && (
                                <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                                  UA Obsoleto
                                </span>
                              )}
                            </div>
                            
                            {/* Badge per issues */}
                            {issues.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {issues.slice(0, 3).map((iss, i) => (
                                  <span
                                    key={i}
                                    title={`${iss.reason}${iss.suggestion ? ' – Suggerimento: ' + iss.suggestion : ''}`}
                                    className={`text-xs px-2 py-0.5 rounded 
                                       ${iss.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                         iss.severity === 'major' ? 'bg-orange-100 text-orange-800' :
                                         'bg-blue-100 text-blue-800'}`}
                                  >
                                    {iss.categories[0].replaceAll('_', ' ')}
                                  </span>
                                ))}
                                {issues.length > 3 && (
                                  <span className="text-xs text-gray-500">+{issues.length - 3}</span>
                                )}
                              </div>
                            )}

                            {item.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Azioni rapide per issues */}
                            <button
                              onClick={() => {
                                const type: 'tag' | 'trigger' | 'variable' = activeTab === 'tags' ? 'tag' : activeTab === 'triggers' ? 'trigger' : 'variable';
                                setDetailsModal({
                                  isOpen: true,
                                  item: item,
                                  itemType: type
                                });
                              }}
                              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title="Visualizza dettagli"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            
                            {issues.some(i => i.categories.includes('naming')) && (
                              <button
                                onClick={() => {
                                  const type: 'tag' | 'trigger' | 'variable' = activeTab === 'tags' ? 'tag' : activeTab === 'triggers' ? 'trigger' : 'variable';
                                  const suggestedName = suggestName(type, item.name, item.type);
                                  
                                  setRenameModal({
                                    isOpen: true,
                                    item: item,
                                    itemType: type,
                                    currentName: item.name,
                                    suggestedName: suggestedName,
                                    newName: suggestedName
                                  });
                                }}
                                className="p-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                title="Rinomina elemento"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleTogglePause(item.name)}
                              className={`p-2 rounded-lg transition-colors ${
                                item.paused
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                                  : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800'
                              }`}
                              title={item.paused ? 'Riprendi' : 'Metti in pausa'}
                            >
                              {item.paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteClick(item)}
                              className="p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                              title="Elimina"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modale di conferma eliminazione */}
      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, item: null, itemType: '', dependencies: [] })}
        onConfirm={handleDeleteConfirm}
        item={deleteModal.item}
        itemType={deleteModal.itemType}
        dependencies={deleteModal.dependencies}
      />

      {/* Modale di rinomina */}
      <RenameModal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal({
          isOpen: false,
          item: null,
          itemType: 'tag',
          currentName: '',
          suggestedName: '',
          newName: ''
        })}
        onConfirm={handleRenameConfirm}
        item={renameModal.item}
        itemType={renameModal.itemType}
        currentName={renameModal.currentName}
        suggestedName={renameModal.suggestedName}
        newName={renameModal.newName}
        setNewName={(name) => setRenameModal(prev => ({ ...prev, newName: name }))}
      />

      {/* Modale di conferma toggle pause */}
      <ToggleModal
        isOpen={toggleModal.isOpen}
        onClose={() => setToggleModal({
          isOpen: false,
          item: null,
          currentPaused: false
        })}
        onConfirm={handleToggleConfirm}
        item={toggleModal.item}
        currentPaused={toggleModal.currentPaused}
      />

      {/* Modale dei dettagli elemento */}
      <DetailsModal
        isOpen={detailsModal.isOpen}
        onClose={() => setDetailsModal({
          isOpen: false,
          item: null,
          itemType: 'tag'
        })}
        item={detailsModal.item}
        itemType={detailsModal.itemType}
      />

      {/* Modale di conferma bulk rename */}
      {bulkRenameModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                <Edit className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Rinomina Tutti i Naming Issues
              </h3>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Stai per rinominare <strong>{bulkRenameModal.totalCount}</strong> {activeTab.slice(0, -1)} con problemi di naming convention.
              Questa azione non può essere annullata.
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Elementi che verranno rinominati:
              </p>
              <div className="space-y-1">
                {bulkRenameModal.items?.slice(0, 5).map((item, index) => {
                  const type: 'tag' | 'trigger' | 'variable' = activeTab === 'tags' ? 'tag' : activeTab === 'triggers' ? 'trigger' : 'variable';
                  const suggestedName = suggestName(type, item.name, item.type);
                  return (
                    <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{item.name}</span>
                      <span className="mx-2">→</span>
                      <span className="text-orange-600 dark:text-orange-400 font-medium">{suggestedName}</span>
                    </div>
                  );
                })}
                {bulkRenameModal.totalCount > 5 && (
                  <div className="text-sm text-gray-500 dark:text-gray-500">
                    ... e altri {bulkRenameModal.totalCount - 5} elementi
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setBulkRenameModal({ isOpen: false, items: null, totalCount: 0 })}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleBulkRenameConfirm}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                Rinomina Tutti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
