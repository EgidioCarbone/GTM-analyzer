import React, { useEffect, useRef, useState } from "react";
export type ChartType = "big_number" | "line" | "bar" | "table";

export type ChartSpec = {
  id: string;
  title: string;
  type: ChartType;
  x?: string;
  y?: string;
  y2?: string;
  data?: any[];
};

type Props = {
  spec: ChartSpec;
  onTypeChange?: (id: string, next: ChartType) => void;
  onTitleChange?: (id: string, next: string) => void;
  onMove?: (id: string) => void;
  onFullscreen?: (id: string) => void;
  onScreenshot?: (id: string) => void;
  onRemove?: (id: string) => void;
  isCaptured?: boolean;
};

const TYPES: ChartType[] = ["big_number", "line", "bar", "table"];
const fmtNum = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("it-IT") : String(n ?? "");

// GA4 may return dates as "YYYYMMDD" or "YYYY-MM-DD"
const toLabel = (v: string) => {
  const s = String(v || "");
  const y = s.length === 8 ? s.slice(0, 4) : s.slice(0, 4);
  const m = s.length === 8 ? s.slice(4, 6) : s.slice(5, 7);
  const d = s.length === 8 ? s.slice(6, 8) : s.slice(8, 10);
  const dt = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (isNaN(dt.getTime())) return v;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function ChartCard({
  spec,
  onTypeChange,
  onTitleChange,
  onMove,
  onFullscreen,
  onScreenshot,
  onRemove,
  isCaptured,
}: Props) {
  const xk = spec?.x || "date";
  const yk = spec?.y || "value";
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(spec.title);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalTitle(spec.title);
  }, [spec.title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const commitTitle = () => {
    const trimmed = localTitle.trim();
    if (!trimmed) {
      setLocalTitle(spec.title);
    } else {
      onTitleChange?.(spec.id, trimmed);
    }
    setIsEditingTitle(false);
  };

  // normalizzo i dati per asse X
  const data = (spec?.data || []).map((r: any) => ({
    ...r,
    __label:
      xk === "date" ? toLabel(String(r.date ?? r[xk] ?? "")) : String(r[xk]),
    __y: Number(r[yk] ?? r.value ?? 0),
  }));

  return (
    <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="px-3 py-2 border-b flex items-center justify-between bg-gradient-to-b from-white to-gray-50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              className="text-sm font-semibold truncate bg-transparent outline-none flex-1"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitle();
                } else if (e.key === "Escape") {
                  setLocalTitle(spec.title);
                  setIsEditingTitle(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="text-left text-sm font-semibold truncate hover:text-gray-700"
              onClick={() => setIsEditingTitle(true)}
              title={spec.title}
            >
              {spec.title}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-xs border rounded px-2 py-1 bg-white"
            value={spec.type}
            onChange={(e) => onTypeChange?.(spec.id, e.target.value as ChartType)}
            onClick={(e) => e.stopPropagation()}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <IconButton ariaLabel="Move" onClick={(e) => onMove?.(spec.id)} icon="move" />
            <IconButton ariaLabel="Fullscreen" onClick={(e) => onFullscreen?.(spec.id)} icon="fullscreen" />
            <IconButton ariaLabel="Screenshot" onClick={(e) => onScreenshot?.(spec.id)} icon="camera" />
            <IconButton ariaLabel="Remove" onClick={(e) => onRemove?.(spec.id)} icon="close" />
          </div>
        </div>
      </div>

      <div className="p-4 min-h-[180px] relative">
        {isCaptured && (
          <div className="absolute inset-2 rounded-xl bg-indigo-100/60 border border-indigo-200 flex items-center justify-center text-sm text-indigo-700 font-medium pointer-events-none animate-pulse">
            Snapshot salvato
          </div>
        )}
        {renderContent(spec.type, data, xk, yk)}
      </div>
    </div>
  );
}

// ----------------- RENDER -----------------
function renderContent(
  type: ChartType,
  data: Array<{ __label: string; __y: number } & any>,
  xk: string,
  yk: string
) {
  if (type === "big_number") {
    const v =
      typeof data?.[0]?.value === "number"
        ? data[0].value
        : Number(data?.[0]?.[yk] ?? data?.[0]?.__y ?? 0);
    return (
      <div className="text-6xl font-semibold text-center leading-[120px] select-all">
        {Number.isFinite(v) ? fmtNum(v) : "n/a"}
      </div>
    );
  }

  if (type === "table") {
    const rows = data?.slice(0, 10) || [];
    return (
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-2">{xk}</th>
              <th className="py-1">{yk}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="py-1 pr-2">{r.__label ?? String(r[xk])}</td>
                <td className="py-1 font-medium">
                  {fmtNum(Number(r[yk] ?? r.__y ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "line") {
    return renderLineChart(data);
  }

  // Simple fallback bars rendered as stacked rows
  const max = Math.max(1, ...data.map((d) => d.__y || 0));
  return (
    <div className="space-y-2">
      {data.slice(0, 20).map((row, idx) => {
        const pct = Math.max(4, Math.round((100 * row.__y) / max));
        return (
          <div key={idx} className="flex items-center gap-2">
            <div className="text-xs text-gray-500 w-20 truncate" title={row.__label}>
              {row.__label}
            </div>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="bg-slate-700 h-3" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs font-semibold w-12 text-right">{fmtNum(row.__y)}</div>
          </div>
        );
      })}
      {!data.length && <div className="text-sm text-gray-500">Nessun dato</div>}
    </div>
  );
}

function renderLineChart(data: Array<{ __label: string; __y: number }>) {
  if (!data.length) return <div className="text-sm text-gray-500">Nessun dato</div>;

  const maxY = Math.max(...data.map((d) => d.__y || 0), 1);
  const minY = Math.min(...data.map((d) => d.__y || 0), 0);
  const padding = 24;
  const width = 720;
  const height = 260;
  const points = data.map((d, idx) => {
    const x = padding + (idx / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y =
      height - padding - ((d.__y - minY) / Math.max(maxY - minY, 1)) * (height - padding * 2);
    return { x, y, label: d.__label, value: d.__y };
  });

  // area fill for clarity
  const areaPath =
    points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") +
    ` L${points[points.length - 1].x},${height - padding} L${points[0].x},${height - padding} Z`;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 text-indigo-500">
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#lineFill)" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4.5} fill="currentColor" />
          </g>
        ))}
        {/* y-axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padding + (1 - t) * (height - padding * 2);
          const val = Math.round(minY + t * (maxY - minY));
          return (
            <g key={t}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={padding - 6} y={y + 4} textAnchor="end" className="fill-gray-500 text-[10px]">
                {fmtNum(val)}
              </text>
            </g>
          );
        })}
        {/* x-axis labels (sampled) */}
        {points.map((p, i) =>
          i % Math.max(1, Math.floor(points.length / 6)) === 0 ? (
            <text
              key={`x-${i}`}
              x={p.x}
              y={height - 4}
              textAnchor="middle"
              className="fill-gray-500 text-[10px]"
            >
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-600">
        {data.slice(0, 8).map((d, i) => (
          <div key={i} className="flex justify-between">
            <span className="truncate">{d.__label}</span>
            <span className="font-semibold text-gray-800">{fmtNum(d.__y)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function IconButton({
  ariaLabel,
  icon,
  onClick,
}: {
  ariaLabel: string;
  icon: "move" | "fullscreen" | "camera" | "close";
  onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}) {
  const icons = {
    move: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2v20m10-10H2M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" />
      </svg>
    ),
    fullscreen: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 3H3v5M21 8V3h-5M3 16v5h5M16 21h5v-5" />
      </svg>
    ),
    camera: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h4l2-2h4l2 2h4v11H4z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
    close: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    ),
  };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
      style={{ minWidth: 32, minHeight: 32 }}
    >
      {icons[icon]}
    </button>
  );
}
