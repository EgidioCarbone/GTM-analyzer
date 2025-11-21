// src/pages/GA4Chat.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function GA4Chat() {
  const [query, setQuery] = React.useState(
    "Traffico dalla Cina 1-14 settembre: bounce rate, session duration e pages/session"
  );
  const [loading, setLoading] = React.useState(false);
  const [steps, setSteps] = React.useState<string[]>([]);
  const [narrative, setNarrative] = React.useState("");
  const [range, setRange] = React.useState<{ startDate: string; endDate: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [chart, setChart] = React.useState<null | { type: 'bar' | 'line' | 'pie' | null; labels: string[]; values: number[]; metric: string | null }>(null);

  async function ask() {
    setLoading(true);
    setSteps([]);
    setError(null);
    setNarrative("");
    setRange(null);
    setChart(null);

    try {
      const res = await fetch("/api/ga4/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore");

      setSteps(json?.debug?.steps || []);
      setRange(json.range);
      setNarrative(json?.ai?.narrative || "");
      setChart(json?.ai?.chart ?? null);
    } catch (e: any) {
      setError(e?.message || "Errore richiesta");
    } finally {
      setLoading(false);
    }
  }

  // UI-only state for conversational cards and view controls (non impatta la logica dati)
  type Card = {
    id: number;
    queryText: string;
    narrative: string;
    range: { startDate: string; endDate: string } | null;
    timestamp: number;
    view: "text" | "table" | "chart";
    chart: null | { type: 'bar' | 'line' | 'pie' | null; labels: string[]; values: number[]; metric: string | null };
  };
  const [cards, setCards] = React.useState<Card[]>([]);
  const [fullscreenCardId, setFullscreenCardId] = React.useState<number | null>(null);

  // Al termine della risposta, accoda una nuova card (solo UI)
  const lastPushedRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!loading && narrative && narrative !== lastPushedRef.current) {
      setCards((prev) => [
        ...prev,
        { id: Date.now(), queryText: query, narrative, range, timestamp: Date.now(), view: "text", chart },
      ]);
      lastPushedRef.current = narrative;
    }
  }, [loading, narrative, range, query, chart]);

  function setCardView(id: number, view: "text" | "table" | "chart") {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, view } : c)));
  }

  // Reset UI della chat (solo presentazione, non tocca logica/API)
  function handleReset() {
    setQuery("");
    setSteps([]);
    setError(null);
    setNarrative("");
    setRange(null);
    setCards([]);
    setFullscreenCardId(null);
    lastPushedRef.current = "";
  }

  // Estrae la prima tabella Markdown
  function parseFirstMarkdownTable(md: string): { headers: string[]; rows: string[][] } | null {
    const lines = md.split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l.startsWith("|") && l.endsWith("|")) {
        const sep = (lines[i + 1] || "").trim();
        if (/^\|\s*[-:]+\s*(\|\s*[-:]+\s*)+\|$/.test(sep)) {
          start = i;
          break;
        }
      }
    }
    if (start === -1) return null;
    const headers = lines[start].split("|").slice(1, -1).map((s) => s.trim());
    const rows: string[][] = [];
    for (let j = start + 2; j < lines.length; j++) {
      const row = lines[j].trim();
      if (!row.startsWith("|") || !row.endsWith("|")) break;
      rows.push(row.split("|").slice(1, -1).map((s) => s.trim()));
    }
    if (!headers.length || !rows.length) return null;
    return { headers, rows };
  }

  // Estrae tutte le tabelle presenti nel markdown e le concatena in un unico markdown contenente solo tabelle
  function extractTablesFromMarkdown(md: string): string {
    const lines = md.split(/\r?\n/);
    const tables: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const header = (lines[i] || "").trim();
      const sep = (lines[i + 1] || "").trim();
      // Inizio tabella: header + separatore
      if (header.startsWith("|") && header.endsWith("|") && /^\|\s*[-:]+\s*(\|\s*[-:]+\s*)+\|$/.test(sep)) {
        const buf: string[] = [lines[i], lines[i + 1]];
        i += 2;
        while (i < lines.length) {
          const row = (lines[i] || "").trim();
          if (!(row.startsWith("|") && row.endsWith("|"))) break;
          buf.push(lines[i]);
          i++;
        }
        tables.push(buf.join("\n"));
        continue;
      }
      i++;
    }
    return tables.join("\n\n");
  }

  // Grafico a barre minimale (senza dipendenze esterne)
  function ChartFromMarkdown({ md }: { md: string }) {
    const table = parseFirstMarkdownTable(md);
    if (!table) return <div className="text-sm text-gray-500">Grafico non disponibile: nessuna tabella riconosciuta.</div>;
    const labels = table.rows.map((r) => r[0]);
    const values = table.rows.map((r) => Number(String(r[1]).replace(/[^0-9.,-]/g, "").replace(",", ".")));
    if (values.some((v) => isNaN(v))) return <div className="text-sm text-gray-500">Grafico non disponibile: valori non numerici.</div>;
    const max = Math.max(...values.map((v) => Math.abs(v)), 1);
    return (
      <div className="space-y-2">
        {values.map((v, i) => {
          const pct = Math.round((Math.abs(v) / max) * 100);
          return (
            <div key={i} className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-3 truncate text-xs text-gray-600">{labels[i]}</div>
              <div className="col-span-9">
                <div className="h-2.5 w-full rounded-full bg-gray-100">
                  <div className="h-2.5 rounded-full bg-indigo-500" style={{ width: pct + "%" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Utils per chart/tabella
  function isValidChart(spec: any): spec is { type:'bar'|'line'|'pie'|null; labels:string[]; values:number[]; metric:string|null } {
    return !!spec && Array.isArray(spec.labels) && Array.isArray(spec.values) && spec.labels.length === spec.values.length && spec.labels.length > 0;
  }
  const formatDateShort = (s:string)=>{
    const m = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s+'T00:00:00Z') : null;
    if (!m || isNaN(m.getTime())) return s;
    const d = m.getUTCDate().toString().padStart(2,'0');
    const mo = (m.getUTCMonth()+1).toString().padStart(2,'0');
    return `${d}/${mo}`;
  };
  // Renderer semplici per ai.chart
  function LineChart({ labels, values, metric }:{ labels:string[]; values:number[]; metric?: string | null }){
    // Format helpers
    const formatDate = (s:string)=>{
      const m = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s+'T00:00:00Z') : null;
      if (!m || isNaN(m.getTime())) return s;
      const d = m.getUTCDate().toString().padStart(2,'0');
      const mo = (m.getUTCMonth()+1).toString().padStart(2,'0');
      return `${d}/${mo}`;
    };
    const formatNum = (n:number)=> new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(n);

    // Scales
    const vmin = Math.min(...values);
    const vmax = Math.max(...values);
    const span = Math.max(1, vmax - vmin);
    // Nice ticks (4 ticks)
    const tickCount = 4;
    const step = Math.pow(10, Math.floor(Math.log10(span/tickCount)));
    const niceStep = step * Math.ceil((span/tickCount)/step);
    const y0 = Math.floor(vmin/step)*step;
    const ticks:number[] = Array.from({length:tickCount+1},(_,i)=> y0 + i*niceStep).filter(t=> t>=vmin-1 && t<=vmax+niceStep);

    // Build path with slight smoothing
    const H = 220; // drawing height
    const W = 600; // drawing width
    const L = Math.max(1, labels.length-1);
    const xAt = (i:number)=> (i/L)*W;
    const yAt = (v:number)=> H - ((v - vmin)/span)*H;

    const dPath = values.reduce((acc, v, i)=>{
      const x = xAt(i), y = yAt(v);
      if (i===0) return `M ${x} ${y}`;
      const px = xAt(i-1), py = yAt(values[i-1]);
      const cx = (px + x)/2; // simple quadratic midpoint smoothing
      return acc + ` Q ${cx} ${py}, ${x} ${y}`;
    }, '');

    // Tooltip state
    const [hover, setHover] = React.useState<number | null>(null);
    const onMove: React.MouseEventHandler<HTMLDivElement> = (e)=>{
      const rect = (e.currentTarget.querySelector('svg') as SVGSVGElement)?.getBoundingClientRect();
      if (!rect) return;
      const rx = e.clientX - rect.left; // x within svg
      const ratio = Math.max(0, Math.min(1, rx / rect.width));
      const idx = Math.round(ratio * L);
      setHover(Math.max(0, Math.min(values.length-1, idx)));
    };
    const onLeave = ()=> setHover(null);

    // Decimate X labels to at most 6
    const maxTicks = 6;
    const stepX = Math.ceil(labels.length / maxTicks);

    return (
      <div className="w-full h-[280px] px-2 py-3" onMouseMove={onMove} onMouseLeave={onLeave}>
        <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
          <span className="font-medium text-gray-800">{metric ? `${metric} per periodo` : 'Trend'}</span>
          {hover!=null && <span className="text-gray-700">{formatDate(labels[hover])}: <span className="font-semibold">{formatNum(values[hover])}</span></span>}
        </div>
        <div className="relative h-[220px]">
          {/* Y grid + labels */}
          <svg viewBox={`0 0 ${W+60} ${H}`} className="absolute inset-0 w-full h-full">
            {/* Grid lines */}
            {ticks.map((t,i)=>{
              const y = yAt(Math.min(vmax, Math.max(vmin, t)));
              return (
                <g key={i}>
                  <line x1={40} y1={y} x2={W+40} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                  <text x={0} y={y+3} className="fill-gray-500" style={{fontSize: '10px'}}>{formatNum(t)}</text>
                </g>
              );
            })}
            {/* Line path */}
            <g transform="translate(40,0)">
              <path d={dPath} fill="none" stroke="#4f46e5" strokeWidth={2} />
              {values.map((v,i)=>{
                const x = xAt(i), y = yAt(v);
                return <circle key={i} cx={x} cy={y} r={hover===i?3.5:2.2} fill="#4f46e5" opacity={hover!=null && hover!==i ? 0.5 : 1} />
              })}
              {/* Hover vertical line */}
              {hover!=null && <line x1={xAt(hover)} y1={0} x2={xAt(hover)} y2={H} stroke="#c7d2fe" strokeDasharray="4 4" />}
            </g>
          </svg>
          {/* X labels */}
          <div className="absolute left-10 right-0 bottom-0 grid" style={{gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))`}}>
            {labels.map((l,i)=> (
              <div key={i} className="text-[10px] text-gray-500 text-center truncate">
                {i % stepX === 0 ? formatDate(l) : ''}
              </div>
            ))}
          </div>
          {/* Tooltip */}
          {hover!=null && (
            <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-xs" style={{ left: `calc(${(hover/L)*100}% + 40px)`, top: `${yAt(values[hover])}px` }}>
              <div className="rounded-md border border-gray-200 bg-white px-2 py-1 shadow">
                <div className="text-gray-700 font-medium">{metric || 'Valore'}</div>
                <div className="text-gray-900">{formatNum(values[hover])}</div>
                <div className="text-[10px] text-gray-500">{formatDate(labels[hover])}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function BarChart({ labels, values }:{ labels:string[]; values:number[] }){
    const max = Math.max(...values.map(v=>Math.abs(v)), 1);
    return (
      <div className="w-full">
        <div className="flex items-end gap-2 h-56">
          {values.map((v,i)=>{
            const h = Math.round((Math.abs(v)/max)*100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-full max-w-[20px] bg-indigo-100 rounded-sm h-full">
                  <div className="w-full bg-indigo-600 rounded-sm" style={{ height: `${h}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-gray-500 truncate w-full text-center">{labels[i]}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function PieChart({ labels, values }:{ labels:string[]; values:number[] }){
    const total = values.reduce((a,b)=>a+b,0) || 1;
    const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#64748b','#8b5cf6','#14b8a6'];
    let acc = 0;
    const segments = values.map((v,i)=>{ const start=(acc/total)*360; acc+=v; const end=(acc/total)*360; const color=colors[i%colors.length]; return `${color} ${start}deg ${end}deg`; }).join(',');
    return (
      <div className="flex items-center gap-6">
        <div className="h-40 w-40 rounded-full" style={{ background: `conic-gradient(${segments})` }} />
        <div className="space-y-1 text-sm">
          {labels.map((l,i)=> <div key={i} className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{backgroundColor: colors[i%colors.length]}}></span><span className="text-gray-700">{l}</span></div>)}
        </div>
      </div>
    );
  }

  function ChartFromSpec({ spec }:{ spec: { type:'bar'|'line'|'pie'|null; labels:string[]; values:number[]; metric:string|null } | null }){
    if (!spec || !Array.isArray(spec.labels) || !Array.isArray(spec.values) || spec.labels.length !== spec.values.length || spec.labels.length === 0) {
      return <div className="text-sm text-gray-500">Nessun grafico disponibile per le metriche e dimensioni richieste.</div>;
    }
    if (spec.type === 'line') return <LineChart labels={spec.labels} values={spec.values} metric={spec.metric || undefined} />;
    if (spec.type === 'bar') return <BarChart labels={spec.labels} values={spec.values} />;
    if (spec.type === 'pie') return <PieChart labels={spec.labels} values={spec.values} />;
    return <div className="text-sm text-gray-500">Nessun grafico disponibile per le metriche e dimensioni richieste.</div>;
  }

  // Download (UI only)
  function downloadBlob(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleDownload(card: Card) {
    // Se siamo in vista tabella e la tabella deriva da ai.chart, esporta labels/values
    if (card.view === 'table' && isValidChart(card.chart)) {
      const header = ['Label', card.chart.metric || 'Valore'];
      const rows = card.chart.labels.map((l, i)=> [formatDateShort(l), String(card.chart!.values[i] ?? '')]);
      const csv = [header.join(','), ...rows.map(r=> r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
      downloadBlob(`ga4_insight_${card.id}.csv`, csv, 'text/csv');
      return;
    }
    // Fallback: cerca una tabella nel markdown e scarica CSV
    const table = parseFirstMarkdownTable(card.narrative);
    if (table) {
      const csv = [table.headers.join(','), ...table.rows.map(r=> r.map(v=> '"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
      downloadBlob(`ga4_insight_${card.id}.csv`, csv, 'text/csv');
      return;
    }
    // Altrimenti scarica la narrativa markdown
    downloadBlob(`ga4_insight_${card.id}.md`, card.narrative, 'text/markdown');
  }
  function handleSaveView(card: Card) {
    // TODO: integrare salvataggio vista su backend
    console.info("TODO save view", card);
    alert("Salvataggio vista: TODO integrazione backend");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M12 2l1.9 5.7h6L15 11.3 16.9 17 12 13.7 7.1 17 9 11.3 4.1 7.7h6L12 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Il tuo analista AI per i dati GA4</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">Fai domande in linguaggio naturale e ottieni insight immediati dai tuoi dati GA4.</p>
        </div>

        {/* Input pill (sticky) */}
        <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 py-2">
          {/* Toolbar superiore: link Reset */}
          <div className="mb-2 flex items-center justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
              title="Resetta la conversazione"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 5V2L8 6l4 4V7c2.8 0 5 2.2 5 5a5 5 0 01-8.5 3.5l-1.4 1.4A7 7 0 0019 12c0-3.9-3.1-7-7-7z"/></svg>
              Resetta
            </button>
          </div>
          <div className="rounded-full border border-gray-200 bg-white shadow-sm px-4 py-2 flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 text-gray-400">
              <path d="M21 15v4a2 2 0 0 1-2 2H7l-4 3V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Enter=Invia, Shift+Enter=a capo (solo UI) */}
            <textarea
              className="flex-1 bg-transparent placeholder:text-gray-400 focus:outline-none text-gray-900 resize-none leading-6"
              rows={1}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!loading) ask();
                }
              }}
              placeholder="Es. Traffico dall'Italia negli ultimi 7 giorni per sorgente, sessioni e conversioni"
            />
            <button
              onClick={ask}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
              {loading ? "Elaboro..." : "Invia"}
            </button>
          </div>
          {/* Stato di caricamento */}
          {loading && (
            <div className="mt-2 text-xs text-gray-600 flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin text-indigo-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <span>Analizzo la tua domanda... Traduco la richiesta in query sui dati...</span>
            </div>
          )}
        </div>

        {/* Errori */}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        {/* Skeleton durante il loading */}
        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
            <div className="h-4 w-1/3 bg-gray-200 rounded mb-4"></div>
            <div className="h-32 w-full bg-gray-100 rounded"></div>
          </div>
        )}

        
        {/* Conversazione / risultati */}
        <div className="space-y-6 mt-6">
          {cards.map((card) => (
            <div key={card.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {card.range && (
                    <p className="mt-1 text-xs text-gray-600">Periodo: {card.range.startDate} - {card.range.endDate}</p>
                  )}
                </div>
                {/* Toolbar card: testo, tabella, grafico, fullscreen, download, save */}
                <div className="flex items-center gap-2">
                  {/* text */}
                  <button title="Vista testo" onClick={() => setCardView(card.id, "text")} className={`h-8 px-2 inline-flex items-center justify-center rounded-md border ${card.view === "text" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-gray-600 border-gray-200"} hover:bg-gray-50`}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M4 6h16v2H4V6zm0 4h10v2H4v-2zm0 4h16v2H4v-2z"/></svg>
                  </button>
                  <button title="Vista tabella" onClick={() => setCardView(card.id, "table")} className={`h-8 w-8 inline-flex items-center justify-center rounded-md border ${card.view === "table" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-gray-600 border-gray-200"} hover:bg-gray-50`}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M3 5h18v14H3V5zm2 2v2h14V7H5zm0 4v6h14v-6H5z" /></svg>
                  </button>
                  <button title="Vista grafico" onClick={() => setCardView(card.id, "chart")} className={`h-8 w-8 inline-flex items-center justify-center rounded-md border ${card.view === "chart" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-gray-600 border-gray-200"} hover:bg-gray-50`}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M4 19h16v2H4v-2zM6 10h2v7H6v-7zm5-4h2v11h-2V6zm5 6h2v5h-2v-5z" /></svg>
                  </button>
                  <button title="Ingrandisci" onClick={() => setFullscreenCardId(card.id)} className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-white text-gray-600 border-gray-200 hover:bg-gray-50">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M3 3h8v2H5v6H3V3zm18 0v8h-2V5h-6V3h8zM3 21v-8h2v6h6v2H3zm18-8v8h-8v-2h6v-6h2z" /></svg>
                  </button>
                  <button title="Scarica" onClick={() => handleDownload(card)} className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-white text-gray-600 border-gray-200 hover:bg-gray-50">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 3v10l4-4 1.4 1.4L12 16.8 6.6 10.4 8 9l4 4V3h0zM5 19h14v2H5v-2z" /></svg>
                  </button>
                  <button title="Salva vista" onClick={() => handleSaveView(card)} className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-white text-gray-600 border-gray-200 hover:bg-gray-50">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M17 3H7a2 2 0 0 0-2 2v14l7-3 7 3V5a2 2 0 0 0-2-2z" /></svg>
                  </button>
                </div>
              </div>

              {/* Testo di contesto */}
              <p className="mt-2 text-sm text-gray-600">Risultati per la richiesta sopra. Visualizzazione predefinita: tabella; puoi passare al grafico o scaricare i dati.</p>

              <div className="mt-4">
                {card.view === "text" && (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.narrative}</ReactMarkdown>
                  </div>
                )}
                {card.view === "table" && (
                  (()=>{
                    // 1) se esiste ai.chart valido, tabella derivata da chart
                    if (isValidChart(card.chart)) {
                      return (
                        <div className="overflow-auto max-h-96 rounded-lg border border-gray-100">
                          <table className="min-w-full border-separate border-spacing-0">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                              <tr>
                                <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700">Label</th>
                                <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700">{card.chart.metric || 'Valore'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {card.chart.labels.map((l,i)=> (
                                <tr key={i} className="odd:bg-white even:bg-gray-50">
                                  <td className="border-b border-gray-100 px-3 py-2 text-gray-800 align-top">{formatDateShort(l)}</td>
                                  <td className="border-b border-gray-100 px-3 py-2 text-gray-800 align-top">{card.chart!.values[i]}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    // 2) altrimenti prova a usare tabelle dal markdown
                    const onlyTables = extractTablesFromMarkdown(card.narrative);
                    if (!onlyTables) return <div className="text-sm text-gray-500">Non ci sono dati tabellari disponibili per questa risposta.</div>;
                    return (
                      <div className="overflow-auto max-h-96 rounded-lg border border-gray-100">
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: (props) => (<table className="min-w-full border-separate border-spacing-0" {...props} />),
                              thead: (props) => (<thead className="bg-gray-50 sticky top-0 z-10" {...props} />),
                              th: (props) => (<th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700" {...props} />),
                              td: (props) => (<td className="border-b border-gray-100 px-3 py-2 text-gray-800 align-top" {...props} />),
                              tr: (props) => (<tr className="odd:bg-white even:bg-gray-50" {...props} />),
                              p: () => <></>, h1: () => <></>, h2: () => <></>, h3: () => <></>, ul: () => <></>, ol: () => <></>, code: () => <></>
                            }}
                          >
                            {onlyTables}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })()
                )}
                {card.view === "chart" && (
                  card.chart ? (
                    <ChartFromSpec spec={card.chart} />
                  ) : (
                    <div className="text-sm text-gray-500">Nessun grafico disponibile per questa risposta.</div>
                  )
                )}
              </div>
            </div>
          ))}
          {cards.length === 0 && !loading && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
              Invia una domanda per vedere i risultati qui sotto.
            </div>
          )}
        </div>

        {/* Fullscreen modal */}
        {fullscreenCardId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-6xl rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Vista a schermo intero</h3>
                <button onClick={() => setFullscreenCardId(null)} className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Chiudi</button>
              </div>
              {cards.filter((c) => c.id === fullscreenCardId).map((c) => (
                <div key={c.id} className="max-h-[70vh] overflow-auto">
                  {c.view === 'text' && (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.narrative}</ReactMarkdown>
                    </div>
                  )}
                  {c.view === 'table' && (
                    (()=>{
                      const onlyTables = extractTablesFromMarkdown(c.narrative);
                      if (!onlyTables) return <div className="text-sm text-gray-500">Non ci sono dati tabellari disponibili per questa risposta.</div>;
                      return (
                        <div className="overflow-auto max-h-[65vh] rounded-lg border border-gray-100">
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}
                              components={{
                                table: (props) => (<table className="min-w-full border-separate border-spacing-0" {...props} />),
                                thead: (props) => (<thead className="bg-gray-50 sticky top-0 z-10" {...props} />),
                                th: (props) => (<th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700" {...props} />),
                                td: (props) => (<td className="border-b border-gray-100 px-3 py-2 text-gray-800 align-top" {...props} />),
                                tr: (props) => (<tr className="odd:bg-white even:bg-gray-50" {...props} />),
                                p: () => <></>, h1: () => <></>, h2: () => <></>, h3: () => <></>, ul: () => <></>, ol: () => <></>, code: () => <></>
                              }}
                            >{onlyTables}</ReactMarkdown>
                          </div>
                        </div>
                      );
                    })()
                  )}
                  {c.view === 'chart' && (c.chart ? <ChartFromSpec spec={c.chart} /> : <div className="text-sm text-gray-500">Nessun grafico disponibile per questa risposta.</div>)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
