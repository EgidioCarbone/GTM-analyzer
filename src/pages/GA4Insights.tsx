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

  async function ask() {
    setLoading(true);
    setSteps([]);
    setError(null);
    setNarrative("");
    setRange(null);

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
    view: "table" | "chart";
  };
  const [cards, setCards] = React.useState<Card[]>([]);
  const [fullscreenCardId, setFullscreenCardId] = React.useState<number | null>(null);

  // Al termine della risposta, accoda una nuova card (solo UI)
  const lastPushedRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!loading && narrative && narrative !== lastPushedRef.current) {
      setCards((prev) => [
        ...prev,
        { id: Date.now(), queryText: query, narrative, range, timestamp: Date.now(), view: "table" },
      ]);
      lastPushedRef.current = narrative;
    }
  }, [loading, narrative, range, query]);

  function setCardView(id: number, view: "table" | "chart") {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, view } : c)));
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
    const table = parseFirstMarkdownTable(card.narrative);
    if (table) {
      const csv = [
        table.headers.join(","),
        ...table.rows.map((r) => r.map((v) => `"${(v || "").replace(/\"/g, '""')}"`).join(",")),
      ].join("\n");
      downloadBlob(`ga4_insight_${card.id}.csv`, csv, "text/csv");
    } else {
      downloadBlob(`ga4_insight_${card.id}.md`, card.narrative, "text/markdown");
    }
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
            <span className="hidden sm:ml-2 sm:block text-[11px] text-gray-500">Enter invia - Shift+Enter va a capo</span>
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
                  <h4 className="text-lg font-semibold text-gray-900">{card.queryText}</h4>
                  {card.range && (
                    <p className="mt-1 text-xs text-gray-600">Periodo: {card.range.startDate} - {card.range.endDate}</p>
                  )}
                </div>
                {/* Toolbar card: tabella, grafico, fullscreen, download, save */}
                <div className="flex items-center gap-2">
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
                {card.view === "table" ? (
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
                        }}
                      >
                        {card.narrative}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <ChartFromMarkdown md={card.narrative} />
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
                  {c.view === "table" ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.narrative}</ReactMarkdown>
                    </div>
                  ) : (
                    <ChartFromMarkdown md={c.narrative} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
