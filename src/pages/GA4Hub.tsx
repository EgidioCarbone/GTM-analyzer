// // src/pages/GA4Hub.tsx
// import React from "react";
// import GA4Insights from "./GA4Insights";

// type Range = { startDate: string; endDate: string };

// export default function GA4Hub() {
//   const [activeTab, setActiveTab] = React.useState<"data" | "insight">("data");

//   // stato condiviso tra tab
//   const [reportKey, setReportKey] = React.useState<string | null>(null);
//   const [range, setRange] = React.useState<Range | null>(null);
//   const [lastQuery, setLastQuery] = React.useState<string>("");

//   // passaggi UX:
//   // 1) QuickSearch, quando fa /report o /search, chiama onResult per salvare reportKey e range
//   // 2) il bottone "Spiega questi numeri" chiama onExplain() -> switch tab Insight

//   return (
//     <div className="min-h-screen px-6 py-8 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
//       {/* Header */}
//       <div className="max-w-6xl mx-auto mb-4">
//         <h1 className="text-2xl font-semibold text-gray-900">Google Analytics 4</h1>
//         <p className="text-gray-600 text-sm">Cerca dati e ottieni spiegazioni dall’IA sullo stesso periodo.</p>
//       </div>

//       {/* Tabs */}
//       <div className="max-w-6xl mx-auto">
//         <div className="flex gap-2 mb-4">
//           <button
//             className={`px-4 py-2 rounded-xl border ${activeTab === "data" ? "bg-white shadow" : "bg-white/60"}`}
//             onClick={() => setActiveTab("data")}
//             aria-pressed={activeTab === "data"}
//           >
//             Dati
//           </button>
//           <button
//             className={`px-4 py-2 rounded-xl border ${activeTab === "insight" ? "bg-white shadow" : "bg-white/60"}`}
//             onClick={() => setActiveTab("insight")}
//             aria-pressed={activeTab === "insight"}
//           >
//             Insight
//           </button>
//           {/* badge periodo condiviso */}
//           {range && (
//             <span className="ml-auto text-sm text-gray-600">
//               Periodo: <strong>{range.startDate}</strong> → <strong>{range.endDate}</strong>
//             </span>
//           )}
//         </div>

//         {/* Tab content */}
//         <div className="rounded-2xl bg-white/70 p-4 border shadow-sm">
//           {activeTab === "data" ? (
//             <GA4QuickSearch
//               // estendi il componente per accettare questi callback/prop
//               onResult={(rk: string, r: Range, q: string) => {
//                 setReportKey(rk);
//                 setRange(r);
//                 setLastQuery(q);
//               }}
//               onExplain={() => setActiveTab("insight")}
//             />
//           ) : (
//             <GA4Insights
//               // estendi il componente per accettare range+reportKey se già presenti
//               presetRange={range}
//               presetReportKey={reportKey}
//               lastQuery={lastQuery}
//               onNeedData={() => setActiveTab("data")} // se manca il report invita a tornare su "Dati"
//             />
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
