// src/context/ContainerContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { GenerateDocInput } from "../types/gtm"; // ✅ importa i tipi

type ContainerContextType = {
  container: GenerateDocInput | null;
  setContainer: (data: GenerateDocInput | null) => void;
};

const ContainerContext = createContext<ContainerContextType | undefined>(undefined);

export function ContainerProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<GenerateDocInput | null>(null);

  // ✅ Ripristino automatico dal localStorage
  useEffect(() => {
    const saved = localStorage.getItem("gtmContainer"); // ✅ chiave corretta
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log("✅ Container ripristinato da LocalStorage:", parsed);
        setContainer(parsed);
      } catch (err) {
        console.error("❌ Errore nel parsing del container salvato:", err);
      }
    } else {
      console.warn("ℹ️ Nessun container trovato in localStorage.");
    }
  }, []);

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
      console.log("🧹 Container rimosso da localStorage");
    }
  }, [container]);

  return (
    <ContainerContext.Provider value={{ container, setContainer }}>
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
