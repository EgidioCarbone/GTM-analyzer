// src/context/ContainerContext.tsx

import React, { createContext, useContext, useState, useEffect } from "react";

const ContainerContext = createContext(null);

export function ContainerProvider({ children }) {
  const [container, setContainer] = useState(null);

  // 🔹 Ripristino automatico all'avvio
  useEffect(() => {
    const saved = localStorage.getItem("gtmContainer");
    if (saved) {
      try {
        setContainer(JSON.parse(saved));
        console.log("✅ Container ripristinato da LocalStorage");
      } catch {
        console.error("❌ Errore nel ripristino del container salvato.");
      }
    }
  }, []);

  // 🔹 Salvataggio automatico
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

export function useContainer() {
  return useContext(ContainerContext);
}