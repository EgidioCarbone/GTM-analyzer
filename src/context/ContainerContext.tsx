// src/context/ContainerContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { GenerateDocInput } from "../types/gtm"; // ✅ importa i tipi
import { GtmMetrics, calculateGtmMetrics } from "../services/gtm-metrics";

export type ActivityEntry = {
  id: string;
  ts: number;
  action: string; // es. DELETE_TAG, PAUSE_TAG, RENAME_VARIABLE
  entity: { type: 'tag'|'trigger'|'variable'; id: string; name?: string };
  deltaScore?: number; // after - before
};

type ContainerContextType = {
  container: GenerateDocInput | null;
  setContainer: (data: GenerateDocInput | null) => void;
  analysis: GtmMetrics | null;
  setAnalysis: (m: GtmMetrics | null) => void;
  activity: ActivityEntry[];
  applyContainerChange: (
    action: string,
    entity: { type:'tag'|'trigger'|'variable'; id:string; name?:string },
    mutator: (draft: GenerateDocInput) => void
  ) => void;
};

const ContainerContext = createContext<ContainerContextType | undefined>(undefined);

export function ContainerProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<GenerateDocInput | null>(null);
  const [analysis, setAnalysis] = useState<GtmMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  // ✅ Ripristino automatico dal localStorage
  useEffect(() => {
    const saved = localStorage.getItem("gtmContainer"); // ✅ chiave corretta
    const savedAnalysis = localStorage.getItem("gtmAnalysis");
    const savedActivity = localStorage.getItem("gtmActivity");
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log("✅ Container ripristinato da LocalStorage:", parsed);
        setContainer(parsed);
        
        // Ripristina anche l'analysis se disponibile
        if (savedAnalysis) {
          try {
            const parsedAnalysis = JSON.parse(savedAnalysis);
            console.log("✅ Analysis ripristinata da LocalStorage:", parsedAnalysis);
            setAnalysis(parsedAnalysis);
          } catch (err) {
            console.error("❌ Errore nel parsing dell'analysis salvata:", err);
          }
        }

        // Ripristina anche l'activity se disponibile
        if (savedActivity) {
          try {
            const parsedActivity = JSON.parse(savedActivity);
            console.log("✅ Activity ripristinata da LocalStorage:", parsedActivity);
            setActivity(parsedActivity);
          } catch (err) {
            console.error("❌ Errore nel parsing dell'activity salvata:", err);
          }
        }
      } catch (err) {
        console.error("❌ Errore nel parsing del container salvato:", err);
      }
    } else {
      console.warn("ℹ️ Nessun container trovato in localStorage.");
    }
  }, []);

  // ✅ Calcolo automatico delle analisi quando cambia il container
  useEffect(() => {
    if (!container) {
      localStorage.removeItem('gtmContainer');
      localStorage.removeItem('gtmAnalysis');
      localStorage.removeItem('gtmActivity');
      setAnalysis(null);
      return;
    }
    
    try {
      const metrics = calculateGtmMetrics(container);
      setAnalysis(metrics);
      localStorage.setItem('gtmAnalysis', JSON.stringify(metrics));
      console.log("✅ Analysis calcolata e salvata:", metrics.score.total);
    } catch (err) {
      console.error("❌ Errore nel calcolo dell'analysis:", err);
      setAnalysis(null);
    }
  }, [container]);

  // ✅ Salvataggio automatico
  useEffect(() => {
    if (container) {
      localStorage.setItem("gtmContainer", JSON.stringify(container));
      console.log("💾 Container salvato su localStorage:", container);

      if (
        container.tag?.length === 0 ||
        container.trigger?.length === 0 ||
        container.variable?.length === 0
      ) {
        console.warn("⚠️ Container ha proprietà vuote: ", container);
      }
    } else {
      localStorage.removeItem("gtmContainer");
      localStorage.removeItem("gtmAnalysis");
      console.log("🧹 Container e analysis rimossi da localStorage");
    }
  }, [container]);

  // ✅ Salvataggio automatico dell'analysis
  useEffect(() => {
    if (analysis) {
      localStorage.setItem("gtmAnalysis", JSON.stringify(analysis));
      console.log("💾 Analysis salvata su localStorage:", analysis.score.total);
    }
  }, [analysis]);

  // ✅ Salvataggio automatico dell'activity
  useEffect(() => {
    if (activity.length > 0) {
      localStorage.setItem("gtmActivity", JSON.stringify(activity));
      console.log("💾 Activity salvata su localStorage:", activity.length, "entries");
    }
  }, [activity]);

  function recordActivity(e: ActivityEntry) {
    setActivity(prev => {
      const next = [e, ...prev].slice(0, 200);
      try { localStorage.setItem('gtmActivity', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function applyContainerChange(
    action: string,
    entity: { type:'tag'|'trigger'|'variable'; id:string; name?:string },
    mutator: (draft: GenerateDocInput) => void
  ) {
    if (!container) return;
    const before = structuredClone(container);
    const beforeM = analysis ?? calculateGtmMetrics(before);
    const draft = structuredClone(container);
    mutator(draft);
    const afterM = calculateGtmMetrics(draft);
    
    // Calcola il delta prima dell'arrotondamento
    const beforeScore = beforeM.score.total;
    const afterScore = afterM.score.total;
    const delta = Number((afterScore - beforeScore).toFixed(1));
    
    // Log per debug
    console.log(`🔄 ${action}: ${beforeScore}% → ${afterScore}% (Δ${delta}%)`);
    
    setContainer(draft);
    setAnalysis(afterM);
    recordActivity({
      id: (globalThis.crypto?.randomUUID?.() ?? '') || String(Date.now()),
      ts: Date.now(),
      action,
      entity,
      deltaScore: delta,
    });
  }

  return (
    <ContainerContext.Provider value={{ container, setContainer, analysis, setAnalysis, activity, applyContainerChange }}>
      {children}
    </ContainerContext.Provider>
  );
}

export function useContainer(): ContainerContextType {
  const context = useContext(ContainerContext);
  if (!context) {
    throw new Error("useContainer must be used within a ContainerProvider");
  }
  return context;
}
