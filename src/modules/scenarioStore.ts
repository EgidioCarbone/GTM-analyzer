import { promises as fs } from 'fs';
import { join } from 'path';
import { ModuleId, ModuleScenario } from './types';

interface ScenarioFile {
  version: number;
  modules: Record<ModuleId, ModuleScenario[]>;
}

const DEFAULT_FILE: ScenarioFile = {
  version: 1,
  modules: {} as Record<ModuleId, ModuleScenario[]>,
};

const CONFIG_DIR = join(process.cwd(), 'config');
const SCENARIO_FILE_PATH = join(CONFIG_DIR, 'module-scenarios.json');

async function ensureScenarioFile(): Promise<void> {
  try {
    await fs.access(SCENARIO_FILE_PATH);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(
      SCENARIO_FILE_PATH,
      JSON.stringify(DEFAULT_FILE, null, 2),
      'utf-8'
    );
  }
}

function normalizeScenario(moduleId: ModuleId, scenario: ModuleScenario): ModuleScenario {
  return {
    id: scenario.id,
    moduleId,
    name: scenario.name,
    eventId: scenario.eventId,
    url: scenario.url,
    config: typeof scenario.config === 'object' && scenario.config !== null ? scenario.config : {},
    steps: Array.isArray(scenario.steps)
      ? scenario.steps.map(step => ({
          id: step.id,
          type: step.type,
          label: step.label,
          description: step.description,
          selector: typeof step.selector === 'string' ? step.selector : undefined,
          value: typeof step.value === 'string' ? step.value : undefined,
          delayAfterMs: typeof step.delayAfterMs === 'number' ? step.delayAfterMs : undefined,
        }))
      : [],
    expectedPayload: scenario.expectedPayload ?? null,
    testSpec: scenario.testSpec ?? null,
    testSpecMeta: scenario.testSpecMeta ?? null,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
  };
}

async function readScenarioFile(): Promise<ScenarioFile> {
  await ensureScenarioFile();
  const raw = await fs.readFile(SCENARIO_FILE_PATH, 'utf-8');
  try {
    const parsed = JSON.parse(raw) as ScenarioFile;
    if (!parsed.modules) {
      parsed.modules = {} as Record<ModuleId, ModuleScenario[]>;
    }
    for (const moduleId of Object.keys(parsed.modules) as ModuleId[]) {
      parsed.modules[moduleId] = parsed.modules[moduleId].map(scenario => normalizeScenario(moduleId, scenario));
    }
    return parsed;
  } catch (error) {
    console.error('[ScenarioStore] Failed to parse scenario file, resetting.', error);
    await fs.writeFile(
      SCENARIO_FILE_PATH,
      JSON.stringify(DEFAULT_FILE, null, 2),
      'utf-8'
    );
    return { ...DEFAULT_FILE };
  }
}

async function writeScenarioFile(data: ScenarioFile): Promise<void> {
  await fs.writeFile(SCENARIO_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function listModuleScenarios(moduleId: ModuleId): Promise<ModuleScenario[]> {
  const file = await readScenarioFile();
  return file.modules[moduleId] ?? [];
}

export async function getModuleScenario(
  moduleId: ModuleId,
  scenarioId: string
): Promise<ModuleScenario | undefined> {
  const scenarios = await listModuleScenarios(moduleId);
  return scenarios.find(scenario => scenario.id === scenarioId);
}

export async function upsertModuleScenario(scenario: ModuleScenario): Promise<ModuleScenario> {
  const file = await readScenarioFile();
  if (!file.modules[scenario.moduleId]) {
    file.modules[scenario.moduleId] = [];
  }

  const normalized = normalizeScenario(scenario.moduleId, scenario);
  const scenarios = file.modules[scenario.moduleId];
  const index = scenarios.findIndex(entry => entry.id === scenario.id);
  if (index >= 0) {
    scenarios[index] = normalized;
  } else {
    scenarios.push(normalized);
  }
  await writeScenarioFile(file);
  return normalized;
}

export async function deleteModuleScenario(moduleId: ModuleId, scenarioId: string): Promise<boolean> {
  const file = await readScenarioFile();
  const scenarios = file.modules[moduleId];
  if (!scenarios) {
    return false;
  }
  const initialLength = scenarios.length;
  file.modules[moduleId] = scenarios.filter(scenario => scenario.id !== scenarioId);
  const deleted = initialLength !== file.modules[moduleId].length;
  if (deleted) {
    await writeScenarioFile(file);
  }
  return deleted;
}

export async function deleteModuleScenarios(moduleId: ModuleId): Promise<void> {
  const file = await readScenarioFile();
  if (file.modules[moduleId]) {
    delete file.modules[moduleId];
    await writeScenarioFile(file);
  }
}

export async function overwriteModuleScenarios(
  moduleId: ModuleId,
  scenarios: ModuleScenario[]
): Promise<void> {
  const file = await readScenarioFile();
  file.modules[moduleId] = scenarios.map(scenario => normalizeScenario(moduleId, scenario));
  await writeScenarioFile(file);
}
