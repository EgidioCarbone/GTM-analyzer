import React from "react";
import { useNavigate } from "react-router-dom";
import { BarChart } from "lucide-react";


export default function DashboardSource() {
const nav = useNavigate();
const [loading, setLoading] = React.useState(true);
const [cfg, setCfg] = React.useState<{ ga4: { enabled: boolean; suggested: string[] } } | null>(null);
const [propertyId, setPropertyId] = React.useState("");


React.useEffect(() => {
(async () => {
const r = await fetch("/api/studio/sources");
const j = await r.json();
setCfg(j);
// precompila propertyId se presente
const suggested = j?.ga4?.suggested?.[0];
const persisted = localStorage.getItem("ga4:propertyId");
if (persisted) setPropertyId(persisted);
else if (suggested) setPropertyId(suggested);
setLoading(false);
})();
}, []);


if (loading) return <div className="p-8 text-gray-500">Caricamento…</div>;


const disabled = !cfg?.ga4?.enabled;


function handleContinue() {
// Persisto per lo Studio
if (propertyId) localStorage.setItem("ga4:propertyId", propertyId);
nav(`/dashboard-studio?property=${encodeURIComponent(propertyId)}`);
}


return (
<div className="max-w-3xl mx-auto ">
<h1 className="text-2xl font-semibold">Scegli la sorgente dati</h1>


<div className={`rounded-xl border p-5 bg-white ${disabled ? "opacity-60" : ""}`}>
<div className="flex items-center gap-3 mb-3">
<div className="w-10 h-10 rounded-lg bg-cyan-500 text-white flex items-center justify-center">
<BarChart className="w-6 h-6" />
</div>
<div className="text-lg font-medium">Google Analytics 4 (GA4)</div>
<span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">Disponibile</span>
</div>


<label className="text-sm text-gray-600">GA4 Property ID</label>
<input
className="mt-1 w-full border rounded p-2"
placeholder="es. 452166144"
value={propertyId}
onChange={(e) => setPropertyId(e.target.value)}
disabled={disabled}
/>


<div className="mt-4 flex gap-2 flex-wrap">
{cfg?.ga4?.suggested?.map((p: string) => (
<button key={p} onClick={() => setPropertyId(p)} className="px-2 py-1 text-sm border rounded">
{p}
</button>
))}
</div>


<div className="mt-5">
<button
onClick={handleContinue}
disabled={!propertyId || disabled}
className={`px-4 py-2 rounded text-white ${!propertyId || disabled ? "bg-gray-400" : "bg-black hover:opacity-90"}`}
>
Continua
</button>
</div>
</div>
</div>
);
}