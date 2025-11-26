export type SourceType = "ga4" | "api" | "db" | "other";

export type Source = {
  id: string;
  name: string;
  type: SourceType;
  externalId: string;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type NewSourceInput = {
  name: string;
  type: SourceType;
  externalId: string;
  workspaceId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};
