// src/components/GA4Chart.tsx
import React from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

type ChartProps = {
  title?: string;
  dimension: string;          // es. "date" | "defaultChannelGroup" | "deviceCategory" | "pagePath"
  metrics: string[];          // es. ["sessions", "activeUsers"]
  rows: Array<Record<string, string | number | undefined>>;
  height?: number;            // default 300
};

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

export default function GA4Chart({
  title, dimension, metrics, rows, height = 300
}: ChartProps) {
  const isTimeSeries = dimension === "date";
  const safeRows = rows ?? [];

  return (
    <div className="rounded-2xl bg-white shadow-sm border p-4">
      {title && <div className="text-sm font-semibold mb-2">{title}</div>}
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          {isTimeSeries ? (
            <AreaChart data={safeRows}>
              <defs>
                {metrics.map((m, i) => (
                  <linearGradient id={`g-${i}`} x1="0" y1="0" x2="0" y2="1" key={m}>
                    <stop offset="0%" stopOpacity={0.22} stopColor={COLORS[i % COLORS.length]} />
                    <stop offset="100%" stopOpacity={0} stopColor={COLORS[i % COLORS.length]} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dimension} />
              <YAxis />
              <Tooltip />
              <Legend />
              {metrics.map((m, i) => (
                <Area
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stroke={COLORS[i % COLORS.length]}
                  fillOpacity={1}
                  fill={`url(#g-${i})`}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={safeRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dimension} interval={0} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              {metrics.map((m, i) => (
                <Bar key={m} dataKey={m} fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
