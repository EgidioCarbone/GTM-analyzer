import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Play,
  Tag,
  PackageSearch,
  CheckCircle,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
  ListChecks,
  Braces,
  RotateCcw,
  PencilLine,
  X,
  Settings2,
} from 'lucide-react';
import { TestSpec, SSDTestState, ModuleConfig, ModuleSource } from '../types/ssd';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useSSDConfig } from '../hooks/useSSDConfig';
import { useAbortController } from '../hooks/useAbortController';
import { useAnalysisProgress } from '../hooks/useAnalysisProgress';
import { notifyError } from '../utils/errorNotification';
import toast from 'react-hot-toast';
import ReviewStep from '../components/ssd/ReviewStep';
import DetailedResultsStep from '../components/ssd/DetailedResultsStep';
import { SSDProgressModal } from '../components/ssd/SSDProgressModal';
import ModuleSelectionStep from '../components/ssd/ModuleSelectionStep';
import ModuleConfigForm from '../components/ssd/ModuleConfigForm';
import type { ModuleId, ModuleScenario, ModuleEventDefinition, ScenarioStep, EventStepType } from '../modules/types';
import type { SSDModule } from '../modules/types';
import { isModuleFieldEmpty } from '../modules/utils';
import { extractExpectedPayloadExpression } from '../../shared/expectedPayload';

const scenarioRunSteps = [
  { id: 'browser_launch', title: 'Avvio Browser', description: 'Inizializzazione del browser Puppeteer...', phase: 'test' },
  { id: 'navigation', title: 'Navigazione', description: 'Caricamento della pagina web...', phase: 'test' },
  { id: 'cookie_consent', title: 'Gestione Cookie', description: 'Accettazione banner e allineamento del consenso...', phase: 'test' },
  { id: 'test_execution', title: 'Esecuzione Test', description: 'Esecuzione delle azioni e verifica delle aspettative...', phase: 'test' },
  { id: 'data_collection', title: 'Raccolta Dati', description: 'Cattura di screenshot e eventi dataLayer...', phase: 'test' },
  { id: 'report_generation', title: 'Generazione Report', description: 'Creazione del report finale...', phase: 'test' },
] as const;

const ensureAbsoluteUrl = (url: string): string => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const trimmed = url.replace(/^\/+/g, '');
  return `https://${trimmed}`;
};

const normalizeModuleUrls = (module?: SSDModule | null): string[] => {
  if (!module) return [];
  const sourceList =
    module.defaultUrls && module.defaultUrls.length > 0
      ? module.defaultUrls
      : module.supportedHosts || [];
  const normalized = sourceList.map(ensureAbsoluteUrl).filter(Boolean) as string[];
  return Array.from(new Set(normalized));
};

const splitInputList = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map(entry => entry.trim())
    .filter(Boolean);

const parseLooseExpectedPayload = (input: string): any | null => {
  const expression = extractExpectedPayloadExpression(input);
  if (!expression) return null;
  const trimmed = expression.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall back to Function evaluation */
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${trimmed});`);
    return fn();
  } catch {
    return null;
  }
};

const validateExpectedPayloadInput = (
  input: string
): { parsed: any | null; error: string | null } => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { parsed: null, error: null };
  }

  const parsed = parseLooseExpectedPayload(trimmed);
  if (parsed == null) {
    return {
      parsed: null,
      error: 'Payload non valido. Inserisci un oggetto JSON oppure lo snippet dataLayer.push completo.',
    };
  }

  return { parsed, error: null };
};

const coerceExpectedPayloadValue = (payload: any): any => {
  if (payload == null) return null;
  if (typeof payload === 'object') return payload;
  if (typeof payload !== 'string') return null;
  return parseLooseExpectedPayload(payload);
};

const findEventDefinition = (
  eventDefinitions: ModuleEventDefinition[],
  eventId: string | null
): ModuleEventDefinition | null => {
  if (!eventId) return null;
  return eventDefinitions.find(event => event.id === eventId) ?? null;
};

const buildScenarioStepsFromDefinition = (
  eventDefinition: ModuleEventDefinition | null,
  config: Record<string, unknown>,
  existingSteps: ScenarioStep[] = []
): ScenarioStep[] => {
  if (!eventDefinition) {
    return (existingSteps ?? []).map((step, index) => ({
      id: step.id || `manual_${index}`,
      type: step.type || 'click',
      label: step.label && step.label.trim().length > 0 ? step.label : `Step ${index + 1}`,
      description: step.description ?? '',
      selector: typeof step.selector === 'string' ? step.selector : '',
      value: typeof step.value === 'string' ? step.value : undefined,
      delayAfterMs: typeof step.delayAfterMs === 'number' ? step.delayAfterMs : 10000,
    }));
  }
  const configClone = { ...(config ?? {}) };
  const existingMap = new Map(existingSteps.map(step => [step.id, step]));

  return eventDefinition.steps.map(stepDef => {
    const existing = existingMap.get(stepDef.id);
    let selector = existing?.selector;
    let value = existing?.value;

    if (stepDef.input?.id) {
      const configuredValue = configClone[stepDef.input.id];

      if (stepDef.input.type === 'selector') {
        if (!selector && typeof configuredValue === 'string') {
          selector = configuredValue;
        }
      } else if (!value && typeof configuredValue === 'string') {
        value = configuredValue;
      }
    }

    const delayAfterMs = typeof (existing as ScenarioStep | undefined)?.delayAfterMs === 'number' ? (existing as ScenarioStep).delayAfterMs : undefined;

    return {
      id: stepDef.id,
      type: stepDef.type,
      label: stepDef.label,
      description: existing?.description ?? stepDef.description ?? '',
      selector,
      value,
      delayAfterMs,
    };
  });
};

const stringifyPayload = (payload: unknown): string => {
  if (payload == null) return '';
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return '';
  }
};

const buildExpectedPayloadString = (
  eventDefinition: ModuleEventDefinition | null,
  payload: unknown
): string => {
  if (payload != null) {
    const str = stringifyPayload(payload);
    if (str) return str;
  }
  if (!eventDefinition?.expectationTemplate?.payloadTemplate) {
    return '';
  }
  return stringifyPayload(eventDefinition.expectationTemplate.payloadTemplate);
};

const extractEventNameFromPayload = (payload: any): string => {
  const value = coerceExpectedPayloadValue(payload);
  if (value && typeof value === 'object' && typeof (value as any).event === 'string') {
    const eventValue = (value as any).event.trim();
    return eventValue;
  }
  return '';
};

const STEP_TYPE_META: Record<EventStepType, { label: string; badgeClass: string }> = {
  navigate: { label: 'Navigazione', badgeClass: 'bg-sky-100 text-sky-700' },
  click: { label: 'Interazione', badgeClass: 'bg-emerald-100 text-emerald-700' },
  custom: { label: 'Verifica', badgeClass: 'bg-purple-100 text-purple-700' },
};

type ScenarioDraft = {
  id: string | null;
  name: string;
  eventId: string | null;
  url: string;
  config: Record<string, unknown>;
  steps: ScenarioStep[];
  expectedPayload: string;
  expectedPayloadError: string | null;
};

type ModuleBuilderDraft = {
  title: string;
  description: string;
  supportedHosts: string;
  defaultUrls: string;
  tags: string;
  accentColor: string;
  icon: string;
};

const MODULE_BUILDER_DEFAULT: ModuleBuilderDraft = {
  title: '',
  description: '',
  supportedHosts: '',
  defaultUrls: '',
  tags: '',
  accentColor: '#6366f1',
  icon: 'ShieldCheck',
};

const MODULE_ICON_OPTIONS = [
  { value: 'ShieldCheck', label: 'Shield Check' },
  { value: 'Shield', label: 'Shield' },
  { value: 'Antenna', label: 'Antenna' },
  { value: 'Sparkles', label: 'Sparkles' },
  { value: 'Layers', label: 'Layers' },
  { value: 'Rocket', label: 'Rocket' },
] as const;

const createInitialState = (
  moduleId: ModuleId | null = null,
  moduleConfig: ModuleConfig = {},
  defaultUrls: string[] = []
): SSDTestState => ({
  currentStep: 'module',
  moduleId,
  moduleConfig: { ...moduleConfig },
  moduleSource: null,
  url: defaultUrls[0] || '',
  pdfFile: null,
  dsl: null,
  pdfContent: null,
  report: null,
  isLoading: false,
  error: null,
  moduleSettings: null,
  scenarios: [],
  eventDefinitions: [],
  scenarioId: null,
  scenarioName: '',
  scenarioEventId: null,
  scenarioUrl: defaultUrls[0] || '',
  scenarioConfig: {},
  scenarioSteps: [],
  scenarioExpectedPayload: '',
  scenarioExpectedPayloadError: null,
});

const normalizeUrl = (input: string): string => {
  if (!input || typeof input !== 'string') return input;

  let candidate = input.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    return url.toString();
  } catch {
    return input;
  }
};

const toValidUrl = (input: string): string | null => {
  if (!input) return null;
  const normalized = normalizeUrl(input);
  try {
    const url = new URL(normalized);
    return url.toString();
  } catch {
    return null;
  }
};

export default function SSDTestPage() {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE ||
    (window.location.origin === 'http://localhost:5173' ? 'http://localhost:3001' : '');
  const [state, setState] = useState<SSDTestState>(() => createInitialState());
  const [loadingType, setLoadingType] = useState<'pdf' | 'test' | null>(null);
  const [editableDsl, setEditableDsl] = useState<string>('');
  const [isEditingDsl, setIsEditingDsl] = useState(false);
  const [dslValidationError, setDslValidationError] = useState<string | null>(null);
  const [originalDsl, setOriginalDsl] = useState<TestSpec | null>(null);
  const [isScenarioModalOpen, setScenarioModalOpen] = useState(false);
  const [scenarioModalMode, setScenarioModalMode] = useState<'create' | 'edit'>('create');
  const [scenarioDraft, setScenarioDraft] = useState<ScenarioDraft | null>(null);
  const [scenarioModalSaving, setScenarioModalSaving] = useState(false);
  const [deleteDialogScenario, setDeleteDialogScenario] = useState<ModuleScenario | null>(null);
  const [deleteDialogLoading, setDeleteDialogLoading] = useState(false);
  const [isCmpModalOpen, setCmpModalOpen] = useState(false);
  const [cmpForm, setCmpForm] = useState({ selector: '', testUrl: '', vendor: '' });
  const [cmpModalSaving, setCmpModalSaving] = useState(false);
  const [cmpModalError, setCmpModalError] = useState<string | null>(null);
  const [modules, setModules] = useState<SSDModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [isModuleBuilderOpen, setModuleBuilderOpen] = useState(false);
  const [moduleBuilderDraft, setModuleBuilderDraft] = useState<ModuleBuilderDraft>({ ...MODULE_BUILDER_DEFAULT });
  const [moduleBuilderSaving, setModuleBuilderSaving] = useState(false);
  const [moduleBuilderError, setModuleBuilderError] = useState<string | null>(null);
  const draftExpectedEventName = useMemo(() => {
    if (!scenarioDraft) return '';
    try {
      return extractEventNameFromPayload(scenarioDraft.expectedPayload);
    } catch {
      return '';
    }
  }, [scenarioDraft]);

  const selectedModule = state.moduleId ? modules.find(module => module.meta.id === state.moduleId) : undefined;
  const moduleUrlOptions = useMemo(() => normalizeModuleUrls(selectedModule), [selectedModule]);
  const selectedScenarioDetails = useMemo(
    () => state.scenarios.find(s => s.id === state.scenarioId) ?? null,
    [state.scenarios, state.scenarioId]
  );
  const manualScenarioEventName = useMemo(() => {
    if (!selectedScenarioDetails || selectedScenarioDetails.eventId !== 'manual') return '';
    return extractEventNameFromPayload(selectedScenarioDetails.expectedPayload);
  }, [selectedScenarioDetails]);
  const cmpStatus = state.moduleSettings?.cmp ?? null;
  const cmpReady = cmpStatus?.lastValidation?.status === 'ACCEPTED';
  const formatDateTime = useCallback((value?: string | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return value;
    }
  }, []);
  const draftEventDefinition = useMemo(
    () => (scenarioDraft ? findEventDefinition(state.eventDefinitions, scenarioDraft.eventId) : null),
    [scenarioDraft, state.eventDefinitions]
  );
  const draftConfigInputs = draftEventDefinition?.inputs?.filter(input => input.id != 'url') ?? [];

  useEffect(() => {
    if (!selectedModule) return;

    setState(prev => {
      if (!prev.moduleId || prev.moduleId !== selectedModule.meta.id) {
        return prev;
      }

      const defaults = selectedModule.defaultConfig ?? {};
      let merged: ModuleConfig = {
        ...defaults,
        ...prev.moduleConfig,
      };

      let changed = false;

      for (const field of selectedModule.configFields) {
        if (merged[field.id] === undefined && field.defaultValue !== undefined) {
          merged = {
            ...merged,
            [field.id]: field.defaultValue,
          };
          changed = true;
        }
      }

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        moduleConfig: merged,
      };
    });
  }, [selectedModule]);

  const getMissingRequiredConfig = useCallback((): string[] => {
    if (!selectedModule) return [];
    const config = state.moduleConfig ?? {};

    return selectedModule.configFields
      .filter(field => field.required && isModuleFieldEmpty(field, config[field.id]))
      .map(field => field.label);
  }, [selectedModule, state.moduleConfig]);

  const handleScenarioStateReset = useCallback(() => {
    setEditableDsl('');
    setIsEditingDsl(false);
    setDslValidationError(null);
    setOriginalDsl(null);
  }, []);

  const handleModuleSelect = useCallback(
    (module: SSDModule) => {
      const defaultConfig = module.defaultConfig ?? {};
      const moduleUrls = normalizeModuleUrls(module);
      const initialState = createInitialState(module.meta.id, defaultConfig, moduleUrls);
      setState(initialState);
      handleScenarioStateReset();
    },
    [handleScenarioStateReset]
  );

  const openModuleBuilder = useCallback(() => {
    setModuleBuilderDraft({ ...MODULE_BUILDER_DEFAULT });
    setModuleBuilderError(null);
    setModuleBuilderOpen(true);
  }, []);

  const closeModuleBuilder = useCallback(() => {
    if (moduleBuilderSaving) return;
    setModuleBuilderOpen(false);
    setModuleBuilderError(null);
  }, [moduleBuilderSaving]);

  const handleModuleBuilderFieldChange = useCallback((field: keyof ModuleBuilderDraft, value: string) => {
    setModuleBuilderDraft(prev => ({ ...prev, [field]: value }));
    setModuleBuilderError(null);
  }, []);

  const handleModuleBuilderSave = useCallback(async () => {
    const title = moduleBuilderDraft.title.trim();
    if (!title) {
      setModuleBuilderError('Inserisci un nome per il modulo');
      return;
    }

    const description = moduleBuilderDraft.description.trim();
    if (!description) {
      setModuleBuilderError('Inserisci una descrizione per il modulo');
      return;
    }

    const normalizedUrls = Array.from(
      new Set(
        splitInputList(moduleBuilderDraft.defaultUrls)
          .map(entry => toValidUrl(entry))
          .filter((url): url is string => Boolean(url))
      )
    );
    if (normalizedUrls.length === 0) {
      setModuleBuilderError('Inserisci almeno un URL valido (uno per linea o separati da virgola).');
      return;
    }

    const payload = {
      title,
      description,
      tags: moduleBuilderDraft.tags,
      accentColor: moduleBuilderDraft.accentColor,
      icon: moduleBuilderDraft.icon,
      supportedHosts: splitInputList(moduleBuilderDraft.supportedHosts),
      defaultUrls: normalizedUrls,
    };

    setModuleBuilderSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Impossibile creare il modulo');
      }
      const created: SSDModule = data.module;
      setModules(prev => {
        const filtered = prev.filter(module => module.meta.id !== created.meta.id);
        const next = [...filtered, created];
        next.sort((a, b) => a.meta.title.localeCompare(b.meta.title, 'it', { sensitivity: 'base' }));
        return next;
      });
      toast.success(`Modulo "${created.meta.title}" creato`);
      setModuleBuilderOpen(false);
      setModuleBuilderError(null);
      setModuleBuilderDraft({ ...MODULE_BUILDER_DEFAULT });
      handleModuleSelect(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      setModuleBuilderError(message);
      notifyError(error, 'Impossibile creare il modulo');
    } finally {
      setModuleBuilderSaving(false);
    }
  }, [apiBaseUrl, handleModuleSelect, moduleBuilderDraft]);

  const ensureCmpConfigured = useCallback(() => {
    if (cmpReady) {
      return true;
    }
    toast.error('Configura e verifica la CMP del modulo prima di lavorare sugli scenari');
    return false;
  }, [cmpReady]);

  const { config: ssdConfig, loading: configLoading, error: configError } = useSSDConfig(apiBaseUrl);

  const { createNewController, abortCurrentRequest } = useAbortController();
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

  const loadModules = useCallback(async () => {
    setModulesLoading(true);
    setModulesError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/modules`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Impossibile caricare i moduli disponibili');
      }
      const fetched: SSDModule[] = Array.isArray(data.modules) ? data.modules : [];
      fetched.sort((a, b) => a.meta.title.localeCompare(b.meta.title, 'it', { sensitivity: 'base' }));
      setModules(fetched);
      setState(prev => {
        if (!prev.moduleId) return prev;
        if (fetched.some(module => module.meta.id === prev.moduleId)) {
          return prev;
        }
        return createInitialState();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      setModulesError(message);
      notifyError(error, 'Impossibile caricare i moduli disponibili');
    } finally {
      setModulesLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => () => abortCurrentRequest(), [state.currentStep, abortCurrentRequest]);
  useEffect(() => {
    loadModules();
  }, [loadModules]);

  const fetchModuleEvents = useCallback(async (moduleId: ModuleId): Promise<ModuleEventDefinition[]> => {
    const res = await fetch(`${apiBaseUrl}/api/modules/${moduleId}/events`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Unable to load events for module ${moduleId}`);
    }
    const data = await res.json();
    return data.events ?? [];
  }, [apiBaseUrl]);

  const fetchModuleScenarios = useCallback(async (moduleId: ModuleId): Promise<ModuleScenario[]> => {
    const res = await fetch(`${apiBaseUrl}/api/modules/${moduleId}/scenarios`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Unable to load scenarios for module ${moduleId}`);
    }
    const data = await res.json();
    return data.scenarios ?? [];
  }, [apiBaseUrl]);

  const fetchModuleSettings = useCallback(async (moduleId: ModuleId) => {
    const res = await fetch(`${apiBaseUrl}/api/modules/${moduleId}/settings`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Unable to load settings for module ${moduleId}`);
    }
    const data = await res.json();
    return data.settings ?? null;
  }, [apiBaseUrl]);

  const loadModuleData = useCallback(async (moduleId: ModuleId, moduleUrls: string[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    handleScenarioStateReset();

    try {
      const [events, scenarios, settings] = await Promise.all([
        fetchModuleEvents(moduleId),
        fetchModuleScenarios(moduleId),
        fetchModuleSettings(moduleId),
      ]);

      const defaultUrl = moduleUrls[0] || '';
      const firstScenario = scenarios[0] ?? null;
      const fallbackEventId = firstScenario?.eventId ?? null;
      const fallbackEventDefinition = findEventDefinition(events, fallbackEventId);
      const scenarioConfig = firstScenario?.config ?? {};
      const scenarioSteps = buildScenarioStepsFromDefinition(
        fallbackEventDefinition,
        scenarioConfig,
        firstScenario?.steps ?? []
      );
      const expectedPayloadString = buildExpectedPayloadString(
        fallbackEventDefinition,
        firstScenario?.expectedPayload ?? null
      );

      setState(prev => ({
        ...prev,
        isLoading: false,
        currentStep: 'scenario',
        moduleSettings: settings,
        eventDefinitions: events,
        scenarios,
        scenarioId: firstScenario?.id ?? null,
        scenarioName: firstScenario?.name ?? '',
        scenarioEventId: fallbackEventId,
        scenarioUrl: firstScenario?.url ?? defaultUrl,
        url: firstScenario?.url ?? defaultUrl,
        scenarioConfig,
        scenarioSteps,
        scenarioExpectedPayload: expectedPayloadString,
        scenarioExpectedPayloadError: null,
        dsl: null,
        pdfContent: null,
        report: null,
        moduleSource: null,
      }));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      notifyError(error, 'Impossibile caricare gli scenari del modulo selezionato');
    }
  }, [fetchModuleEvents, fetchModuleScenarios, fetchModuleSettings, handleScenarioStateReset]);

  const handleModuleProceed = () => {
    if (!state.moduleId) {
      toast.error('Seleziona un modulo per continuare');
      return;
    }

    const missingConfigFields = getMissingRequiredConfig();
    if (missingConfigFields.length > 0) {
      toast.error(
        <div className="space-y-1">
          <div className="font-semibold">Configura tutti i campi obbligatori</div>
          <div className="text-sm">Completa: {missingConfigFields.join(', ')}</div>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    loadModuleData(state.moduleId, moduleUrlOptions);
  };

  const handleChangeModule = () => {
    setState(createInitialState());
    setLoadingType(null);
    handleScenarioStateReset();
    hideAnalysis();
  };

  const handleModuleConfigChange = useCallback((nextConfig: ModuleConfig) => {
    setState(prev => ({
      ...prev,
      moduleConfig: nextConfig,
    }));
  }, []);



  const handleSelectScenario = useCallback(
    (scenarioId: string) => {
      setState(prev => {
        const scenario = prev.scenarios.find(s => s.id === scenarioId) ?? null;
        if (!scenario) {
          return prev;
        }

        handleScenarioStateReset();
        const eventDefinition = findEventDefinition(prev.eventDefinitions, scenario.eventId);
        return {
          ...prev,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          scenarioEventId: scenario.eventId,
          scenarioUrl: scenario.url,
          url: scenario.url,
          scenarioConfig: scenario.config ?? {},
          scenarioSteps: buildScenarioStepsFromDefinition(
            eventDefinition,
            scenario.config ?? {},
            scenario.steps ?? []
          ),
          scenarioExpectedPayload: buildExpectedPayloadString(
            eventDefinition,
            scenario.expectedPayload ?? null
          ),
          scenarioExpectedPayloadError: null,
          dsl: null,
          pdfContent: null,
          report: null,
          moduleSource: null,
        };
      });
    },
    [handleScenarioStateReset]
  );

  const buildDraftFromScenario = useCallback(
    (scenario: ModuleScenario | null): ScenarioDraft => {
      const targetEventId = scenario?.eventId ?? 'manual';
      const eventDefinition = targetEventId ? findEventDefinition(state.eventDefinitions, targetEventId) : null;
      const defaultUrl = moduleUrlOptions[0] || state.scenarioUrl || '';

      return {
        id: scenario?.id ?? null,
        name: scenario?.name ?? '',
        eventId: targetEventId,
        url: scenario?.url ?? defaultUrl,
        config: scenario?.config ?? {},
        steps: buildScenarioStepsFromDefinition(
          eventDefinition,
          scenario?.config ?? {},
          scenario?.steps ?? []
        ),
        expectedPayload: buildExpectedPayloadString(
          eventDefinition,
          scenario?.expectedPayload ?? null
        ),
        expectedPayloadError: null,
      };
    },
    [moduleUrlOptions, state.eventDefinitions, state.scenarioUrl]
  );

  const openScenarioModal = useCallback(
    (mode: 'create' | 'edit') => {
      const baseScenario =
        mode === 'edit'
          ? state.scenarios.find(s => s.id === state.scenarioId) ?? null
          : null;

      if (mode === 'edit' && !baseScenario) {
        toast.error('Seleziona uno scenario da modificare');
        return;
      }

      const draft = buildDraftFromScenario(baseScenario);
      setScenarioDraft(draft);
      setScenarioModalMode(mode);
      setScenarioModalOpen(true);
    },
    [buildDraftFromScenario, state.scenarioId, state.scenarios]
  );

  const closeScenarioModal = () => {
    setScenarioModalOpen(false);
    setScenarioDraft(null);
    setScenarioModalSaving(false);
  };

  const updateScenarioDraft = useCallback((updater: (draft: ScenarioDraft) => ScenarioDraft) => {
    setScenarioDraft(prev => (prev ? updater(prev) : prev));
  }, []);

  const handleDraftNameChange = (value: string) => {
    updateScenarioDraft(draft => ({ ...draft, name: value }));
  };



  const handleDraftUrlChange = (value: string) => {
    updateScenarioDraft(draft => ({ ...draft, url: value }));
  };

  const handleDraftConfigChange = (key: string, value: string) => {
    updateScenarioDraft(draft => {
      const eventDefinition = findEventDefinition(state.eventDefinitions, draft.eventId);
      const updatedSteps = draft.steps.map(step => {
        const stepDefinition = eventDefinition?.steps.find(def => def.id === step.id);
        if (!stepDefinition?.input || stepDefinition.input.id !== key) {
          return step;
        }
        if (stepDefinition.input.type === 'selector') {
          return { ...step, selector: value };
        }
        return { ...step, value };
      });

      return {
        ...draft,
        config: {
          ...draft.config,
          [key]: value,
        },
        steps: updatedSteps,
      };
    });
  };

  const handleDraftAddClickStep = () => {
    updateScenarioDraft(draft => {
      const nextIndex = draft.steps.length + 1;
      const newStep: ScenarioStep = {
        id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'click',
        label: `Step ${nextIndex}`,
        selector: '',
        delayAfterMs: 10000,
      };
      return {
        ...draft,
        steps: [...draft.steps, newStep],
      };
    });
  };

  const openCmpModal = useCallback(() => {
    console.log('[SSD][CMP] openCmpModal click', {
      moduleId: state.moduleId,
      hasSettings: !!state.moduleSettings,
      cmpStatus: state.moduleSettings?.cmp,
    });
    if (!state.moduleId) {
      toast.error('Seleziona un modulo');
      return;
    }
    const defaultUrl =
      state.moduleSettings?.cmp?.testUrl || state.scenarioUrl || moduleUrlOptions[0] || '';
    setCmpForm({
      selector: state.moduleSettings?.cmp?.selector ?? '',
      testUrl: defaultUrl,
      vendor: state.moduleSettings?.cmp?.vendor ?? '',
    });
    setCmpModalError(null);
    setCmpModalOpen(true);
  }, [state.moduleId, state.moduleSettings, state.scenarioUrl, moduleUrlOptions]);

  const closeCmpModal = () => {
    if (cmpModalSaving) return;
    setCmpModalOpen(false);
    setCmpModalError(null);
  };

  const handleCmpFieldChange = (field: keyof typeof cmpForm, value: string) => {
    setCmpForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCmpValidate = async () => {
    if (!state.moduleId) {
      toast.error('Seleziona un modulo');
      return;
    }
    if (!cmpForm.selector.trim()) {
      setCmpModalError('Inserisci un selettore valido per il bottone di accettazione.');
      return;
    }
    if (!cmpForm.testUrl.trim()) {
      setCmpModalError('Specifica l’URL da utilizzare per il test della CMP.');
      return;
    }
    setCmpModalSaving(true);
    setCmpModalError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/modules/${state.moduleId}/cmp/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selector: cmpForm.selector.trim(),
          testUrl: cmpForm.testUrl.trim(),
          vendor: cmpForm.vendor.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Impossibile validare la CMP');
      }
      setState(prev => ({
        ...prev,
        moduleSettings: data.settings ?? prev.moduleSettings,
      }));
      const status = data.settings?.cmp?.lastValidation?.status;
      if (status === 'ACCEPTED') {
        toast.success('CMP validata con successo');
        setCmpModalOpen(false);
      } else {
        toast.error('La CMP non risulta ancora accettata');
        setCmpModalError(
          data.validation?.reasoning ||
            data.settings?.cmp?.lastValidation?.reasoning ||
            'Il sistema non ha rilevato l’accettazione dei cookie.'
        );
      }
    } catch (error) {
      setCmpModalError(error instanceof Error ? error.message : 'Errore inatteso durante la validazione');
    } finally {
      setCmpModalSaving(false);
    }
  };

  const handleDraftRemoveStep = (stepId: string) => {
    updateScenarioDraft(draft => {
      const filtered = draft.steps.filter(step => step.id !== stepId);
      const resequenced = filtered.map((step, index) => ({
        ...step,
        label: step.label && step.label.trim().length > 0 ? step.label : `Step ${index + 1}`,
      }));
      return {
        ...draft,
        steps: resequenced,
      };
    });
  };

  const handleDraftStepInputChange = (stepId: string, field: 'selector' | 'value', value: string) => {
    updateScenarioDraft(draft => {
      const eventDefinition = findEventDefinition(state.eventDefinitions, draft.eventId);
      const stepDefinition = eventDefinition?.steps.find(def => def.id === stepId);
      const updatedSteps = draft.steps.map(step =>
        step.id === stepId ? { ...step, [field]: value } : step
      );

      let updatedConfig = draft.config;
      if (stepDefinition?.input?.id) {
        updatedConfig = {
          ...draft.config,
          [stepDefinition.input.id]: value,
        };
      }

      return {
        ...draft,
        steps: updatedSteps,
        config: updatedConfig,
      };
    });
  };

  const handleDraftResetSteps = () => {
    updateScenarioDraft(draft => {
      const eventDefinition = findEventDefinition(state.eventDefinitions, draft.eventId);
      if (!eventDefinition) {
        return { ...draft, steps: [] };
      }
      return {
        ...draft,
        steps: buildScenarioStepsFromDefinition(
          eventDefinition,
          draft.config ?? {},
          []
        ),
      };
    });
  };

  const handleDraftExpectedPayloadChange = (value: string) => {
    updateScenarioDraft(draft => {
      const { error } = validateExpectedPayloadInput(value);
      return {
        ...draft,
        expectedPayload: value,
        expectedPayloadError: error,
      };
    });
  };

  const handleDraftResetPayload = () => {
    updateScenarioDraft(draft => {
      const eventDefinition = findEventDefinition(state.eventDefinitions, draft.eventId);
      return {
        ...draft,
        expectedPayload: buildExpectedPayloadString(eventDefinition, null),
        expectedPayloadError: null,
      };
    });
  };

  const handleDraftFormatPayload = () => {
    if (!scenarioDraft) return;
    const source = scenarioDraft.expectedPayload;
    if (!source.trim()) return;

    const { parsed, error } = validateExpectedPayloadInput(source);
    if (error || parsed == null) {
      updateScenarioDraft(draft => ({
        ...draft,
        expectedPayloadError: error,
      }));
      toast.error('Payload non valido, impossibile formattare');
      return;
    }

    const formatted = JSON.stringify(parsed, null, 2);
    updateScenarioDraft(draft => ({
      ...draft,
      expectedPayload: formatted,
      expectedPayloadError: null,
    }));
  };

const persistScenarioDraft = useCallback(
  async (draft: ScenarioDraft): Promise<ModuleScenario | null> => {
    if (!state.moduleId) {
      toast.error('Seleziona prima un modulo');
      return null;
    }

    const name = draft.name.trim();
    if (!name) {
      toast.error('Inserisci un nome per lo scenario');
      return null;
    }

    const normalizedUrl = normalizeUrl(draft.url);
    if (!normalizedUrl) {
      toast.error('Inserisci un URL valido per lo scenario');
      return null;
    }

    const { parsed: parsedExpectedPayload, error: payloadError } = validateExpectedPayloadInput(
      draft.expectedPayload
    );
    if (payloadError) {
      updateScenarioDraft(prev => ({
        ...prev,
        expectedPayloadError: payloadError,
      }));
      toast.error('Correggi il payload atteso prima di salvare');
      return null;
    }

    const eventDefinitionForDraft =
      draft.eventId && draft.eventId !== 'manual'
        ? findEventDefinition(state.eventDefinitions, draft.eventId)
        : null;

    const sanitizedSteps: ScenarioStep[] = (draft.steps ?? []).map((step, index) => {
      const selector = typeof step.selector === 'string' ? step.selector.trim() : '';
      const value = typeof step.value === 'string' ? step.value.trim() : undefined;
      const label =
        typeof step.label === 'string' && step.label.trim().length > 0
          ? step.label.trim()
          : `Step ${index + 1}`;

      return {
        ...step,
        label,
        selector: selector.length > 0 ? selector : undefined,
        value,
        delayAfterMs: typeof step.delayAfterMs === 'number' ? step.delayAfterMs : 10000,
      };
    });

    if (!eventDefinitionForDraft && sanitizedSteps.some(step => step.selector === undefined)) {
      toast.error('Ogni step deve includere un selettore CSS valido');
      return null;
    }

    const normalizedConfig = Object.entries(draft.config ?? {}).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        if (typeof value === 'string') {
          acc[key] = value.trim();
        } else {
          acc[key] = value;
        }
        return acc;
      },
      {}
    );

    const eventId = eventDefinitionForDraft ? draft.eventId! : 'manual';

    const payload = {
      name,
      eventId,
      url: normalizedUrl,
      config: normalizedConfig,
      steps: sanitizedSteps,
      expectedPayload: parsedExpectedPayload ?? null,
    };

    setScenarioModalSaving(true);

    try {
      let scenario: ModuleScenario;
      if (draft.id) {
        const res = await fetch(
          `${apiBaseUrl}/api/modules/${state.moduleId}/scenarios/${draft.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.error || 'Impossibile aggiornare lo scenario');
        }
        const data = await res.json();
        scenario = data.scenario;
      } else {
        const res = await fetch(`${apiBaseUrl}/api/modules/${state.moduleId}/scenarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.error || 'Impossibile creare lo scenario');
        }
        const data = await res.json();
        scenario = data.scenario;
      }

      setState(prev => {
        const others = prev.scenarios.filter(item => item.id !== scenario.id);
        const updated = [...others, scenario].sort((a, b) => a.name.localeCompare(b.name));
        const eventDefinition = findEventDefinition(prev.eventDefinitions, scenario.eventId);
        return {
          ...prev,
          scenarios: updated,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          scenarioEventId: scenario.eventId,
          scenarioUrl: scenario.url,
          url: scenario.url,
          scenarioConfig: scenario.config ?? {},
          scenarioSteps: buildScenarioStepsFromDefinition(
            eventDefinition,
            scenario.config ?? {},
            scenario.steps ?? []
          ),
          scenarioExpectedPayload: buildExpectedPayloadString(
            eventDefinition,
            scenario.expectedPayload ?? null
          ),
          scenarioExpectedPayloadError: null,
        };
      });

      handleScenarioStateReset();
      toast.success(draft.id ? 'Scenario aggiornato' : 'Scenario creato');
      closeScenarioModal();
      return scenario;
    } catch (error) {
      notifyError(error, 'Errore durante il salvataggio dello scenario');
      return null;
    } finally {
      setScenarioModalSaving(false);
    }
  },
  [apiBaseUrl, state.moduleId, handleScenarioStateReset, updateScenarioDraft]
);

  const handleScenarioModalSave = async () => {
    if (!ensureCmpConfigured()) return;
    if (!scenarioDraft) return;
    await persistScenarioDraft(scenarioDraft);
  };

  const handleScenarioCreate = () => {
    if (!ensureCmpConfigured()) return;
    openScenarioModal('create');
  };
  const handleScenarioEdit = () => {
    if (!ensureCmpConfigured()) return;
    openScenarioModal('edit');
  };

  const requestDeleteScenario = () => {
    if (!ensureCmpConfigured()) return;
    if (!state.scenarioId) {
      toast.error('Seleziona uno scenario da eliminare');
      return;
    }

    const scenario = state.scenarios.find(s => s.id === state.scenarioId);
    if (!scenario) {
      toast.error('Scenario selezionato non trovato');
      return;
    }

    setDeleteDialogScenario(scenario);
  };

  const handleDeleteScenario = async () => {
    if (!ensureCmpConfigured()) return;
    if (!deleteDialogScenario) return;

    const moduleIdForScenario = deleteDialogScenario.moduleId ?? state.moduleId;
    if (!moduleIdForScenario) {
      toast.error('Impossibile determinare il modulo dello scenario');
      setDeleteDialogScenario(null);
      return;
    }

    try {
      setDeleteDialogLoading(true);
      const res = await fetch(`${apiBaseUrl}/api/modules/${moduleIdForScenario}/scenarios/${deleteDialogScenario.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Impossibile eliminare lo scenario');
      }

      setState(prev => {
        const remaining = prev.scenarios.filter(s => s.id !== deleteDialogScenario.id);
        const defaultUrl = moduleUrlOptions[0] || '';
        const firstScenario = remaining[0] ?? null;
        const fallbackEventId = firstScenario?.eventId ?? prev.eventDefinitions[0]?.id ?? null;
        const eventDefinition = findEventDefinition(prev.eventDefinitions, fallbackEventId);
        return {
          ...prev,
          scenarios: remaining,
          scenarioId: firstScenario?.id ?? null,
          scenarioName: firstScenario?.name ?? '',
          scenarioEventId: fallbackEventId,
          scenarioUrl: firstScenario?.url ?? defaultUrl,
          url: firstScenario?.url ?? defaultUrl,
          scenarioConfig: firstScenario?.config ?? {},
          scenarioSteps: buildScenarioStepsFromDefinition(
            eventDefinition,
            firstScenario?.config ?? {},
            firstScenario?.steps ?? []
          ),
          scenarioExpectedPayload: buildExpectedPayloadString(
            eventDefinition,
            firstScenario?.expectedPayload ?? null
          ),
          scenarioExpectedPayloadError: null,
          dsl: null,
          pdfContent: null,
          report: null,
          moduleSource: null,
          isLoading: false,
        };
      });
      handleScenarioStateReset();
      toast.success('Scenario eliminato');
    } catch (error) {
      notifyError(error, "Errore durante l'eliminazione dello scenario");
    }
    setDeleteDialogScenario(null);
    setDeleteDialogLoading(false);
  };

  const handleGenerateScenarioDsl = async () => {
    if (!state.moduleId) {
      toast.error('Seleziona prima un modulo');
      return;
    }
    if (!ensureCmpConfigured()) return;

    if (!state.scenarioId) {
      toast.error('Crea o seleziona uno scenario prima di generare la DSL');
      return;
    }

    const scenario = state.scenarios.find(s => s.id === state.scenarioId);
    if (!scenario) {
      toast.error('Scenario selezionato non trovato');
      return;
    }

    setLoadingType('pdf');
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch(`${apiBaseUrl}/api/modules/${scenario.moduleId}/scenarios/${scenario.id}/build`, {
        method: 'POST',
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Impossibile generare la DSL per lo scenario');
      }
      const data = await res.json();
      const dsl = data.dsl;

      setEditableDsl(JSON.stringify(dsl, null, 2));
      setOriginalDsl(dsl);
      setState(prev => ({
        ...prev,
        dsl,
        pdfContent: '',
        moduleSource: 'scenario',
        currentStep: 'review',
        isLoading: false,
        url: scenario.url,
      }));
      toast.success('DSL generata dallo scenario');
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      notifyError(error, 'Errore durante la generazione della DSL');
    } finally {
      setLoadingType(null);
    }
  };

  const handleDslEdit = (value: string) => {
    setEditableDsl(value);
    try {
      const parsed = JSON.parse(value);
      if (!parsed.site || !parsed.tests || !Array.isArray(parsed.tests)) {
        setDslValidationError('DSL non valida: mancano campi obbligatori');
      } else {
        setDslValidationError(null);
      }
    } catch (error) {
      setDslValidationError(`JSON non valido: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  };

  const handleSaveDsl = () => {
    try {
      const parsed = JSON.parse(editableDsl);
      setState(prev => ({ ...prev, dsl: parsed }));
      setIsEditingDsl(false);
      toast.success('DSL aggiornata');
    } catch (error) {
      toast.error(`DSL non valida: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  };

  const handleResetDsl = () => {
    if (originalDsl) {
      setEditableDsl(JSON.stringify(originalDsl, null, 2));
      setState(prev => ({ ...prev, dsl: originalDsl }));
      setIsEditingDsl(false);
      setDslValidationError(null);
      toast.success('DSL ripristinata');
    }
  };

  const handleReset = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 'scenario',
      dsl: null,
      pdfContent: null,
      report: null,
      moduleSource: null,
      isLoading: false,
      error: null,
    }));
    setLoadingType(null);
    handleScenarioStateReset();
    hideAnalysis();
  }, [handleScenarioStateReset, hideAnalysis]);

  const startTestRun = useCallback(() => {
    setLoadingType('test');
    startAnalysis(scenarioRunSteps);
  }, [startAnalysis]);

  const finalizeTestRun = useCallback(() => {
    completeAnalysis();
    setTimeout(() => {
      setLoadingType(null);
      hideAnalysis();
    }, 1200);
  }, [completeAnalysis, hideAnalysis]);

  const handleRunTestsWithData = async (
    dsl: any,
    pdfContent: string,
    _pdfBufferPath?: string,
    sourceOverride?: ModuleSource | null,
    moduleIdOverride?: ModuleId | null
  ) => {
    const moduleIdForRun = moduleIdOverride ?? state.moduleId ?? selectedModule?.meta.id ?? null;
    if (!moduleIdForRun) {
      toast.error('Seleziona un modulo prima di eseguire i test');
      return;
    }

    if (!dsl) {
      toast.error('DSL non disponibile');
      return;
    }

    const missingConfigFields = getMissingRequiredConfig();
    if (missingConfigFields.length > 0) {
      toast.error(
        <div className="space-y-1">
          <div className="font-semibold">Configura tutti i campi obbligatori</div>
          <div className="text-sm">Completa: {missingConfigFields.join(', ')}</div>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    startTestRun();
    const progressTimers: number[] = [];
    const scheduleStepUpdate = (stepId: string, status: 'running' | 'completed', details: string, delay: number) => {
      const timer = window.setTimeout(() => {
        updateStep(stepId, status, details);
      }, delay);
      progressTimers.push(timer);
    };

    const abortController = createNewController();

    setState(prev => ({
      ...prev,
      moduleId: moduleIdForRun,
      moduleSource: sourceOverride ?? prev.moduleSource ?? 'scenario',
      dsl,
      pdfContent,
      isLoading: true,
      error: null,
    }));

    try {
     updateStep('browser_launch', 'running', 'Avvio del browser Puppeteer...');
     scheduleStepUpdate('browser_launch', 'completed', 'Browser inizializzato', 300);
      scheduleStepUpdate('navigation', 'running', 'Caricamento della pagina...', 350);
      scheduleStepUpdate('navigation', 'completed', 'Navigazione completata', 900);
      scheduleStepUpdate('cookie_consent', 'running', 'Gestione del banner cookie...', 1100);
      scheduleStepUpdate('cookie_consent', 'completed', 'Gestione cookie completata', 1700);
      scheduleStepUpdate('test_execution', 'running', 'Esecuzione scenario DSL...', 1900);
      scheduleStepUpdate('test_execution', 'completed', 'Scenario eseguito', 2600);
      scheduleStepUpdate('data_collection', 'running', 'Raccolta eventi e screenshot...', 2800);
      scheduleStepUpdate('data_collection', 'completed', 'Dati raccolti', 3400);
      scheduleStepUpdate('report_generation', 'running', 'Generazione del report...', 3600);

      const response = await fetch(`${apiBaseUrl}/api/ssd/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          moduleId: moduleIdForRun,
          moduleConfig: state.moduleConfig,
          moduleSource: sourceOverride ?? 'scenario',
          scenarioId: state.scenarioId ?? null,
          dsl,
          pdfContent,
          runOptions: {
            headless: true,
            consent: 'both',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        notifyError(error, 'Esecuzione test fallita');
        throw new Error(error.error || `Server error (${response.status})`);
      }

      const result = await response.json();
      const reportData = result.report ?? result;

      progressTimers.forEach(timerId => window.clearTimeout(timerId));
      updateStep('report_generation', 'running', 'Generazione del report...');
      updateStep('report_generation', 'completed', 'Report generato');

      setState(prev => ({
        ...prev,
        report: reportData,
        currentStep: 'run',
        isLoading: false,
      }));

      toast.success('Test completati');
      finalizeTestRun();
    } catch (error) {
      progressTimers.forEach(timerId => window.clearTimeout(timerId));
      updateStep('report_generation', 'error', error instanceof Error ? error.message : 'Errore durante il test');

      if (error instanceof Error && error.name === 'AbortError') {
        setLoadingType(null);
        hideAnalysis();
        return;
      }

      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
      notifyError(error, 'Impossibile completare il test');
      setLoadingType(null);
      hideAnalysis();
    }
  };

  const handleRunTests = async () => {
    if (!state.dsl) {
      toast.error('Genera la DSL dello scenario prima di eseguire i test');
      return;
    }
    if (!ensureCmpConfigured()) return;

    await handleRunTestsWithData(
      state.dsl,
      state.pdfContent ?? '',
      undefined,
      state.moduleSource ?? 'scenario',
      state.moduleId ?? selectedModule?.meta.id ?? null
    );
  };

  const progressStepsDefinition = [
    { key: 'module', label: 'Modulo', icon: PackageSearch },
    { key: 'scenario', label: 'Scenario', icon: Tag },
    { key: 'run', label: 'Risultati', icon: Play },
  ] as const;

  const activeStepKey = state.currentStep === 'review' ? 'scenario' : state.currentStep;
  const activeStepIndex = progressStepsDefinition.findIndex(step => step.key === activeStepKey);

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

  const selectedEventDefinition = state.eventDefinitions.find(event => event.id === state.scenarioEventId) ?? null;

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex flex-col relative overflow-hidden">
      <SSDProgressModal
        isVisible={!!loadingType}
        currentStep={currentProgressStep}
        steps={progressSteps}
        progress={progress}
        loadingType={loadingType}
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" />
        <div className="absolute -bottom-40 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000" />
      </div>

      <div className="relative z-10 flex-1">
        <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/80 shadow-sm text-purple-600 text-sm font-medium">
              <Tag className="w-4 h-4" />
              Scenario-based SDD Testing
            </div>
            <h1 className="mt-4 text-4xl font-semibold text-slate-900">Configura e salva scenari di tracciamento</h1>
            <p className="mt-3 text-slate-600">
              Seleziona un modulo verticale, scegli l'evento da monitorare e crea scenari riutilizzabili senza caricare PDF.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {progressStepsDefinition.map((step, index) => {
              const isActive = index === activeStepIndex || (step.key === 'run' && activeStepIndex > index);
              return (
                <Card key={step.key} className={`p-4 flex items-center gap-3 border ${isActive ? 'border-purple-400 bg-white' : 'border-transparent bg-white/70'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Step {index + 1}</div>
                    <div className="font-semibold text-slate-800">{step.label}</div>
                  </div>
                </Card>
              );
            })}
          </div>

          {state.currentStep === 'module' ? (
            <ModuleSelectionStep
              modules={modules}
              loading={modulesLoading}
              error={modulesError}
              currentModuleId={state.moduleId}
              onModuleSelect={handleModuleSelect}
              onModuleProceed={handleModuleProceed}
              onCreateModule={openModuleBuilder}
            />
          ) : (
            selectedModule && (
              <>
                <Card className="p-6 bg-white/80 backdrop-blur border border-white/60 shadow-lg">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-purple-500 mb-1">
                        Modulo selezionato
                      </p>
                      <h2 className="text-2xl font-semibold text-gray-900">
                        {selectedModule.meta.title}
                      </h2>
                      <p className="text-gray-600 mt-1 max-w-2xl">{selectedModule.meta.description}</p>
                      {selectedModule.meta.tags && selectedModule.meta.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedModule.meta.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-3 py-1 text-xs font-medium bg-purple-50 text-purple-600 rounded-full border border-purple-100"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="outline" onClick={handleChangeModule}>
                      Cambia modulo
                    </Button>
                  </div>
                </Card>

                {selectedModule.configFields.length > 0 && (
                  <ModuleConfigForm
                    module={selectedModule}
                    values={state.moduleConfig}
                    onChange={handleModuleConfigChange}
                  />
                )}
              </>
            )
          )}

          {state.currentStep === 'scenario' && (
            <>
              <Card className="p-6 bg-white/90 border border-white/60 shadow-lg space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      CMP del modulo
                    </p>
                    <h3 className="text-xl font-semibold text-slate-900">Cookie consent</h3>
                    <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                      Il selettore inserito verrà utilizzato automaticamente in tutti gli scenari di questo modulo.
                      Verifica la CMP almeno una volta per sbloccare la creazione e l&apos;esecuzione dei test.
                    </p>
                  </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold ${
                      cmpReady ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {cmpReady ? 'Verificata' : 'Da configurare'}
                  </span>
                  <Button
                    type="button"
                    onClick={openCmpModal}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
                  >
                    <Settings2 className="h-4 w-4" />
                    Configura CMP
                  </Button>
                </div>
                </div>
                {cmpStatus ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Selettore
                      </p>
                      <p className="mt-2 font-mono text-sm text-slate-800 break-all">{cmpStatus.selector}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Pagina di test
                      </p>
                      <p className="mt-2 text-sm text-slate-800 break-all">{cmpStatus.testUrl || '—'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Ultima verifica
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-800">
                        {formatDateTime(cmpStatus.lastValidation?.executedAt)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {cmpStatus.lastValidation?.status === 'ACCEPTED'
                          ? 'Tutti i consensi risultano concessi.'
                          : cmpStatus.lastValidation?.reasoning || 'Nessuna motivazione disponibile.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">
                    Nessuna configurazione salvata. Definisci il selettore della CMP per procedere con gli scenari.
                  </div>
                )}
              </Card>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <Card className="p-6 space-y-6 bg-white/90 backdrop-blur border border-white/60 shadow-lg">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                    <h2 className="text-xl font-semibold text-slate-900">Gestisci gli scenari salvati</h2>
                    <p className="text-sm text-slate-600">
                      Scegli uno use case configurato o apri la modale per crearne uno nuovo. Ogni scenario memorizza URL, step e payload atteso.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={handleScenarioEdit}
                      disabled={!state.scenarioId || state.isLoading || !cmpReady}
                      className="rounded-full border-indigo-200 bg-indigo-50 px-4 py-2 text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-700 disabled:opacity-40"
                    >
                      <PencilLine className="w-4 h-4 mr-2" />
                      Modifica scenario
                    </Button>
                    <Button
                      onClick={handleScenarioCreate}
                      disabled={state.isLoading || !cmpReady}
                      className="rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 px-4 py-2 font-semibold text-white shadow-lg transition hover:from-indigo-600 hover:via-purple-600 hover:to-fuchsia-600 disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nuovo scenario
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Scenario salvato</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                      value={state.scenarioId ?? ''}
                      onChange={event => handleSelectScenario(event.target.value)}
                      disabled={state.isLoading || state.scenarios.length === 0}
                    >
                      <option value="" disabled>
                        {state.scenarios.length === 0 ? 'Nessuno scenario disponibile' : 'Seleziona uno scenario'}
                      </option>
                      {state.scenarios.map(scenario => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                    {state.scenarios.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Non hai ancora salvato scenari per questo modulo. Crea il primo tramite il pulsante “Nuovo scenario”.
                      </p>
                    )}
                  </div>

                  {selectedScenarioDetails ? (
                    <div className="space-y-5 rounded-2xl border border-white/70 bg-white/80 p-5 shadow-inner">
                      {selectedScenarioDetails.eventId && selectedScenarioDetails.eventId !== 'manual' && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-500">
                              Evento monitorato
                            </p>
                            <h3 className="text-lg font-semibold text-slate-900">
                              {selectedEventDefinition?.label ?? selectedScenarioDetails.eventId}
                            </h3>
                            {selectedEventDefinition?.description && (
                              <p className="mt-1 text-sm text-slate-600 max-w-xl">
                                {selectedEventDefinition.description}
                              </p>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-600">
                            <ListChecks className="h-3.5 w-3.5" />
                            {selectedScenarioDetails.eventId}
                          </span>
                        </div>
                      )}
                      {selectedScenarioDetails.eventId === 'manual' && manualScenarioEventName && (
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm font-medium text-indigo-700">
                          Evento atteso: {manualScenarioEventName}
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          URL di test
                        </p>
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                          {selectedScenarioDetails.url}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Step configurati
                        </p>
                        {state.scenarioSteps.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
                            Nessuna azione configurata. Aggiungi almeno un clic nella modale per istruire il runner.
                          </div>
                        ) : (
                          <ul className="space-y-3">
                            {state.scenarioSteps.map((step, index) => {
                              const meta = STEP_TYPE_META[step.type];
                              return (
                                <li
                                  key={step.id}
                                  className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-500">
                                      Step {index + 1}
                                    </p>
                                    <p className="text-sm font-medium text-slate-800">{step.label}</p>
                                  </div>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${meta?.badgeClass ?? 'bg-slate-100 text-slate-600'}`}
                                  >
                                    {meta?.label ?? step.type}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Payload atteso
                        </p>
                        <div className="rounded-xl border border-slate-200 bg-slate-950/90 px-4 py-3 text-xs text-emerald-200 shadow-inner">
                          <pre className="max-h-48 overflow-auto">
                            {state.scenarioExpectedPayload.trim().length > 0 ? state.scenarioExpectedPayload : JSON.stringify(selectedScenarioDetails.expectedPayload ?? {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-600">
                      Seleziona uno scenario per visualizzarne i dettagli oppure creane uno nuovo tramite la modale dedicata.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleGenerateScenarioDsl}
                      disabled={state.isLoading || !state.scenarioId || !cmpReady}
                      className="rounded-full bg-slate-900 px-5 py-2 font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-40"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Genera DSL
                    </Button>
                    <Button
                      onClick={requestDeleteScenario}
                      disabled={state.isLoading || !state.scenarioId || !cmpReady}
                      variant="destructive"
                      className="rounded-full px-5 py-2 font-semibold shadow-sm disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Elimina
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/70 border border-white/60 shadow-lg space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-[0.2em]">Come funziona</h3>
                  <ul className="mt-3 text-sm text-slate-600 space-y-2 list-disc list-inside">
                    <li>Apri la modale per creare o modificare scenario, step e payload atteso.</li>
                    <li>Gli scenari salvati restano disponibili per il modulo e possono essere rieseguiti in qualsiasi momento.</li>
                    <li>La DSL generata riflette sempre l'ultima versione dello scenario salvato.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-[0.2em]">Suggerimenti</h3>
                  <ul className="mt-3 text-sm text-slate-600 space-y-2 list-disc list-inside">
                    <li>Compila i selettori con classi o ID univoci per evitare ambiguità nei click.</li>
                    <li>Usa <code>*</code> nel payload per indicare valori dinamici; lascia vuoto per usare il template suggerito dall&apos;evento.</li>
                    <li>Versiona il file <code className="text-slate-700">config/module-scenarios.json</code> per condividere gli scenari con il team.</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-4 text-xs text-slate-500">
                  Le configurazioni degli scenari sono salvate sul filesystem locale. Puoi committare il file per mantenerle allineate tra i diversi ambienti.
                </div>
              </Card>
              </div>
            </>
          )}

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
              onRunTests={handleRunTests}
            />
          )}

          {state.currentStep === 'run' && state.report && (
            <DetailedResultsStep
              state={state}
              onReset={handleReset}
              onExportReport={handleExportReport}
              onRunTestsWithData={handleRunTestsWithData}
            />
          )}

          {state.currentStep === 'run' && !state.report && (
            <Card className="p-8 text-center bg-white/90 border border-white/60 shadow-lg">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Test completati</h2>
                <p className="text-gray-600 mb-6">
                  I test sono stati eseguiti con successo. I risultati saranno disponibili a breve.
                </p>
              </div>
              <Button onClick={handleReset} variant="outline" className="px-6 py-3">
                <RefreshCw className="w-4 h-4 mr-2" />
                Torna agli scenari
              </Button>
            </Card>
          )}


      {isModuleBuilderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur"
          onClick={closeModuleBuilder}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-3xl border border-white/30 bg-white shadow-2xl flex flex-col"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-500">Nuovo modulo</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Configura una nuova verticalizzazione</h2>
                <p className="text-sm text-slate-500">
                  Inserisci le informazioni minime: potrai aggiungere scenari e CMP subito dopo la creazione.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                onClick={closeModuleBuilder}
                disabled={moduleBuilderSaving}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Nome modulo</label>
                <Input
                  value={moduleBuilderDraft.title}
                  onChange={event => handleModuleBuilderFieldChange('title', event.target.value)}
                  placeholder="Es. Nuovo ecommerce"
                  disabled={moduleBuilderSaving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Descrizione</label>
                <textarea
                  value={moduleBuilderDraft.description}
                  onChange={event => handleModuleBuilderFieldChange('description', event.target.value)}
                  placeholder="Descrivi obiettivo e pagina principale monitorata"
                  className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  disabled={moduleBuilderSaving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Domini supportati</label>
                <textarea
                  value={moduleBuilderDraft.supportedHosts}
                  onChange={event => handleModuleBuilderFieldChange('supportedHosts', event.target.value)}
                  placeholder="www.example.com, app.example.com"
                  className="min-h-[70px] w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  disabled={moduleBuilderSaving}
                />
                <p className="text-xs text-slate-500">Un dominio per riga oppure separato da virgole. Puoi lasciare vuoto: useremo gli URL per inferirli.</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">URL principali</label>
                <textarea
                  value={moduleBuilderDraft.defaultUrls}
                  onChange={event => handleModuleBuilderFieldChange('defaultUrls', event.target.value)}
                  placeholder={`https://www.example.com\nhttps://www.example.com/prodotto`}
                  className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  disabled={moduleBuilderSaving}
                />
                <p className="text-xs text-slate-500">Inserisci almeno un URL. Verrà utilizzato come suggerimento durante la creazione degli scenari.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Tag (opzionali)</label>
                  <Input
                    value={moduleBuilderDraft.tags}
                    onChange={event => handleModuleBuilderFieldChange('tags', event.target.value)}
                    placeholder="Tracking, Ecommerce"
                    disabled={moduleBuilderSaving}
                  />
                  <p className="text-xs text-slate-500">Separali con virgole per mostrarli come badge.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Icona</label>
                    <select
                      value={moduleBuilderDraft.icon}
                      onChange={event => handleModuleBuilderFieldChange('icon', event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      disabled={moduleBuilderSaving}
                    >
                      {MODULE_ICON_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Colore accento</label>
                    <Input
                      type="color"
                      value={moduleBuilderDraft.accentColor}
                      onChange={event => handleModuleBuilderFieldChange('accentColor', event.target.value)}
                      disabled={moduleBuilderSaving}
                      className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 p-1"
                    />
                  </div>
                </div>
              </div>
              {moduleBuilderError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2 text-sm text-rose-700 shadow-inner">
                  {moduleBuilderError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/80 px-6 py-4">
              <div className="text-xs text-slate-500">
                {moduleBuilderSaving ? (
                  <span className="inline-flex items-center gap-2 text-indigo-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvataggio in corso...
                  </span>
                ) : (
                  'Potrai configurare CMP e scenari subito dopo aver creato il modulo.'
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  onClick={closeModuleBuilder}
                  disabled={moduleBuilderSaving}
                >
                  Annulla
                </Button>
                <Button
                  className="rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-200/80 hover:opacity-95 disabled:opacity-50"
                  onClick={handleModuleBuilderSave}
                  disabled={moduleBuilderSaving}
                >
                  {moduleBuilderSaving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvataggio
                    </span>
                  ) : (
                    'Salva modulo'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isScenarioModalOpen && scenarioDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur"
          onClick={() => {
            if (!scenarioModalSaving) {
              closeScenarioModal();
            }
          }}
        >
          <div
            className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl flex flex-col"
            onClick={event => event.stopPropagation()}
          >
                <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-500">
                      {scenarioModalMode === 'create' ? 'Nuovo scenario' : 'Modifica scenario'}
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900 mt-1">
                      {scenarioModalMode === 'create' ? "Configura un nuovo caso d'uso" : "Aggiorna il caso d'uso selezionato"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    onClick={closeScenarioModal}
                    disabled={scenarioModalSaving}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Nome scenario</label>
                    <Input
                      value={scenarioDraft.name}
                      onChange={event => handleDraftNameChange(event.target.value)}
                      placeholder="Es. Add to cart Bronze"
                      disabled={scenarioModalSaving}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">URL da testare</label>
                    <Input
                      value={scenarioDraft.url}
                      onChange={event => handleDraftUrlChange(event.target.value)}
                      placeholder="https://www.example.com/pagina"
                      disabled={scenarioModalSaving}
                    />
                  </div>

                  {draftConfigInputs.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {draftConfigInputs.map(input => (
                        <div key={input.id} className="space-y-1">
                          <label className="text-sm font-medium text-slate-700">{input.label}</label>
                          <Input
                            value={String(scenarioDraft.config?.[input.id] ?? '')}
                            placeholder={input.placeholder || ''}
                            onChange={event => handleDraftConfigChange(input.id, event.target.value)}
                            disabled={scenarioModalSaving}
                          />
                          {input.helperText && (
                            <p className="text-xs text-slate-500">{input.helperText}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}


                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-purple-600">
                          <ListChecks className="h-3.5 w-3.5" />
                          Step del test
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          Definisci i click necessari per riprodurre il tracciamento. Dopo ogni click il runner attende automaticamente 10 secondi prima di proseguire.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
                          onClick={handleDraftAddClickStep}
                          disabled={scenarioModalSaving}
                        >
                          <Plus className="h-4 w-4" />
                          Aggiungi clic
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                          onClick={handleDraftResetSteps}
                          disabled={scenarioModalSaving}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Ripristina step
                        </Button>
                      </div>
                    </div>

                    {scenarioDraft.steps.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">
                        Nessuna azione configurata. Aggiungi almeno un clic per istruire il runner su cosa eseguire dopo la CMP.
                      </div>
                    ) : (
                      scenarioDraft.steps.map((step, index) => {
                        const stepDefinition = draftEventDefinition?.steps.find(def => def.id === step.id);
                        const meta = STEP_TYPE_META[step.type];
                        const inputDefinition = stepDefinition?.input;
                        const usesSelector = inputDefinition?.type === 'selector';
                        const inputValue = usesSelector ? step.selector ?? '' : step.value ?? '';

                        return (
                          <div
                            key={step.id}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-500">
                                  Step {index + 1}
                                </p>
                                <h4 className="text-base font-semibold text-slate-900">{step.label}</h4>
                                {(step.description || stepDefinition?.description) && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {step.description || stepDefinition?.description}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${meta?.badgeClass ?? 'bg-slate-100 text-slate-600'}`}
                              >
                                {meta?.label ?? step.type}
                              </span>
                            </div>

                            {inputDefinition ? (
                              <div className="mt-3 space-y-1">
                                <label className="text-xs font-semibold text-slate-600">
                                  {inputDefinition.label}
                                </label>
                                <Input
                                  value={inputValue}
                                  placeholder={inputDefinition.placeholder || ''}
                                  onChange={event =>
                                    handleDraftStepInputChange(
                                      step.id,
                                      usesSelector ? 'selector' : 'value',
                                      event.target.value
                                    )
                                  }
                                  disabled={scenarioModalSaving}
                                />
                                {inputDefinition.helperText && (
                                  <p className="text-xs text-slate-500">{inputDefinition.helperText}</p>
                                )}
                              </div>
                            ) : (
                              <div className="mt-3 space-y-1">
                                <label className="text-xs font-semibold text-slate-600">
                                  Selettore CSS del click
                                </label>
                                <Input
                                  value={step.selector ?? ''}
                                  placeholder=".btn.cta-purchase"
                                  onChange={event =>
                                    handleDraftStepInputChange(step.id, 'selector', event.target.value)
                                  }
                                  disabled={scenarioModalSaving}
                                />
                                <p className="text-xs text-slate-500">
                                  Il runner cliccherà questo elemento e attenderà 10 secondi prima di passare allo step successivo.
                                </p>
                              </div>
                            )}

                            {!stepDefinition && (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  className="flex items-center gap-2 text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-40"
                                  onClick={() => handleDraftRemoveStep(step.id)}
                                  disabled={scenarioModalSaving}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Rimuovi step
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-500">
                          Payload atteso
                        </div>
                        <p className="text-sm text-slate-600">
                          Indica il push minimo che il dataLayer deve contenere dopo gli step.
                        </p>
                        {draftExpectedEventName && (
                          <p className="text-xs font-semibold text-indigo-600">
                            Evento atteso: {draftExpectedEventName}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
                          onClick={handleDraftFormatPayload}
                          disabled={scenarioModalSaving}
                        >
                          <Braces className="h-4 w-4" />
                          Format JSON
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                          onClick={handleDraftResetPayload}
                          disabled={scenarioModalSaving}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Ripristina template
                        </Button>
                      </div>
                    </div>

                    <textarea
                      value={scenarioDraft.expectedPayload}
                      onChange={event => handleDraftExpectedPayloadChange(event.target.value)}
                      placeholder={`{
  "event": "add_to_cart"
}`}
                      className={`w-full min-h-[200px] rounded-xl border px-3 py-2 text-sm font-mono leading-relaxed shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-200 ${scenarioDraft.expectedPayloadError ? 'border-rose-300 bg-rose-50/80 text-rose-700' : 'border-slate-200 bg-white/80 text-slate-800'}`}
                      spellCheck={false}
                      disabled={scenarioModalSaving}
                    />
                    {scenarioDraft.expectedPayloadError ? (
                      <div className="text-xs text-rose-600">
                        Payload non valido: {scenarioDraft.expectedPayloadError}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        Lascia vuoto per utilizzare il template suggerito dall&apos;evento. Inserisci lo snippet completo con valori di esempio: il sistema verificherà solo la struttura e l&apos;evento.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/80 px-6 py-4">
                  <div className="text-xs text-slate-500">
                    {scenarioModalSaving ? (
                      <span className="inline-flex items-center gap-2 text-purple-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvataggio in corso...
                      </span>
                    ) : (
                      <span>Le modifiche vengono salvate nel file config/module-scenarios.json.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={closeScenarioModal}
                      disabled={scenarioModalSaving}
                      className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                    >
                      Annulla
                    </Button>
                    <Button
                      onClick={handleScenarioModalSave}
                      disabled={scenarioModalSaving}
                      className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {scenarioModalSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salva scenario
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {isCmpModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur"
        onClick={closeCmpModal}
      >
        <div
          className="relative w-full max-w-lg max-h-[80vh] overflow-auto rounded-3xl border border-white/20 bg-white shadow-2xl"
          onClick={event => event.stopPropagation()}
        >
          <div className="border-b border-slate-200/70 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-900">Configura la CMP del modulo</h3>
            <p className="mt-1 text-sm text-slate-600">
              Inserisci il selettore della CTA &quot;Accetta tutti i cookie&quot; e l&apos;URL da utilizzare per il test automatico.
            </p>
          </div>
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Selettore CSS</label>
                <Input
                  value={cmpForm.selector}
                  onChange={event => handleCmpFieldChange('selector', event.target.value)}
                placeholder="#cookie-banner button.accept"
                disabled={cmpModalSaving}
              />
              <p className="text-xs text-slate-500">
                Usa un selettore univoco che punti direttamente al pulsante &quot;Accetta&quot; del banner.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">URL di test</label>
              <Input
                value={cmpForm.testUrl}
                onChange={event => handleCmpFieldChange('testUrl', event.target.value)}
                placeholder="https://www.example.com/"
                disabled={cmpModalSaving}
              />
              <p className="text-xs text-slate-500">
                È la pagina su cui eseguire il controllo della CMP. Deve contenere il banner.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Vendor (opzionale)</label>
              <select
                value={cmpForm.vendor}
                onChange={event => handleCmpFieldChange('vendor', event.target.value)}
                disabled={cmpModalSaving}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Seleziona il vendor CMP</option>
                <option value="cookiebot">Cookiebot</option>
                <option value="onetrust">OneTrust</option>
                <option value="didomi">Didomi</option>
                <option value="iubenda">Iubenda</option>
                <option value="quantcast">Quantcast</option>
                <option value="trustarc">TrustArc</option>
              </select>
            </div>
            {cmpModalError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {cmpModalError}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-slate-200/70 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeCmpModal}
                disabled={cmpModalSaving}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Annulla
              </Button>
              <Button
                type="button"
                onClick={handleCmpValidate}
                disabled={cmpModalSaving}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-40"
              >
                {cmpModalSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verifica e salva
              </Button>
            </div>
        </div>
      </div>
    )}

    <ConfirmDialog
        open={Boolean(deleteDialogScenario)}
        title="Elimina scenario salvato"
        description={
          deleteDialogScenario
            ? `Sei sicuro di voler eliminare lo scenario "${deleteDialogScenario.name}"? L'operazione non è reversibile.`
            : undefined
        }
        confirmText="Elimina"
        cancelText="Annulla"
        tone="danger"
        loading={deleteDialogLoading}
        onConfirm={handleDeleteScenario}
        onCancel={() => {
          if (!deleteDialogLoading) {
            setDeleteDialogScenario(null);
          }
        }}
      />
    </>
  );
}
