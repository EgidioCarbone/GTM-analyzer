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

  // Ripristino automatico
  useEffect(() => {
    const saved = localStorage.getItem("GenerateDocInput");
    if (saved) {
      try {
        setContainer(JSON.parse(saved));
        console.log("✅ Container ripristinato da LocalStorage");
      } catch {
        console.error("❌ Errore nel ripristino del container salvato.");
      }
    }
  }, []);

  // Salvataggio automatico
  useEffect(() => {
    if (container) {
      localStorage.setItem("gtmContainer", JSON.stringify(container));
    } else {
      localStorage.removeItem("gtmContainer");
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
