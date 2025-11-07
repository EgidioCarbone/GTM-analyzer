import { promises as fs } from 'fs';
import { join } from 'path';
import type { SSDModule, ModuleId } from './types';

interface ModuleFile {
  version: number;
  modules: SSDModule[];
}

const CONFIG_DIR = join(process.cwd(), 'config');
const MODULES_FILE_PATH = join(CONFIG_DIR, 'modules.json');
const FILE_VERSION = 1;

let cachedModules: SSDModule[] | null = null;

async function ensureModulesFile(): Promise<void> {
  try {
    await fs.access(MODULES_FILE_PATH);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const defaultPayload: ModuleFile = { version: FILE_VERSION, modules: [] };
    await fs.writeFile(MODULES_FILE_PATH, JSON.stringify(defaultPayload, null, 2), 'utf8');
  }
}

async function loadModules(): Promise<SSDModule[]> {
  if (cachedModules) {
    return cachedModules;
  }

  await ensureModulesFile();
  const raw = await fs.readFile(MODULES_FILE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as ModuleFile;
    const modules = Array.isArray(parsed.modules) ? parsed.modules : [];
    cachedModules = modules;
    return modules;
  } catch (error) {
    console.error('[ModuleStore] Failed to parse modules file. Resetting.', error);
    const fallback: ModuleFile = { version: FILE_VERSION, modules: [] };
    await fs.writeFile(MODULES_FILE_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    cachedModules = [];
    return [];
  }
}

async function saveModules(modules: SSDModule[]): Promise<void> {
  const payload: ModuleFile = { version: FILE_VERSION, modules };
  await fs.writeFile(MODULES_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  cachedModules = modules;
}

export async function listModules(): Promise<SSDModule[]> {
  const modules = await loadModules();
  // Return shallow copy to prevent accidental mutations
  return modules.map(module => ({ ...module }));
}

export async function getModule(moduleId: ModuleId): Promise<SSDModule | undefined> {
  const modules = await loadModules();
  return modules.find(module => module.meta.id === moduleId);
}

export async function createModule(module: SSDModule): Promise<SSDModule> {
  const modules = await loadModules();
  if (modules.some(existing => existing.meta.id === module.meta.id)) {
    throw new Error(`Module '${module.meta.id}' already exists`);
  }
  const updated = [...modules, module];
  await saveModules(updated);
  return module;
}

export async function updateModule(moduleId: ModuleId, updates: Partial<SSDModule>): Promise<SSDModule> {
  const modules = await loadModules();
  const index = modules.findIndex(module => module.meta.id === moduleId);
  if (index === -1) {
    throw new Error(`Module '${moduleId}' not found`);
  }
  const merged: SSDModule = {
    ...modules[index],
    ...updates,
    meta: {
      ...modules[index].meta,
      ...(updates.meta ?? {}),
      id: modules[index].meta.id, // prevent id changes
    },
    configFields: updates.configFields ?? modules[index].configFields,
    defaultConfig: updates.defaultConfig ?? modules[index].defaultConfig,
    supportedHosts: updates.supportedHosts ?? modules[index].supportedHosts,
    defaultUrls: updates.defaultUrls ?? modules[index].defaultUrls,
  };
  modules[index] = merged;
  await saveModules(modules);
  return merged;
}

export async function deleteModule(moduleId: ModuleId): Promise<boolean> {
  const modules = await loadModules();
  const remaining = modules.filter(module => module.meta.id !== moduleId);
  if (remaining.length === modules.length) {
    return false;
  }
  await saveModules(remaining);
  return true;
}
