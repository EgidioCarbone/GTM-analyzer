// // src/pages/GA4QuickSearch.tsx
// import React from "react";
// import GA4Chart from "../components/GA4Chart";

// type Kpis = Record<string, number>;
// type TableRow = Record<string, string | number | undefined>;
// type Range = { startDate: string; endDate: string };

// type QuickResult = {
//   reportKey: string;
//   range: Range;
//   kpis: Kpis;
//   table?: { dimension: string; metrics: string[]; rows: TableRow[] } | null;
//   ai?: { narrative: string };
// };

// const fmt = (d: Date) => d.toISOString().slice(0, 10);
// const addDays = (d: Date, delta: number) => new Date(d.getTime() + delta * 24 * 3600 * 1000);

// function SkeletonCard() {
//   return (
//     <div className="border rounded-2xl p-4 bg-white shadow-sm animate-pulse">
//       <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
//       <div className="h-7 w-20 bg-gray-200 rounded" />
//     </div>
//   );
// }

// export default function GA4QuickSearch({
//   onResult,
//   onExplain,
// }: {
//   onResult?: (reportKey: string, range: Range, q: string) => void;
//   onExplain?: () => void;
// }) {
//   const today = React.useMemo(() => new Date(), []);
//   const [q, setQ] = React.useState("Top canali ultimi 28 giorni");
//   const [startDate, setStartDate] = React.useState(fmt(addDays(today, -27)));
//   const [endDate, setEndDate] = React.useState(fmt(today));

//   const [withAI, setWithAI] = React.useState(false);
//   const [prompt, setPrompt] = React.useState("");

//   const [loading, setLoading] = React.useState<"idle" | "search">("idle");
//   const [error, setError] = React.useState<string | null>(null);
//   const [data, setData] = React.useState<QuickResult | null>(null);

//   const applyQuick = (days: number) => {
//     const end = new Date();
//     const start = addDays(end, -days + 1);
//     setStartDate(fmt(start));
//     setEndDate(fmt(end));
//   };

//   const PRESETS = [
//     "Top canali ultimi 28 giorni",
//     "Mobile vs desktop ultimi 30 giorni",
//     "Pagine con più conversioni",
//     "Paesi con bounce rate alto",
//   ];

//   const runSearch = async () => {
//     try {
//       setLoading("search");
//       setError(null);
//       setData(null);

//       const res = await fetch("/api/ga4/search", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           q,
//           startDate,
//           endDate,
//           withAI,
//           prompt: prompt?.trim() || undefined,
//         }),
//       });

//       if (!res.ok) {
//         const txt = await res.text();
//         throw new Error(txt || "Errore risposta server");
//       }

//       const json = (await res.json()) as QuickResult;
//       setData(json);
//       onResult?.(json.reportKey, json.range, q);
//       setLoading("idle");
//     } catch (e: any) {
//       const msg = e?.message?.includes("Failed to fetch")
//         ? "Impossibile contattare il server. Verifica che il backend sia su :3001 e che il proxy Vite punti alla porta corretta."
//         : e?.message || "Errore inatteso";
//       setError(msg);
//       setLoading("idle");
//     }
//   };

//   return (
//     <div className="space-y-6">
//       {/* Header + quick date */}
//       <div className="flex items-center justify-between">
//         <h2 className="text-xl font-semibold">Dati</h2>
//         <div className="flex gap-2">
//           <button title="Ultimi 7 giorni" className="px-3 py-2 border rounded-2xl" onClick={() => applyQuick(7)}>7g</button>
//           <button title="Ultimi 28 giorni" className="px-3 py-2 border rounded-2xl" onClick={() => applyQuick(28)}>28g</button>
//           <button title="Ultimi 90 giorni" className="px-3 py-2 border rounded-2xl" onClick={() => applyQuick(90)}>90g</button>
//         </div>
//       </div>

//       {/* Barra di ricerca */}
//       <div className="flex gap-2 flex-wrap">
//         <input
//           className="flex-1 min-w-[260px] border rounded-2xl px-3 py-2 bg-white"
//           placeholder='Es. "Top canali ultimi 28 giorni"'
//           value={q}
//           onChange={(e) => setQ(e.target.value)}
//           onKeyDown={(e) => e.key === "Enter" && runSearch()}
//         />
//         <input
//           type="date"
//           className="border rounded-2xl px-3 py-2 bg-white"
//           value={startDate}
//           onChange={(e) => setStartDate(e.target.value)}
//           max={endDate}
//         />
//         <input
//           type="date"
//           className="border rounded-2xl px-3 py-2 bg-white"
//           value={endDate}
//           onChange={(e) => setEndDate(e.target.value)}
//           min={startDate}
//           max={fmt(today)}
//         />
//         <button
//           onClick={runSearch}
//           disabled={loading !== "idle"}
//           className={`px-4 py-2 rounded-2xl text-white ${
//             loading !== "idle" ? "bg-gray-400 cursor-wait" : "bg-black hover:bg-gray-800"
//           }`}
//         >
//           {loading === "search" ? "Ricerca…" : "Cerca"}
//         </button>
//       </div>

//       {/* Preset rapidi */}
//       <div className="flex gap-2 flex-wrap text-sm">
//         {PRESETS.map((p) => (
//           <button
//             key={p}
//             className="px-2 py-1 rounded-full border bg-white/70 hover:bg-white"
//             onClick={() => setQ(p)}
//             title={`Usa: ${p}`}
//           >
//             {p}
//           </button>
//         ))}
//       </div>

//       {/* IA opzionale */}
//       <div className="flex items-center gap-2">
//         <input id="with-ai" type="checkbox" checked={withAI} onChange={(e) => setWithAI(e.target.checked)} />
//         <label htmlFor="with-ai" className="text-sm">Genera anche insight IA</label>
//       </div>
//       {withAI && (
//         <textarea
//           className="w-full min-h-[80px] rounded-xl border px-3 py-2 bg-white"
//           placeholder="Prompt opzionale (se vuoto, viene generato automaticamente)"
//           value={prompt}
//           onChange={(e) => setPrompt(e.target.value)}
//         />
//       )}

//       {/* Errori */}
//       {error && (
//         <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 border border-red-200">
//           {error}
//         </div>
//       )}

//       {/* Loading skeleton */}
//       {loading === "search" && !error && (
//         <div className="space-y-4">
//           <div className="grid md:grid-cols-5 sm:grid-cols-2 gap-4">
//             <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
//           </div>
//           <div className="rounded-2xl bg-white shadow-sm border p-4 animate-pulse h-[320px]" />
//         </div>
//       )}

//       {/* Risultati */}
//       {data && loading === "idle" && (
//         <div className="space-y-6">
//           {/* KPI */}
//           {data.kpis && (
//             <div className="grid md:grid-cols-5 sm:grid-cols-2 gap-4">
//               {Object.entries(data.kpis).map(([k, v]) => (
//                 <div key={k} className="border rounded-2xl p-4 shadow-sm bg-white">
//                   <div className="text-xs text-gray-500 truncate">{k}</div>
//                   <div className="text-2xl font-semibold">{Number(v ?? 0).toLocaleString("it-IT")}</div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* Grafico elegante */}
//           {data.table?.rows && data.table.rows.length > 0 && (
//             <GA4Chart
//               title={
//                 data.table.dimension === "date"
//                   ? "Andamento giornaliero"
//                   : `Top ${data.table.dimension}`
//               }
//               dimension={data.table.dimension}
//               metrics={data.table.metrics}
//               rows={data.table.rows as any}
//               height={320}
//             />
//           )}

//           {/* Tabella */}
//           {data.table?.rows?.length ? (
//             <div className="rounded-2xl bg-white shadow-sm border p-4">
//               <div className="text-sm font-semibold mb-2">
//                 {data.table.dimension} — {data.table.metrics.join(", ")}
//               </div>
//               <div className="overflow-x-auto">
//                 <table className="min-w-[600px] text-sm">
//                   <thead>
//                     <tr className="text-left text-gray-500">
//                       <th className="py-2 pr-4">{data.table.dimension}</th>
//                       {data.table.metrics.map((m) => (
//                         <th key={m} className="py-2 pr-4">{m}</th>
//                       ))}
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {data.table.rows.map((r, i) => (
//                       <tr key={i} className="border-t hover:bg-gray-50">
//                         <td className="py-2 pr-4">{String(r[data.table!.dimension])}</td>
//                         {data.table!.metrics.map((m) => (
//                           <td key={m} className="py-2 pr-4">{String(r[m] ?? "-")}</td>
//                         ))}
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           ) : null}

//           {/* CTA Insight */}
//           {data.reportKey && (
//             <div className="flex justify-end">
//               <button className="px-4 py-2 rounded-2xl bg-black text-white hover:bg-gray-800" onClick={() => onExplain?.()}>
//                 Spiega questi numeri
//               </button>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }
