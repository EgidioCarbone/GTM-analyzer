// src/hooks/useGa4Property.ts
import { useEffect, useState } from "react";

export function useGa4Property() {
  const [propertyId, setPropertyId] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("ga4:propertyId");
    if (saved) setPropertyId(saved);
  }, []);

  const update = (id: string) => {
    setPropertyId(id);
    localStorage.setItem("ga4:propertyId", id);
  };

  return { propertyId, setPropertyId: update };
}
