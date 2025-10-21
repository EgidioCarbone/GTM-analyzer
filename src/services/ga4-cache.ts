// @ts-nocheck
import crypto from "crypto";

type ReportData = {
  kpis: any;
  timeseries: any[];
  channels: any[];
  pages: any[];
  range: { startDate: string; endDate: string };
  propertyId: string;
};

const store = new Map<string, { value: ReportData; expireAt: number }>();

export function makeReportKey(input: {
  propertyId: string;
  startDate: string;
  endDate: string;
  // se vuoi: metrics/dimensions/granularity
}) {
  const raw = `${input.propertyId}|${input.startDate}|${input.endDate}`;
  return crypto.createHash("sha1").update(raw).digest("hex");
}

export function cacheGet(key: string): ReportData | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key: string, value: ReportData, ttlMs = 15 * 60 * 1000) {
  store.set(key, { value, expireAt: Date.now() + ttlMs });
}

// opzionale: evita duplicati in volo (request coalescing)
const inflight = new Map<string, Promise<ReportData>>();
export function setInflight(key: string, p: Promise<ReportData>) { inflight.set(key, p); }
export function getInflight(key: string) { return inflight.get(key) || null; }
export function clearInflight(key: string) { inflight.delete(key); }
