// src/context/ContainerContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { GenerateDocInput } from "../types/gtm";
import { GtmMetrics, calculateGtmMetrics } from "../services/gtm-metrics";
// --- Helpers per arrotondamenti e bonus KPI ---
const round1 = (n: number) => Math.round(n * 10) / 10;

const kpiBonus = (
  prev: { unused: number; naming: number; paused: number; ua: number },
  curr: { unused: number; naming: number; paused: number; ua: number }
) => {
  let bonus = 0;

  // pesi semplici (ritocca come vuoi)
  const W_UNUSED = 0.1;
  const W_NAMING = 0.1;
  const W_PAUSED = 0.1;
  const W_UA = 0.2;

  if (curr.unused < prev.unused) bonus += W_UNUSED;
  if (curr.naming < prev.naming) bonus += W_NAMING;
  if (curr.paused < prev.paused) bonus += W_PAUSED;
  if (curr.ua < prev.ua) bonus += W_UA;

  return round1(bonus);
};

export type ActivityEntry = {
  id: string;
  ts: number;
  action: string; // es. DELETE_TAG, PAUSE_TAG, RENAME_VARIABLE
  entity: { type: "tag" | "trigger" | "variable"; id: string; name?: string };
  deltaScore?: number; // after - before
};

type ContainerContextType = {
  container: GenerateDocInput | null;
  setContainer: (data: GenerateDocInput | null) => void;
  analysis: GtmMetrics | null;
  setAnalysis: (m: GtmMetrics | null) => void;
  activity: ActivityEntry[];

  // ➕ baseline & miglioramento
  baselineScore: number | null;
  improvement: number; // analysis.score.total - baselineScore
  resetBaseline: () => void;

  applyContainerChange: (
    action: string,
    entity: { type: "tag" | "trigger" | "variable"; id: string; name?: string },
    mutator: (draft: GenerateDocInput) => void
  ) => void;
};

const BASELINE_KEY = "gtmBaselineScore";
const CONTAINER_KEY = "gtmContainer";
const ANALYSIS_KEY = "gtmAnalysis";
const ACTIVITY_KEY = "gtmActivity";

const ContainerContext = createContext<ContainerContextType | undefined>(undefined);

export function ContainerProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<GenerateDocInput | null>(null);
  const [analysis, setAnalysis] = useState<GtmMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [baselineScore, setBaselineScore] = useState<number | null>(null);

  // ---- Ripristino da localStorage
  useEffect(() => {
    try {
      const savedContainer = localStorage.getItem(CONTAINER_KEY);
      const savedAnalysis = localStorage.getItem(ANALYSIS_KEY);
      const savedActivity = localStorage.getItem(ACTIVITY_KEY);
      const savedBaseline = localStorage.getItem(BASELINE_KEY);

      if (savedContainer) setContainer(JSON.parse(savedContainer));
      if (savedAnalysis) setAnalysis(JSON.parse(savedAnalysis));
      if (savedActivity) setActivity(JSON.parse(savedActivity));
      if (savedBaseline) setBaselineScore(Number(savedBaseline));
    } catch (e) {
      console.error("Ripristino localStorage fallito:", e);
    }
  }, []);

  // ---- Ricalcolo metriche al mutare del container
  useEffect(() => {
    if (!container) {
      localStorage.removeItem(CONTAINER_KEY);
      localStorage.removeItem(ANALYSIS_KEY);
      localStorage.removeItem(ACTIVITY_KEY);
      // Nota: NON tocchiamo la baseline qui
      setAnalysis(null);
      return;
    }

    try {
      const m = calculateGtmMetrics(container);
      setAnalysis(m);
      localStorage.setItem(ANALYSIS_KEY, JSON.stringify(m));

      // Se non abbiamo ancora una baseline, fissala ora
      if (baselineScore == null) {
        setBaselineScore(m.score.total);
        localStorage.setItem(BASELINE_KEY, String(m.score.total));
      }
    } catch (err) {
      console.error("Errore calcolo analysis:", err);
      setAnalysis(null);
    }
  }, [container]);

  // ---- Salvataggi
  useEffect(() => {
    if (container) {
      localStorage.setItem(CONTAINER_KEY, JSON.stringify(container));
    }
  }, [container]);

  useEffect(() => {
    if (analysis) {
      localStorage.setItem(ANALYSIS_KEY, JSON.stringify(analysis));
    }
  }, [analysis]);

  useEffect(() => {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));
  }, [activity]);

  // ---- Utility activity
  function recordActivity(e: ActivityEntry) {
    setActivity(prev => {
      const next = [e, ...prev].slice(0, 200);
      try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // ---- Applica una modifica al container e registra delta di score
  // ---- Applica una modifica al container e registra delta di score
function applyContainerChange(
  action: string,
  entity: { type: "tag" | "trigger" | "variable"; id: string; name?: string },
  mutator: (draft: GenerateDocInput) => void
) {
  if (!container) return;

  // Helpers locali
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const kpiBonus = (
    prev: { unused: number; naming: number; paused: number; ua: number },
    curr: { unused: number; naming: number; paused: number; ua: number }
  ) => {
    // Pesi semplici: ritocca se vuoi
    const W_UNUSED = 0.1;
    const W_NAMING = 0.1;
    const W_PAUSED = 0.1;
    const W_UA = 0.2;

    let bonus = 0;
    if (curr.unused < prev.unused) bonus += W_UNUSED;
    if (curr.naming < prev.naming) bonus += W_NAMING;
    if (curr.paused < prev.paused) bonus += W_PAUSED;
    if (curr.ua < prev.ua) bonus += W_UA;

    return round1(bonus);
  };

  // Stato "prima"
  const before = structuredClone(container);
  const beforeMetrics = analysis ?? calculateGtmMetrics(before);

  // Applica mutazione su un draft
  const draft = structuredClone(container);
  mutator(draft);

  // Stato "dopo"
  const afterMetrics = calculateGtmMetrics(draft);

  // Delta grezzo
  const beforeScore = beforeMetrics.score.total;
  const afterScore = afterMetrics.score.total;
  const deltaRaw = round1(afterScore - beforeScore);

  // Bonus KPI se migliorano i contatori (eliminazioni/risoluzioni)
  const bonus = kpiBonus(
    {
      unused: beforeMetrics.kpi.unused.total,
      naming: beforeMetrics.kpi.namingIssues.total,
      paused: beforeMetrics.kpi.paused,
      ua: beforeMetrics.kpi.uaObsolete
    },
    {
      unused: afterMetrics.kpi.unused.total,
      naming: afterMetrics.kpi.namingIssues.total,
      paused: afterMetrics.kpi.paused,
      ua: afterMetrics.kpi.uaObsolete
    }
  );

  // Calcolo deltaScore custom per batch rename
  let delta = round1(deltaRaw + bonus);
  if (action === 'rinominato in batch' && entity.name) {
    // entity.name è tipo '56 elementi'
    const match = entity.name.match(/(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      delta = round1(0.1 * n);
    }
  }

  console.log(
    `🔄 ${action}: ${beforeScore}% → ${afterScore}% (Δ raw ${deltaRaw}%, bonus ${bonus}%, Δ ${delta}%)`
  );

  setContainer(draft);
  setAnalysis(afterMetrics);
  recordActivity({
    id: (globalThis.crypto?.randomUUID?.() ?? "") || String(Date.now()),
    ts: Date.now(),
    action,
    entity,
    deltaScore: delta
  });
}


  // ---- Reset manuale della baseline (se vuoi ripartire da zero)
  function resetBaseline() {
    if (analysis) {
      setBaselineScore(analysis.score.total);
      localStorage.setItem(BASELINE_KEY, String(analysis.score.total));
    }
  }

  // ---- Miglioramento (visibile in Timeline)
  const improvement =
    analysis && baselineScore != null ? Number((analysis.score.total - baselineScore).toFixed(1)) : 0;

  return (
    <ContainerContext.Provider
      value={{
        container,
        setContainer,
        analysis,
        setAnalysis,
        activity,
        baselineScore,
        improvement,
        resetBaseline,
        applyContainerChange
      }}
    >
      {children}
    </ContainerContext.Provider>
  );
}

export function useContainer(): ContainerContextType {
  const ctx = useContext(ContainerContext);
  if (!ctx) throw new Error("useContainer must be used within a ContainerProvider");
  return ctx;
}
