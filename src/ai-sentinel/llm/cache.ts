import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CachedLLMEntry, LLMPlanCache, LLMCacheSnapshot } from './types';

const CACHE_DIR = path.join(process.cwd(), 'artifacts', 'ai-sentinel');
const CACHE_FILE = path.join(CACHE_DIR, 'llm-cache.json');
const CACHE_VERSION = 1;

async function ensureCacheFile(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  try {
    await fs.access(CACHE_FILE);
  } catch {
    const empty: LLMCacheSnapshot = { version: CACHE_VERSION, entries: [] };
    await fs.writeFile(CACHE_FILE, JSON.stringify(empty, null, 2), 'utf-8');
  }
}

async function readSnapshot(): Promise<LLMCacheSnapshot> {
  await ensureCacheFile();
  const content = await fs.readFile(CACHE_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(content) as LLMCacheSnapshot;
    if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.entries)) {
      throw new Error('Invalid cache format');
    }
    return parsed;
  } catch {
    const fallback: LLMCacheSnapshot = { version: CACHE_VERSION, entries: [] };
    await fs.writeFile(CACHE_FILE, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

async function writeSnapshot(snapshot: LLMCacheSnapshot): Promise<void> {
  await ensureCacheFile();
  await fs.writeFile(CACHE_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');
}

export class FileLLMPlanCache implements LLMPlanCache {
  async load(cacheKey: string): Promise<CachedLLMEntry | undefined> {
    try {
      const snapshot = await readSnapshot();
      return snapshot.entries.find(entry => entry.cacheKey === cacheKey);
    } catch (error) {
      console.warn('[llm-cache] load failed', error);
      return undefined;
    }
  }

  async save(entry: CachedLLMEntry): Promise<void> {
    try {
      const snapshot = await readSnapshot();
      const existingIndex = snapshot.entries.findIndex(e => e.cacheKey === entry.cacheKey);
      if (existingIndex >= 0) {
        snapshot.entries[existingIndex] = entry;
      } else {
        snapshot.entries.push(entry);
      }
      await writeSnapshot(snapshot);
    } catch (error) {
      console.warn('[llm-cache] save failed', error);
    }
  }

  async purgeExpired(ttlMs: number): Promise<void> {
    try {
      const snapshot = await readSnapshot();
      const now = Date.now();
      const filtered = snapshot.entries.filter(entry => now - entry.createdAt <= ttlMs);
      if (filtered.length !== snapshot.entries.length) {
        await writeSnapshot({ version: CACHE_VERSION, entries: filtered });
      }
    } catch (error) {
      console.warn('[llm-cache] purge failed', error);
    }
  }
}

export function computeBannerSignature(html: string): string {
  return crypto.createHash('sha1').update(html).digest('hex');
}
