import { promises as fs } from 'fs';
import { join } from 'path';
import type { ModuleId, ModuleSettings, ModuleCMPSettings } from './types';

interface ModuleSettingsFile {
  version: number;
  modules: Partial<Record<ModuleId, ModuleSettings>>;
}

const DEFAULT_FILE: ModuleSettingsFile = {
  version: 1,
  modules: {},
};

const CONFIG_DIR = join(process.cwd(), 'config');
const SETTINGS_FILE_PATH = join(CONFIG_DIR, 'module-settings.json');

async function ensureSettingsFile(): Promise<void> {
  try {
    await fs.access(SETTINGS_FILE_PATH);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_FILE, null, 2), 'utf8');
  }
}

function sanitizeSettings(moduleId: ModuleId, settings: ModuleSettings | null | undefined): ModuleSettings | null {
  if (!settings) {
    return null;
  }

  const validation = settings.cmp?.lastValidation
    ? {
        status: settings.cmp.lastValidation.status,
        reasoning: settings.cmp.lastValidation.reasoning,
        executedAt:
          settings.cmp.lastValidation.executedAt ||
          settings.cmp.validatedAt ||
          settings.updatedAt ||
          new Date().toISOString(),
        evidence: settings.cmp.lastValidation.evidence,
        eventsCaptured: settings.cmp.lastValidation.eventsCaptured,
        sampleEvents: settings.cmp.lastValidation.sampleEvents,
      }
    : undefined;

  const normalized: ModuleSettings = {
    moduleId,
    updatedAt: settings.updatedAt || new Date().toISOString(),
    cmp: settings.cmp
      ? {
          selector: settings.cmp.selector,
          vendor: settings.cmp.vendor,
          testUrl: settings.cmp.testUrl,
          validatedAt: settings.cmp.validatedAt || settings.updatedAt || new Date().toISOString(),
          lastValidation:
            validation ??
            {
              status: 'UNKNOWN',
              reasoning: 'Nessuna validazione disponibile.',
              executedAt: settings.updatedAt || new Date().toISOString(),
            },
        }
      : undefined,
  };

  return normalized;
}

async function readSettingsFile(): Promise<ModuleSettingsFile> {
  await ensureSettingsFile();
  try {
    const raw = await fs.readFile(SETTINGS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ModuleSettingsFile;
    if (!parsed.modules) {
      parsed.modules = {};
    }
    return parsed;
  } catch (error) {
    console.warn('[ModuleSettingsStore] Unable to read module settings file. Resetting.', error);
    await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_FILE, null, 2), 'utf8');
    return { ...DEFAULT_FILE };
  }
}

async function writeSettingsFile(data: ModuleSettingsFile): Promise<void> {
  await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function getModuleSettings(moduleId: ModuleId): Promise<ModuleSettings | null> {
  const file = await readSettingsFile();
  const settings = file.modules[moduleId];
  return sanitizeSettings(moduleId, settings ?? null);
}

export async function setModuleCmpSettings(
  moduleId: ModuleId,
  cmp: ModuleCMPSettings
): Promise<ModuleSettings> {
  const file = await readSettingsFile();
  const updatedSettings: ModuleSettings = {
    moduleId,
    updatedAt: new Date().toISOString(),
    cmp: cmp,
  };
  file.modules[moduleId] = updatedSettings;
  await writeSettingsFile(file);
  return updatedSettings;
}

export async function upsertModuleSettings(
  moduleId: ModuleId,
  updates: Partial<ModuleSettings>
): Promise<ModuleSettings> {
  const file = await readSettingsFile();
  const existing = sanitizeSettings(moduleId, file.modules[moduleId] ?? null);
  const merged: ModuleSettings = {
    moduleId,
    updatedAt: updates.updatedAt || existing?.updatedAt || new Date().toISOString(),
    cmp: updates.cmp ?? existing?.cmp,
  };
  file.modules[moduleId] = merged;
  await writeSettingsFile(file);
  return merged;
}

export async function deleteModuleSettings(moduleId: ModuleId): Promise<void> {
  const file = await readSettingsFile();
  if (file.modules[moduleId]) {
    delete file.modules[moduleId];
    await writeSettingsFile(file);
  }
}
