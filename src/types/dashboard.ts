// src/types/dashboard.ts
export type DateMode = "inherit" | "custom";
export type WidgetType = "kpi" | "timeseries" | "bar" | "table" | "pie";

export type GA4Query = {
  metrics: string[];
  dimensions?: string[];
  filters?: Array<{ field: string; op: "=" | "!=" | "in" | "nin" | "contains"; value: any }>;
  orderBy?: { field: string; desc?: boolean }[];
  dateMode?: DateMode;
  startDate?: string;
  endDate?: string;
  grain?: "day" | "week" | "month";
};

export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  query: GA4Query;
  viz?: { showLegend?: boolean; topN?: number; valuePrefix?: string; valueSuffix?: string };
  layout?: { w: number; h: number };
};

export type Dashboard = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  filters: {
    dateMode: "relativeDays" | "explicitRange";
    relativeDays?: number;
    startDate?: string;
    endDate?: string;
    segments?: Array<{ field: string; op: string; value: any }>;
  };
  widgets: Widget[];
};
