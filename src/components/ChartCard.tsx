// src/components/ChartCard.tsx
import React from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from "recharts";
import { CHART_OPTIONS, ChartType } from "../utils/chartType";

type AnyDict = Record<string, any>;

export type ChartSpec = {
  id: string;
  title: string;
  type: ChartType;           // visualizzazione corrente
  x?: string;                // chiave dimensione (es. "date", "channel")
  y?: string;                // metrica principale (es. "screenPageViews")
  y2?: string;               // metrica secondaria opzionale
  data: AnyDict[];           // dati già pronti (nessun refetch)
};

type Props = {
  spec: ChartSpec;
  onTypeChange?: (id: string, next: ChartType) => void;
};

export default function ChartCard({ spec, onTypeChange }: Props) {
  const { id, title, type, x = "date", y = "value", y2, data } = spec;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onTypeChange?.(id, e.target.value as ChartType);
  };

  // piccoli helper per colonne tabella
  const tableCols = React.useMemo(() => {
    if (!data?.length) return [x, y].filter(Boolean);
    const keys = Object.keys(data[0]);
    // rispetta x/y se presenti
    const preferred = [x, y, y2].filter(Boolean) as string[];
    const rest = keys.filter(k => !preferred.includes(k));
    return [...preferred, ...rest];
  }, [data, x, y, y2]);

  return (
    <div className="rounded-xl bg-white/70 shadow p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        <select
          className="text-sm border rounded px-2 py-1 bg-white"
          value={type}
          onChange={handleChange}
        >
          {CHART_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* RENDER */}
      <div style={{ height: type === "table" ? undefined : 320 }}>
        {type === "table" && (
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {tableCols.map(col => (
                    <th key={col} className="text-left px-3 py-2 font-medium text-gray-600">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.length ? data.map((row, i) => (
                  <tr key={i} className="odd:bg-white even:bg-gray-50">
                    {tableCols.map(col => (
                      <td key={col} className="px-3 py-2 text-gray-800">
                        {row[col] ?? ""}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td className="px-3 py-6 text-gray-500" colSpan={tableCols.length}>
                      Nessun dato
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {type === "line" && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={x} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={y} stroke="#7C3AED" dot={false} />
              {y2 && <Line type="monotone" dataKey={y2} stroke="#10B981" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        )}

        {type === "bar" && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={x} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={y} fill="#6366F1" />
              {y2 && <Bar dataKey={y2} fill="#34D399" />}
            </BarChart>
          </ResponsiveContainer>
        )}

        {type === "area" && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={x} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey={y} fill="#C4B5FD" stroke="#7C3AED" />
              {y2 && <Area type="monotone" dataKey={y2} fill="#A7F3D0" stroke="#10B981" />}
            </AreaChart>
          </ResponsiveContainer>
        )}

        {type === "pie" && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={data}
                dataKey={y}
                nameKey={x}
                outerRadius={110}
                label
              >
                {data?.map((_: any, idx: number) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}

        {type === "scatter" && (
          <div className="text-sm text-gray-500">
            (Per scatter serve una coppia metrica x/y numerica; valuta se mappare
            <span className="font-mono px-1">{`{ x: metricA, y: metricB }`}</span> sul backend.)
          </div>
        )}

        {type === "scorecard" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {(data ?? []).slice(0, 6).map((r, i) => (
              <div
                key={i}
                className="rounded-lg border bg-white p-4 text-center shadow-sm"
              >
                <div className="text-xs text-gray-500">{r[x] ?? "KPI"}</div>
                <div className="text-2xl font-semibold">{r[y]}</div>
              </div>
            ))}
          </div>
        )}

        {type === "gauge" && (
          <div className="text-sm text-gray-500">
            (Gauge non nativo in Recharts: o lib dedicata o semicircle custom. Puoi
            lasciare questa nota o sostituire con scorecard per ora.)
          </div>
        )}

        {type === "funnel" && (
          <div className="text-sm text-gray-500">
            (Funnel non nativo: valuta @ant-design/plots o un componente custom.)
          </div>
        )}
      </div>
    </div>
  );
}

const PIE_COLORS = [
  "#6366F1", "#10B981", "#F59E0B", "#EF4444",
  "#3B82F6", "#8B5CF6", "#22C55E", "#F97316",
];
