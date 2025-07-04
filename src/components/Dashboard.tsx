// src/components/Dashboard.tsx

import React from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";

export default function Dashboard({ data, onReplace }) {
  const tagCount = data.tag?.length ?? 0;
  const triggerCount = data.trigger?.length ?? 0;
  const varCount = data.variable?.length ?? 0;

  const typeLabels = {
    awct: "Google Ads Conversion",
    gclidw: "GCLID Linker",
    sp: "Google Ads Remarketing",
    img: "Pixel Image",
    html: "Custom HTML",
    ua: "Universal Analytics",
    gaawc: "GA4 Event",
    ldp: "LinkedIn Insight",
  };

  const tagsByType = {};
  data.tag?.forEach((t) => {
    const raw = t.type || "(sconosciuto)";
    tagsByType[raw] = (tagsByType[raw] || 0) + 1;
  });

  const pieData = Object.entries(tagsByType).map(([k, v]) => ({
    name: typeLabels[k] || k,
    value: v,
  }));

  const topBarData = [...pieData].sort((a, b) => b.value - a.value).slice(0, 5);

  const colors = ["#FF6B35", "#1a365d", "#4caf50", "#ffc107", "#2196f3"];

  const pausedTags = data.tag?.filter((t) => t.paused)?.length ?? 0;

  const unusedTriggers = (data.trigger ?? []).filter(
    (tr) => !(data.tag ?? []).some((tag) => (tag.triggerId ?? []).includes(tr.triggerId))
  ).length ?? 0;

  const usedVarIds = new Set<number>();
  data.tag?.forEach((tag) => (tag.variableId ?? []).forEach((v) => usedVarIds.add(v)));
  const unusedVariables = (data.variable ?? []).filter(
    (v) => !usedVarIds.has(v.variableId as number)
  ).length ?? 0;

  const uaTags = data.tag?.filter((t) => t.type === "ua")?.length ?? 0;
  const issues = pausedTags + unusedTriggers + unusedVariables + uaTags;
  const quality = issues === 0 ? "Ottimo" : issues < 10 ? "Buono" : "Da migliorare";

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-[#1a365d] dark:text-orange-300 flex items-center gap-2">
          📊 Dashboard del contenitore
        </h1>
      </div>

      {/* Counters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Tag" value={tagCount} />
        <Card title="Trigger" value={triggerCount} />
        <Card title="Variabili" value={varCount} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow hover:shadow-lg transition min-h-[320px]">
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
            📈 Distribuzione tipi di tag
          </h2>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 italic mt-4">Nessun dato disponibile.</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow hover:shadow-lg transition min-h-[320px]">
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
            🏆 Classifica tipi di tag (Top 5)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" stroke="#888" />
              <YAxis dataKey="name" type="category" width={160} stroke="#888" />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#1a365d" radius={[0, 6, 6, 0]} isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Container Quality */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow hover:shadow-lg transition">
        <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
          🩺 Qualità del container
        </h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li>{pausedTags} tag in pausa</li>
          <li>{unusedVariables} variabili non usate</li>
          <li>{uaTags} tag Universal Analytics (obsoleti)</li>
          <li>
            Stato generale:{" "}
            <span
              className={
                quality === "Ottimo"
                  ? "text-green-600 dark:text-green-400 font-semibold"
                  : quality === "Buono"
                  ? "text-yellow-600 dark:text-yellow-400 font-semibold"
                  : "text-red-600 dark:text-red-400 font-semibold"
              }
            >
              {quality}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center transform hover:-translate-y-1 hover:shadow-lg transition">
      <div className="text-4xl font-bold text-[#1a365d] dark:text-orange-300">{value}</div>
      <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{title}</div>
    </div>
  );
}