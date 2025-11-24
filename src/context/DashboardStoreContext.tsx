import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChartSpec } from "../components/ChartCard";
import type { StudioFilters } from "../hooks/useStudioRunner";

export type DashboardDefinition = {
  id: string;
  title: string;
  charts: ChartSpec[];
  filters: StudioFilters;
  isPublic?: boolean;
  publicSlug?: string;
  sourceName?: string;
  updatedAt?: string;
};

type DashboardStoreValue = {
  dashboards: DashboardDefinition[];
  activeId: string | null;
  filters: StudioFilters;
  setFilters: (f: StudioFilters) => void;
  setActiveDashboard: (id: string | null) => void;
  upsertDashboard: (d: DashboardDefinition) => void;
  deleteDashboard: (id: string) => void;
};

const DashboardStoreContext = createContext<DashboardStoreValue | undefined>(undefined);

const defaultFilters: StudioFilters = {
  startDate: (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 27);
    return start.toISOString().slice(0, 10);
  })(),
  endDate: new Date().toISOString().slice(0, 10),
  granularity: "daily",
  compareToPrev: false,
};

export function DashboardStoreProvider({ children }: { children: React.ReactNode }) {
  const [dashboards, setDashboards] = useState<DashboardDefinition[]>(() => {
    try {
      const raw = localStorage.getItem("dashboards");
      return raw ? (JSON.parse(raw) as DashboardDefinition[]) : [];
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState<StudioFilters>(defaultFilters);

  useEffect(() => {
    localStorage.setItem("dashboards", JSON.stringify(dashboards));
  }, [dashboards]);

  const value: DashboardStoreValue = useMemo(
    () => ({
      dashboards,
      activeId,
      filters,
      setFilters,
      setActiveDashboard: (id) => setActiveId(id),
      upsertDashboard: (d) => {
        setDashboards((prev) => {
          const idx = prev.findIndex((p) => p.id === d.id);
          const next = { ...d, updatedAt: new Date().toISOString() };
          if (idx === -1) return [next, ...prev];
          const clone = [...prev];
          clone[idx] = next;
          return clone;
        });
        setActiveId(d.id);
      },
      deleteDashboard: (id) => {
        setDashboards((prev) => prev.filter((d) => d.id !== id));
        if (activeId === id) setActiveId(null);
      },
    }),
    [dashboards, activeId, filters]
  );

  return <DashboardStoreContext.Provider value={value}>{children}</DashboardStoreContext.Provider>;
}

export function useDashboardStore() {
  const ctx = useContext(DashboardStoreContext);
  if (!ctx) throw new Error("useDashboardStore must be used within DashboardStoreProvider");
  return ctx;
}
