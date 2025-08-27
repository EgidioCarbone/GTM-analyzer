import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  X
} from "lucide-react";
import { useContainer } from "../context/ContainerContext";
import { GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";
import { calculateContainerQuality, QualityMetrics } from "../services/containerQualityService";
import { typeIcons } from "../utils/iconMap";
import { typeLabels } from "../utils/typeLabels";
import { getUsedVariableNames } from "../utils/getUsedVariableNames";

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

export default function ContainerManagerPage({}: ContainerManagerPageProps) {
  const { container, setContainer } = useContainer();
  const [activeTab, setActiveTab] = useState<TabType>('tags');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
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

    // Applica filtri specifici del dropdown
    if (filterType !== 'all') {
      switch (filterType) {
        case 'paused':
          items = items.filter(item => item.paused);
          break;
        case 'unused':
          if (activeTab === 'variables') {
            items = items.filter(item => !usedVarNames.has(item.name));
          }
          break;
        case 'ua':
          items = items.filter(item => 
            item.type.includes('UA') || 
            item.type.includes('Universal') ||
            item.type === 'ua'
          );
          break;
        case 'naming':
          items = items.filter(item => !item.namingConvention);
          break;
      }
    }

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

  const handleTogglePause = (itemId: string) => {
    if (!container) return;

    const newContainer = { ...container };
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
              )}

              {/* Filtri specifici per variabili */}
              {activeTab === 'variables' && (
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
              )}

              {/* Reset filtri */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => {
                    setSelectedTypes([]);
                    setShowUA(false);
                    setShowPaused(false);
                    setShowUnused(false);
                    setFilterType('all');
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
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">Tutti</option>
                  <option value="paused">In Pausa</option>
                  <option value="unused">Non Utilizzati</option>
                  <option value="ua">UA Obsoleti</option>
                  <option value="naming">Naming Issues</option>
                </select>
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
                  filteredItems.map((item) => (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
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
                          {item.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePause(item.name)}
                            className={`p-2 rounded-lg transition-colors ${
                              item.paused
                                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                                : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800'
                            }`}
                            title={item.paused ? 'Riprendi' : 'Metti in pausa'}
                          >
                            {item.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteClick(item)}
                            className="p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
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
    </div>
  );
}
