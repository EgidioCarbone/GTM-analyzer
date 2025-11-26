import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { NewSourceInput, Source } from "../types/source";

type SourceStoreValue = {
  sources: Source[];
  selectedSourceId: string | null;
  selectedSource: Source | null;
  addSource: (input: NewSourceInput) => Source;
  selectSource: (id: string | null) => void;
  refresh: () => void;
};

const SourceStoreContext = createContext<SourceStoreValue | undefined>(undefined);

const STORAGE_KEY = "dataSources:v1";
const SELECTED_KEY = "dataSources:selectedId";
const DEFAULT_WORKSPACE = "default";

function nowIso() {
  return new Date().toISOString();
}

function loadSources(): Source[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedDefaults();
    const parsed = JSON.parse(raw) as Source[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedDefaults();
  } catch {
    return seedDefaults();
  }
}

function seedDefaults(): Source[] {
  const stamp = nowIso();
  return [
    {
      id: "demo-site",
      name: "Demo Site",
      type: "ga4",
      externalId: "GA4-000000",
      workspaceId: DEFAULT_WORKSPACE,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];
}

function persistSources(list: Source[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function persistSelected(id: string | null) {
  if (id) localStorage.setItem(SELECTED_KEY, id);
  else localStorage.removeItem(SELECTED_KEY);
}

export function SourceStoreProvider({
  children,
  workspaceId = DEFAULT_WORKSPACE,
}: {
  children: React.ReactNode;
  workspaceId?: string;
}) {
  const [sources, setSources] = useState<Source[]>(() => loadSources().filter((s) => !workspaceId || s.workspaceId === workspaceId || !s.workspaceId));
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(() => {
    const stored = localStorage.getItem(SELECTED_KEY);
    if (stored) return stored;
    const list = loadSources();
    return list[0]?.id ?? null;
  });

  const selectedSource = useMemo(
    () => sources.find((s) => s.id === selectedSourceId) || null,
    [sources, selectedSourceId]
  );

  useEffect(() => {
    persistSources(sources);
  }, [sources]);

  useEffect(() => {
    persistSelected(selectedSourceId);
  }, [selectedSourceId]);

  const value: SourceStoreValue = useMemo(
    () => ({
      sources,
      selectedSourceId,
      selectedSource,
      addSource: (input) => {
        const stamp = nowIso();
        const trimmedName = input.name.trim();
        const trimmedExternalId = input.externalId.trim();
        if (!trimmedName) throw new Error("Il nome della source è obbligatorio");
        if (!trimmedExternalId) throw new Error("L'ID della source è obbligatorio");

        const next: Source = {
          id: crypto.randomUUID(),
          name: trimmedName,
          type: input.type,
          externalId: trimmedExternalId,
          workspaceId: input.workspaceId || workspaceId,
          createdAt: stamp,
          updatedAt: stamp,
          notes: input.notes,
          metadata: input.metadata,
        };
        setSources((prev) => [...prev, next]);
        setSelectedSourceId(next.id);
        return next;
      },
      selectSource: (id) => {
        setSelectedSourceId(id);
      },
      refresh: () => {
        setSources(loadSources().filter((s) => !workspaceId || s.workspaceId === workspaceId || !s.workspaceId));
        const stored = localStorage.getItem(SELECTED_KEY);
        if (stored) setSelectedSourceId(stored);
      },
    }),
    [selectedSource, selectedSourceId, sources, workspaceId]
  );

  return <SourceStoreContext.Provider value={value}>{children}</SourceStoreContext.Provider>;
}

export function useSourceStore() {
  const ctx = useContext(SourceStoreContext);
  if (!ctx) throw new Error("useSourceStore must be used within SourceStoreProvider");
  return ctx;
}
