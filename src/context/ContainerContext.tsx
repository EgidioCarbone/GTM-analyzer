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

type ContainerContextType = {
  container: GenerateDocInput | null;
  setContainer: (data: GenerateDocInput | null) => void;
  analysis: GtmMetrics | null;
  setAnalysis: (m: GtmMetrics | null) => void;
};

const ContainerContext = createContext<ContainerContextType | undefined>(undefined);

export function ContainerProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<GenerateDocInput | null>(null);
  const [analysis, setAnalysis] = useState<GtmMetrics | null>(null);

  // ✅ Ripristino automatico dal localStorage
  useEffect(() => {
    const saved = localStorage.getItem("gtmContainer"); // ✅ chiave corretta
    const savedAnalysis = localStorage.getItem("gtmAnalysis");
    
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
      setAnalysis(null);
      return;
    }
    
    try {
      const metrics = calculateGtmMetrics(container);
      setAnalysis(metrics);
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

  return (
    <ContainerContext.Provider value={{ container, setContainer, analysis, setAnalysis }}>
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
