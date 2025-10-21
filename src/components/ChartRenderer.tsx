import React from "react";
import {
  ResponsiveContainer,
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from "recharts";

export type ChartKind = "line" | "area" | "bar" | "pie" | "table" | "scorecard";
export type ChartData = {
  headers: { dimensions: string[]; metrics: string[] };
  rows: { dims: string[]; metrics: number[] }[];
};

function toSeries(data: ChartData) {
  const xKey = data.headers.dimensions[0] || "label";
  const yKey = data.headers.metrics[0] || "value";
  return data.rows.map(r => ({
    [xKey]: r.dims[0] ?? "",
    [yKey]: r.metrics[0] ?? 0
  }));
}

const COLORS = ["#6366f1","#22c55e","#ef4444","#f59e0b","#06b6d4","#9333ea","#db2777"];

export default function ChartRenderer({
  kind,
  data,
  height = 280,
}: { kind: ChartKind; data: ChartData; height?: number }) {

  // fallback: se non ho metriche/dimensioni, rendo un placeholder
  if (!data || !data.headers) {
    return <div className="text-sm text-gray-500 p-3">Nessun dato.</div>;
  }

  const xKey = data.headers.dimensions[0] || "label";
  const yKey = data.headers.metrics[0] || "value";
  const series = toSeries(data);

  if (kind === "table") {
    return (
      <div className="overflow-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {data.headers.dimensions.map((d) => <th key={d} className="px-3 py-2 text-left">{d}</th>)}
              {data.headers.metrics.map((m) => <th key={m} className="px-3 py-2 text-right">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50">
                {r.dims.map((d, j) => <td key={`d${j}`} className="px-3 py-2">{d}</td>)}
                {r.metrics.map((m, j) => <td key={`m${j}`} className="px-3 py-2 text-right">{m}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (kind === "scorecard") {
    const total = data.rows.reduce((acc, r) => acc + (r.metrics[0] || 0), 0);
    return (
      <div className="flex items-center justify-center h-[140px] rounded-lg bg-white shadow-inner">
        <div className="text-center">
          <div className="text-gray-500 text-sm">{yKey}</div>
          <div className="text-4xl font-bold">{total.toLocaleString()}</div>
        </div>
      </div>
    );
  }

  if (kind === "pie") {
    return (
      <div style={{height}}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={series} dataKey={yKey} nameKey={xKey} outerRadius={100}>
              {series.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (kind === "bar") {
    return (
      <div style={{height}}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={yKey} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (kind === "area") {
    return (
      <div style={{height}}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area dataKey={yKey} type="monotone" fill="#8884d8" stroke="#8884d8" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // default: line
  return (
    <div style={{height}}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={yKey} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
