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
import { calculateContainerQuality, QualityMetrics } from "../services/containerQualityService";
import { typeIcons } from "../utils/iconMap";
import { typeLabels } from "../utils/typeLabels";
import { getUsedVariableNames } from "../utils/getUsedVariableNames";
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
  if (!isOpen || !item) return null;

  const renderTagDetails = (tag: GTMTag) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Informazioni Base</h4>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Nome:</span> {tag?.name || 'N/A'}</div>
            <div><span className="font-medium">Tipo:</span> {tag?.type || 'N/A'}</div>
            <div><span className="font-medium">ID:</span> {tag?.tagId || 'N/A'}</div>
            <div><span className="font-medium">Stato:</span> 
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                tag?.paused 
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}>
                {tag?.paused ? 'Pausato' : 'Attivo'}
              </span>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Configurazione</h4>
          <div className="space-y-2 text-sm">
            {tag?.firingTriggerId && Array.isArray(tag.firingTriggerId) && tag.firingTriggerId.length > 0 && (
              <div><span className="font-medium">Trigger:</span> {tag.firingTriggerId.join(', ')}</div>
            )}
            {tag?.blockingTriggerId && Array.isArray(tag.blockingTriggerId) && tag.blockingTriggerId.length > 0 && (
              <div><span className="font-medium">Blocking Triggers:</span> {tag.blockingTriggerId.join(', ')}</div>
            )}
            {tag?.priority && (
              <div><span className="font-medium">Priorità:</span> {tag.priority}</div>
            )}
          </div>
        </div>
      </div>

      {tag?.parameter && Array.isArray(tag.parameter) && tag.parameter.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Parametri</h4>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="space-y-2 text-sm">
              {tag.parameter.map((param, index) => (
                <div key={index} className="flex justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{param?.key || 'N/A'}:</span>
                  <span className="text-gray-600 dark:text-gray-400 max-w-xs truncate" title={param?.value || ''}>
                    {param?.value || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tag?.html && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">HTML Code</h4>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto">
              {tag.html}
            </pre>
          </div>
        </div>
      )}
    </div>
  );

  const renderTriggerDetails = (trigger: GTMTrigger) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Informazioni Base</h4>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Nome:</span> {trigger?.name || 'N/A'}</div>
            <div><span className="font-medium">Tipo:</span> {trigger?.type || 'N/A'}</div>
            <div><span className="font-medium">ID:</span> {trigger?.triggerId || 'N/A'}</div>
            <div><span className="font-medium">Stato:</span> 
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                trigger?.paused 
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}>
                {trigger?.paused ? 'Pausato' : 'Attivo'}
              </span>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Configurazione</h4>
          <div className="space-y-2 text-sm">
            {trigger?.autoEventFilter && Array.isArray(trigger.autoEventFilter) && trigger.autoEventFilter.length > 0 && (
              <div><span className="font-medium">Auto Event Filters:</span> {trigger.autoEventFilter.length}</div>
            )}
            {trigger?.customEventFilter && Array.isArray(trigger.customEventFilter) && trigger.customEventFilter.length > 0 && (
              <div><span className="font-medium">Custom Event Filters:</span> {trigger.customEventFilter.length}</div>
            )}
          </div>
        </div>
      </div>

      {trigger?.parameter && Array.isArray(trigger.parameter) && trigger.parameter.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Parametri</h4>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="space-y-2 text-sm">
              {trigger.parameter.map((param, index) => (
                <div key={index} className="flex justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{param?.key || 'N/A'}:</span>
                  <span className="text-gray-600 dark:text-gray-400 max-w-xs truncate" title={param?.value || ''}>
                    {param?.value || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderVariableDetails = (variable: GTMVariable) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Informazioni Base</h4>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Nome:</span> {variable?.name || 'N/A'}</div>
            <div><span className="font-medium">Tipo:</span> {variable?.type || 'N/A'}</div>
            <div><span className="font-medium">ID:</span> {variable?.variableId || 'N/A'}</div>
            <div><span className="font-medium">Stato:</span> 
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                variable?.paused 
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}>
                {variable?.paused ? 'Pausato' : 'Attivo'}
              </span>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Configurazione</h4>
          <div className="space-y-2 text-sm">
            {variable?.format && (
              <div><span className="font-medium">Formato:</span> {variable.format}</div>
            )}
            {variable?.enableBuiltInVariable && (
              <div><span className="font-medium">Built-in:</span> Sì</div>
            )}
          </div>
        </div>
      </div>

      {variable?.parameter && Array.isArray(variable.parameter) && variable.parameter.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Parametri</h4>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="space-y-2 text-sm">
              {variable.parameter.map((param, index) => (
                <div key={index} className="flex justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{param?.key || 'N/A'}:</span>
                  <span className="text-gray-600 dark:text-gray-400 max-w-xs truncate" title={param?.value || ''}>
                    {param?.value || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {itemType === 'tag' && <Tag className="w-6 h-6 text-blue-600" />}
            {itemType === 'trigger' && <Zap className="w-6 h-6 text-yellow-600" />}
            {itemType === 'variable' && <Variable className="w-6 h-6 text-green-600" />}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Dettagli {getItemTypeLabel()}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{item?.name || 'Elemento senza nome'}</h2>
        </div>

        {itemType === 'tag' && item && renderTagDetails(item)}
        {itemType === 'trigger' && item && renderTriggerDetails(item)}
        {itemType === 'variable' && item && renderVariableDetails(item)}

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
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

export default function ContainerManagerPage({}: ContainerManagerPageProps) {
  const { container, setContainer, analysis } = useContainer();
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

  // Gestisci i parametri di navigazione dalla Dashboard
  useEffect(() => {
    if (location.state) {
      const { activeTab: navTab, autoFilter: navFilter } = location.state;
      
      if (navTab && ['tags', 'triggers', 'variables'].includes(navTab)) {
        setActiveTab(navTab as TabType);
      }
      
      if (navFilter) {
        // Applica i filtri appropriati in base al tipo
        switch (navFilter) {
          case 'ua':
            setShowUA(true);
            break;
          case 'paused':
            setShowPaused(true);
            break;
          case 'unused':
            setShowUnused(true);
            break;
          case 'naming':
            setShowNaming(true);
            break;
          case 'no-trigger':
            setShowNoTrigger(true);
            break;
          // Nuovi filtri qualità
          case 'consent':
            setShowConsent(true);
            break;
          case 'html-security-critical':
            setShowHtmlSecurityCritical(true);
            break;
          case 'html-security-major':
            setShowHtmlSecurityMajor(true);
            break;
          case 'html-security-minor':
            setShowHtmlSecurityMinor(true);
            break;
          case 'trg-allpages':
            setShowTrgAllPages(true);
            break;
          case 'trg-timing':
            setShowTrgTiming(true);
            break;
          case 'trg-unused':
            setShowTrgUnused(true);
            break;
          case 'trg-duplicate':
            setShowTrgDuplicate(true);
            break;
          case 'var-dlv':
            setShowVarDlv(true);
            break;
          case 'var-lookup':
            setShowVarLookup(true);
            break;
          case 'var-regex':
            setShowVarRegex(true);
            break;
          case 'var-css':
            setShowVarCss(true);
            break;
          case 'var-js':
            setShowVarJs(true);
            break;
          case 'var-unused':
            setShowVarUnused(true);
            break;
          case 'var-duplicate':
            setShowVarDuplicate(true);
            break;
        }
      }
    }
  }, [location.state]);

  // Calcola la qualità del container quando cambia
  useEffect(() => {
    if (container) {
      const currentQuality = calculateContainerQuality(container);
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
    }
  }, [container, previousQuality, qualityHistory.length]);

  // Salva la qualità precedente per il confronto
  useEffect(() => {
    if (qualityMetrics) {
      setPreviousQuality(qualityMetrics.overallScore);
    }
  }, [qualityMetrics]);

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
    const newContainer = { ...container };
    let itemType: 'tag' | 'trigger' | 'variable' = 'tag';
    
    // Trova il tipo di elemento
    if (container.tag?.find(t => t.name === itemName)) itemType = 'tag';
    else if (container.trigger?.find(t => t.name === itemName)) itemType = 'trigger';
    else if (container.variable?.find(t => t.name === itemName)) itemType = 'variable';

    // Rimuovi l'elemento
    if (newContainer[itemType]) {
      newContainer[itemType] = newContainer[itemType]!.filter(item => item.name !== itemName);
      setContainer(newContainer);
      
      // Registra la modifica nella cronologia
      const newQuality = calculateContainerQuality(newContainer);
      setQualityHistory(prev => [...prev, {
        timestamp: new Date(),
        score: newQuality.overallScore,
        metrics: {
          pausedItems: newQuality.pausedItems,
          unusedItems: newQuality.unusedItems,
          uaItems: newQuality.uaItems,
          namingIssues: newQuality.namingIssues
        },
        action: 'Elemento eliminato',
        itemName: itemName
      }]);
    }
    
    // Chiudi la modale
    setDeleteModal({ isOpen: false, item: null, itemType: '', dependencies: [] });
  };

  const handleRenameConfirm = () => {
    if (!container || !renameModal.item || !renameModal.newName.trim()) return;

    const newContainer = { ...container };
    const itemType = renameModal.itemType;
    const oldName = renameModal.currentName;
    const newName = renameModal.newName.trim();

    // Trova e aggiorna l'elemento
    if (newContainer[itemType]) {
      const index = newContainer[itemType]!.findIndex(item => item.name === oldName);
      if (index !== -1) {
        // Aggiorna il nome
        newContainer[itemType]![index] = {
          ...newContainer[itemType]![index],
          name: newName
        };

        // Aggiorna il container
        setContainer(newContainer);

        // Registra la modifica nella cronologia
        const newQuality = calculateContainerQuality(newContainer);
        setQualityHistory(prev => [...prev, {
          timestamp: new Date(),
          score: newQuality.overallScore,
          metrics: {
            pausedItems: newQuality.pausedItems,
            unusedItems: newQuality.unusedItems,
            uaItems: newQuality.uaItems,
            namingIssues: newQuality.namingIssues
          },
          action: 'Elemento rinominato',
          itemName: `${oldName} → ${newName}`
        }]);
      }
    }

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

    const newContainer = { ...container };
    const itemId = toggleModal.item.name;
    let itemType: 'tag' | 'trigger' | 'variable' = 'tag';
    
    // Trova il tipo di elemento
    if (container.tag?.find(t => t.name === itemId)) itemType = 'tag';
    else if (container.trigger?.find(t => t.name === itemId)) itemType = 'trigger';
    else if (container.variable?.find(t => t.name === itemId)) itemType = 'variable';

    // Toggle dello stato paused
    if (newContainer[itemType]) {
      const item = newContainer[itemType]!.find(i => i.name === itemId);
      if (item) {
        item.paused = !item.paused;
        setContainer(newContainer);
        
        // Registra la modifica nella cronologia
        const newQuality = calculateContainerQuality(newContainer);
        setQualityHistory(prev => [...prev, {
          timestamp: new Date(),
          score: newQuality.overallScore,
          metrics: {
            pausedItems: newQuality.pausedItems,
            unusedItems: newQuality.unusedItems,
            uaItems: newQuality.uaItems,
            namingIssues: newQuality.namingIssues
          },
          action: item.paused ? 'Elemento messo in pausa' : 'Elemento ripreso',
          itemName: itemId
        }]);
      }
    }

    // Chiudi la modale
    setToggleModal({
      isOpen: false,
      item: null,
      currentPaused: false
    });
  };

  const filteredItems = getFilteredItems();

  // Calcola le differenze rispetto alla qualità iniziale
  const getQualityDifference = () => {
    if (!initialQuality || !qualityMetrics) return null;
    
    return {
      score: qualityMetrics.overallScore - initialQuality.overallScore,
      pausedItems: initialQuality.pausedItems - qualityMetrics.pausedItems,
      unusedItems: initialQuality.unusedItems - qualityMetrics.unusedItems,
      uaItems: initialQuality.uaItems - qualityMetrics.uaItems,
      namingIssues: initialQuality.namingIssues - qualityMetrics.namingIssues
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
                    animate={{ width: `${qualityMetrics?.overallScore || 0}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {qualityMetrics?.overallScore || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

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
                  <span className="font-bold text-blue-800 dark:text-blue-200">{initialQuality.overallScore}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700 dark:text-green-300">Qualità Attuale:</span>
                  <span className="font-bold text-green-800 dark:text-green-200">{qualityMetrics.overallScore}%</span>
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
                        style={{ width: `${qualityMetrics.overallScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metriche di qualità con confronto */}
        {qualityMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {qualityMetrics.pausedItems}
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
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {qualityMetrics.unusedItems}
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
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {qualityMetrics.uaItems}
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
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {qualityMetrics.namingIssues}
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
              </div>
            </div>

            {/* Contenuto principale */}
            <div className="flex-1 space-y-4">
              {/* Barra di ricerca e filtri aggiuntivi */}
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
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {filteredItems.length} di {currentItems.length} {activeTab.slice(0, -1)} trovati
              </div>

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
                                  const suggestedName = suggestName(type, item.name);
                                  
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
    </div>
  );
}
