import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { PushUseCase, ExpectedCall, RunResultSummary } from '../../shared/types.js';

const STORAGE_DIR = path.join(process.cwd(), 'server', 'data');
const USECASES_FILE = path.join(STORAGE_DIR, 'push-usecases.json');
const BACKUP_FILE = path.join(STORAGE_DIR, 'push-usecases.bak');
const MAX_USECASE_SIZE = 64 * 1024; // 64KB

const ExpectedCallSchema: z.ZodType<ExpectedCall> = z.object({
  urlPattern: z.string().min(1),
  mustContainParams: z.record(z.string()).optional(),
});

const RunResultSummarySchema: z.ZodType<RunResultSummary> = z.object({
  ts: z.number(),
  ok: z.boolean(),
  matchedUrl: z.string().optional(),
  status: z.number().optional(),
  reason: z.enum(['timeout', 'error', 'nomatch']).optional(),
});

const PushUseCaseSchema: z.ZodType<PushUseCase> = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  origin: z.string().min(1),
  mode: z.enum(['datalayer', 'gtag']),
  payload: z.any().optional(),
  gtagName: z.string().optional(),
  gtagParams: z.record(z.any()).optional(),
  expected: ExpectedCallSchema,
  timeoutMs: z.number().positive().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastResult: RunResultSummarySchema.optional(),
});

const StorageSchema = z.object({
  version: z.literal(1),
  useCases: z.array(PushUseCaseSchema),
});

interface StorageData {
  version: 1;
  useCases: PushUseCase[];
}

export interface PushUseCaseCreateInput {
  name: string;
  origin: string;
  mode: 'datalayer' | 'gtag';
  payload?: any;
  gtagName?: string;
  gtagParams?: Record<string, any>;
  expected?: ExpectedCall;
  timeoutMs?: number;
}

export interface PushUseCaseUpdateInput extends Partial<PushUseCaseCreateInput> {}

class PushUseCasesStorage {
  private data: StorageData = { version: 1, useCases: [] };
  private loaded = false;

  private async ensureDir() {
    await fs.mkdir(STORAGE_DIR, { recursive: true }).catch(() => {});
  }

  private async load() {
    if (this.loaded) return;
    await this.ensureDir();
    try {
      const raw = await fs.readFile(USECASES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const validated = StorageSchema.parse(parsed);
      this.data = validated;
    } catch {
      this.data = { version: 1, useCases: [] };
    }
    this.loaded = true;
  }

  private async save() {
    await this.ensureDir();
    try {
      await fs.copyFile(USECASES_FILE, BACKUP_FILE);
    } catch {
      // ignore if no previous file
    }
    const tmp = USECASES_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.rename(tmp, USECASES_FILE);
  }

  private validateSize(obj: unknown) {
    return JSON.stringify(obj).length <= MAX_USECASE_SIZE;
  }

  private inferExpected(
    mode: 'datalayer' | 'gtag',
    payload?: any,
    gtagName?: string,
    gtagParams?: Record<string, any>
  ): ExpectedCall {
    const basePattern = 'https://.*google-analytics\\.com/(debug/)?g/collect';
    const params: Record<string, string> = {};

    const eventName =
      mode === 'datalayer'
        ? payload?.event
        : gtagName;

    if (typeof eventName === 'string' && eventName.trim()) {
      const trimmed = eventName.trim();
      params.en = trimmed;
      params._en = trimmed;
    }

    const measurementId =
      gtagParams?.measurement_id || gtagParams?.tid || gtagParams?.measurementId;
    if (typeof measurementId === 'string' && measurementId.trim()) {
      params.tid = measurementId.trim();
    }

    return {
      urlPattern: basePattern,
      mustContainParams: Object.keys(params).length ? params : undefined,
    };
  }

  async list(origin?: string): Promise<PushUseCase[]> {
    await this.load();
    const list = this.data.useCases;
    return origin ? list.filter(uc => uc.origin === origin) : [...list];
  }

  async get(id: string): Promise<PushUseCase | null> {
    await this.load();
    return this.data.useCases.find(uc => uc.id === id) ?? null;
  }

  async create(input: PushUseCaseCreateInput): Promise<PushUseCase> {
    await this.load();
    const now = Date.now();
    const expected =
      input.expected ??
      this.inferExpected(input.mode, input.payload, input.gtagName, input.gtagParams);

    const useCase: PushUseCase = {
      id: crypto.randomUUID(),
      name: input.name,
      origin: input.origin,
      mode: input.mode,
      payload: input.payload,
      gtagName: input.gtagName,
      gtagParams: input.gtagParams,
      expected,
      timeoutMs: input.timeoutMs ?? 5000,
      createdAt: now,
      updatedAt: now,
    };

    if (useCase.mode === 'datalayer' && typeof useCase.payload === 'undefined') {
      throw new Error('payload is required for datalayer mode');
    }

    if (useCase.mode === 'gtag' && !useCase.gtagName) {
      throw new Error('gtagName is required for gtag mode');
    }

    PushUseCaseSchema.parse(useCase);
    if (!this.validateSize(useCase)) {
      throw new Error('Use case size exceeds 64KB limit');
    }

    this.data.useCases.push(useCase);
    await this.save();
    return useCase;
  }

  async update(id: string, updates: PushUseCaseUpdateInput): Promise<PushUseCase> {
    await this.load();
    const index = this.data.useCases.findIndex(uc => uc.id === id);
    if (index === -1) {
      throw new Error('Use case not found');
    }
    const existing = this.data.useCases[index];
    const updated: PushUseCase = {
      ...existing,
      ...updates,
      expected:
        updates.expected ??
        this.inferExpected(
          updates.mode ?? existing.mode,
          updates.payload ?? existing.payload,
          updates.gtagName ?? existing.gtagName,
          updates.gtagParams ?? existing.gtagParams
        ),
      updatedAt: Date.now(),
    };

    if (updated.mode === 'datalayer' && typeof updated.payload === 'undefined') {
      throw new Error('payload is required for datalayer mode');
    }

    if (updated.mode === 'gtag' && !updated.gtagName) {
      throw new Error('gtagName is required for gtag mode');
    }

    PushUseCaseSchema.parse(updated);
    if (!this.validateSize(updated)) {
      throw new Error('Use case size exceeds 64KB limit');
    }

    this.data.useCases[index] = updated;
    await this.save();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.load();
    const index = this.data.useCases.findIndex(uc => uc.id === id);
    if (index === -1) return false;
    this.data.useCases.splice(index, 1);
    await this.save();
    return true;
  }

  async updateLastResult(id: string, result: RunResultSummary): Promise<void> {
    await this.load();
    const uc = this.data.useCases.find(item => item.id === id);
    if (!uc) return;
    RunResultSummarySchema.parse(result);
    uc.lastResult = result;
    uc.updatedAt = Date.now();
    await this.save();
  }
}

export const pushUseCasesStorage = new PushUseCasesStorage();
