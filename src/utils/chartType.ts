// src/utils/chartType.ts
export type ChartType =
  | "table"
  | "bar"
  | "line"
  | "pie"
  | "area"
  | "scatter"
  | "scorecard"
  | "gauge"
  | "funnel";

export const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "pie", label: "Pie" },
  { value: "area", label: "Area" },
  { value: "scatter", label: "Scatter" },
  { value: "scorecard", label: "Scorecard" },
  { value: "gauge", label: "Gauge" },
  { value: "funnel", label: "Funnel" },
];

// tenta di capire il tipo di grafico dal testo utente (it/en)
export function parseChartTypeFromPrompt(prompt: string): ChartType | null {
  const p = prompt.toLowerCase();

  const hit = (keys: string[]) => keys.some(k => p.includes(k));

  if (hit(["torta", "pie"])) return "pie";
  if (hit(["barre", "bar", "istogramma"])) return "bar";
  if (hit(["linee", "line"])) return "line";
  if (hit(["area"])) return "area";
  if (hit(["dispersione", "scatter"])) return "scatter";
  if (hit(["scorecard", "kpi"])) return "scorecard";
  if (hit(["gauge", "tachimetro"])) return "gauge";
  if (hit(["funnel", "imbuto"])) return "funnel";

  return null;
}
