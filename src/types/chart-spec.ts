export type ChartKind = "scorecard" | "line" | "bar" | "pie" | "table";

export type GA4Filter = { field: string; op: "=" | "!=" | "in" | "nin" | "contains"; value: any };

export type GA4Query = {
  propertyId: string;               // <— scelto dall’utente
  metrics: string[];                // es: ["screenPageViews"]
  dimensions?: string[];            // es: ["date","defaultChannelGroup"]
  filters?: GA4Filter[];
  orderBy?: { field: string; desc?: boolean }[];
  grain?: "day" | "week" | "month"; // per time series
  dateMode: "relativeDays" | "explicitRange";
  relativeDays?: number;
  startDate?: string;
  endDate?: string;
};

export type ChartSpec = {
  id: string;
  title: string;
  kind: ChartKind;
  query: GA4Query;
  // opzionale: preferenze di resa
  enc?: { x?: string; y?: string; category?: string; value?: string; topN?: number; legend?: boolean };
};
