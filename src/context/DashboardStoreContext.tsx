import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChartSpec } from "../components/ChartCard";
import type { StudioFilters } from "../hooks/useStudioRunner";

export type DashboardDefinition = {
  id: string;
  title: string;
  charts: ChartSpec[];
  filters: StudioFilters;
  sourceId?: string | null;
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
      const parsed = raw ? (JSON.parse(raw) as DashboardDefinition[]) : [];
      return normalizeDashboards(parsed);
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
        const nextStamp = new Date().toISOString();
      setDashboards((prev) => {
          const nextStamp = new Date().toISOString();
          const normalizedTitle = (d.title || "").trim().toLowerCase();
          const sourceKey = d.sourceId || "none";
          const key = `${normalizedTitle}|${sourceKey}`;

          // Reuse existing dashboard id if same title+source already exists
          const existingByKey = prev.find(
            (p) => (p.title || "").trim().toLowerCase() === normalizedTitle && (p.sourceId || "none") === sourceKey
          );
          const targetId = existingByKey?.id || d.id;
          const nextDash: DashboardDefinition = { ...d, id: targetId, updatedAt: nextStamp };

          const merged = prev.filter((p) => !( (p.title || "").trim().toLowerCase() === normalizedTitle && (p.sourceId || "none") === sourceKey ));
          merged.push(nextDash);

          const normalized = normalizeDashboards(merged);
          const sorted = normalized.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
          return sorted;
        });
        const normalizedTitle = (d.title || "").trim().toLowerCase();
        const sourceKey = d.sourceId || "none";
        const key = `${normalizedTitle}|${sourceKey}`;
        const match = dashboards.find(
          (p) => (p.title || "").trim().toLowerCase() === normalizedTitle && (p.sourceId || "none") === sourceKey
        );
        const targetId = match?.id || d.id;
        setActiveId(targetId);
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

function normalizeDashboards(list: DashboardDefinition[] | null | undefined) {
  if (!Array.isArray(list)) return [];
  const byKey: Record<string, DashboardDefinition> = {};

  const pickLatest = (existing: DashboardDefinition | undefined, current: DashboardDefinition) => {
    if (!existing) return current;
    const existingTs = existing.updatedAt || "";
    const currentTs = current.updatedAt || "";
    return currentTs.localeCompare(existingTs) >= 0 ? current : existing;
  };

  list.forEach((d) => {
    if (!d?.id) return;
    const titleKey = (d.title || "").trim().toLowerCase();
    const sourceKey = d.sourceId || "none";
    const key = `${titleKey}|${sourceKey}`;
    byKey[key] = pickLatest(byKey[key], d);
  });

  return Object.values(byKey).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
