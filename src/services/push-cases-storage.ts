import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { PushCase, PushCaseCreate, PushCaseUpdate } from '../types/push-cases.js';

const STORAGE_DIR = path.join(process.cwd(), 'server', 'data');
const CASES_FILE = path.join(STORAGE_DIR, 'push-cases.json');
const BACKUP_FILE = path.join(STORAGE_DIR, 'push-cases.bak');
const MAX_CASES_PER_ORIGIN = 100;
const MAX_CASE_SIZE = 64 * 1024; // 64KB

interface StorageData {
  cases: PushCase[];
  version: 1;
}

const StorageSchema = z.object({
  cases: z.array(z.any()),
  version: z.literal(1),
});

class PushCasesStorage {
  private data: StorageData = { cases: [], version: 1 };
  private loaded = false;

  private async ensureStorageDir() {
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    } catch (err) {
      // Directory already exists
    }
  }

  private async loadData() {
    if (this.loaded) return;

    try {
      await this.ensureStorageDir();
      const content = await fs.readFile(CASES_FILE, 'utf8');
      const parsed = JSON.parse(content);
      const validated = StorageSchema.parse(parsed);
      this.data = validated;
    } catch (err) {
      // File doesn't exist or invalid, start fresh
      this.data = { cases: [], version: 1 };
    }
    this.loaded = true;
  }

  private async saveData() {
    await this.ensureStorageDir();
    
    // Create backup
    try {
      await fs.copyFile(CASES_FILE, BACKUP_FILE);
    } catch (err) {
      // No existing file to backup
    }

    // Write to temp file first, then rename (atomic write)
    const tempFile = CASES_FILE + '.tmp';
    await fs.writeFile(tempFile, JSON.stringify(this.data, null, 2));
    await fs.rename(tempFile, CASES_FILE);
  }

  private validateCaseSize(caseData: any): boolean {
    const size = JSON.stringify(caseData).length;
    return size <= MAX_CASE_SIZE;
  }

  async getAllCases(): Promise<PushCase[]> {
    await this.loadData();
    return [...this.data.cases];
  }

  async getCasesByOrigin(origin: string): Promise<PushCase[]> {
    await this.loadData();
    return this.data.cases.filter(c => c.origin === origin);
  }

  async getCaseById(id: string): Promise<PushCase | null> {
    await this.loadData();
    return this.data.cases.find(c => c.id === id) || null;
  }

  async createCase(caseData: PushCaseCreate): Promise<PushCase> {
    await this.loadData();

    // Check origin limit
    const originCases = this.data.cases.filter(c => c.origin === caseData.origin);
    if (originCases.length >= MAX_CASES_PER_ORIGIN) {
      throw new Error(`Maximum ${MAX_CASES_PER_ORIGIN} cases per origin exceeded`);
    }

    const newCase: PushCase = {
      id: crypto.randomUUID(),
      name: caseData.name,
      origin: caseData.origin,
      mode: caseData.mode,
      payload: caseData.payload,
      gtagName: caseData.gtagName,
      gtagParams: caseData.gtagParams,
      trackCollect: caseData.trackCollect ?? true,
      match: caseData.match ?? 'auto',
      customUrlPattern: caseData.customUrlPattern,
      timeoutMs: caseData.timeoutMs ?? 5000,
      tags: caseData.tags ?? [],
      createdAt: Date.now(),
      version: 1,
    };

    // Validate case size
    if (!this.validateCaseSize(newCase)) {
      throw new Error('Case size exceeds 64KB limit');
    }

    this.data.cases.push(newCase);
    await this.saveData();
    return newCase;
  }

  async updateCase(id: string, updates: PushCaseUpdate): Promise<PushCase> {
    await this.loadData();

    const index = this.data.cases.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error('Case not found');
    }

    const updatedCase = {
      ...this.data.cases[index],
      ...updates,
      id, // Ensure ID doesn't change
    };

    // Validate case size
    if (!this.validateCaseSize(updatedCase)) {
      throw new Error('Case size exceeds 64KB limit');
    }

    this.data.cases[index] = updatedCase;
    await this.saveData();
    return updatedCase;
  }

  async deleteCase(id: string): Promise<boolean> {
    await this.loadData();

    const index = this.data.cases.findIndex(c => c.id === id);
    if (index === -1) {
      return false;
    }

    this.data.cases.splice(index, 1);
    await this.saveData();
    return true;
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.loadData();

    const case_ = this.data.cases.find(c => c.id === id);
    if (case_) {
      case_.lastUsedAt = Date.now();
      await this.saveData();
    }
  }

  async searchCases(query: string, origin?: string): Promise<PushCase[]> {
    await this.loadData();

    let cases = this.data.cases;
    if (origin) {
      cases = cases.filter(c => c.origin === origin);
    }

    if (!query.trim()) {
      return cases;
    }

    const searchTerm = query.toLowerCase();
    return cases.filter(c => 
      c.name.toLowerCase().includes(searchTerm) ||
      c.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  async exportCases(origin?: string): Promise<PushCase[]> {
    await this.loadData();
    
    if (origin) {
      return this.data.cases.filter(c => c.origin === origin);
    }
    return [...this.data.cases];
  }

  async importCases(cases: PushCase[], overwrite = false): Promise<{ imported: number; skipped: number; errors: string[] }> {
    await this.loadData();

    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const caseData of cases) {
      try {
        // Validate case
        if (!this.validateCaseSize(caseData)) {
          result.errors.push(`Case ${caseData.name} exceeds 64KB limit`);
          continue;
        }

        // Check if exists
        const existing = this.data.cases.find(c => c.id === caseData.id);
        if (existing && !overwrite) {
          result.skipped++;
          continue;
        }

        // Check origin limit
        const originCases = this.data.cases.filter(c => c.origin === caseData.origin);
        if (originCases.length >= MAX_CASES_PER_ORIGIN) {
          result.errors.push(`Origin ${caseData.origin} has reached case limit`);
          continue;
        }

        if (existing) {
          // Update existing
          const index = this.data.cases.findIndex(c => c.id === caseData.id);
          this.data.cases[index] = caseData;
        } else {
          // Add new
          this.data.cases.push(caseData);
        }

        result.imported++;
      } catch (err: any) {
        result.errors.push(`Case ${caseData.name}: ${err.message}`);
      }
    }

    if (result.imported > 0) {
      await this.saveData();
    }

    return result;
  }
}

export const pushCasesStorage = new PushCasesStorage();
