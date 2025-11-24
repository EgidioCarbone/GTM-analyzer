import React, { createContext, useContext, useEffect, useState } from "react";

type Ga4PropertyContextValue = {
  propertyId: string | null;
  setPropertyId: (id: string | null) => void;
};

const Ga4PropertyContext = createContext<Ga4PropertyContextValue | undefined>(undefined);

export function Ga4PropertyProvider({ children }: { children: React.ReactNode }) {
  const [propertyId, setPropertyIdState] = useState<string | null>(() => {
    return localStorage.getItem("ga4PropertyId") || localStorage.getItem("ga4:propertyId") || null;
  });

  const setPropertyId = (id: string | null) => {
    setPropertyIdState(id);
    if (id) {
      localStorage.setItem("ga4PropertyId", id);
      localStorage.setItem("ga4:propertyId", id);
    } else {
      localStorage.removeItem("ga4PropertyId");
      localStorage.removeItem("ga4:propertyId");
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("ga4PropertyId") || localStorage.getItem("ga4:propertyId");
    if (stored && stored !== propertyId) {
      setPropertyIdState(stored);
    }
  }, [propertyId]);

  return (
    <Ga4PropertyContext.Provider value={{ propertyId, setPropertyId }}>
      {children}
    </Ga4PropertyContext.Provider>
  );
}

export function useGa4Property() {
  const ctx = useContext(Ga4PropertyContext);
  if (!ctx) {
    throw new Error("useGa4Property must be used within Ga4PropertyProvider");
  }
  return ctx;
}
