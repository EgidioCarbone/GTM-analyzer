import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";

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
  spec: Required<ChartSpec>;
  onTypeChange?: (id: string, next: ChartType) => void;
};

const TYPES: ChartType[] = ["big_number", "line", "bar", "table"];
const fmtNum = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("it-IT") : String(n ?? "");

// GA4 può dare date come "YYYYMMDD" o "YYYY-MM-DD"
const toLabel = (v: string) => {
  const s = String(v || "");
  const y = s.length === 8 ? s.slice(0, 4) : s.slice(0, 4);
  const m = s.length === 8 ? s.slice(4, 6) : s.slice(5, 7);
  const d = s.length === 8 ? s.slice(6, 8) : s.slice(8, 10);
  const dt = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (isNaN(dt.getTime())) return v;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function ChartCard({ spec, onTypeChange }: Props) {
  const xk = spec.x || "date";
  const yk = spec.y || "value";

  // normalizzo i dati per asse X
  const data = (spec.data || []).map((r: any) => ({
    ...r,
    __label:
      xk === "date" ? toLabel(String(r.date ?? r[xk] ?? "")) : String(r[xk]),
    __y: Number(r[yk] ?? r.value ?? 0),
  }));

  return (
    <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="px-3 py-2 border-b flex items-center justify-between bg-gradient-to-b from-white to-gray-50">
        <div className="text-sm font-semibold truncate" title={spec.title}>
          {spec.title}
        </div>
        <select
          className="text-xs border rounded px-2 py-1 bg-white"
          value={spec.type}
          onChange={(e) => onTypeChange?.(spec.id, e.target.value as ChartType)}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="p-4 min-h-[180px]">
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
                <td className="py-1 font-medium">{fmtNum(Number(r[yk] ?? r.__y ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ----------- Line & Bar con assi, grid, tooltip e legend -----------
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="__label" tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtNum as any} />
      <Tooltip
        formatter={(value: any) => fmtNum(Number(value))}
        labelFormatter={(l) => l}
      />
      <Legend />
    </>
  );

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          {common}
          <Line
            type="monotone"
            dataKey="__y"
            name={yk}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            strokeWidth={2}
          >
            {/* opzionale: etichette numeriche sui punti se poche */}
            {data.length <= 12 && (
              <LabelList dataKey="__y" position="top" formatter={(v: any) => fmtNum(Number(v))} fontSize={10} />
            )}
          </Line>
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        {common}
        <Bar dataKey="__y" name={yk} radius={[4, 4, 0, 0]}>
          <LabelList dataKey="__y" position="top" formatter={(v: any) => fmtNum(Number(v))} fontSize={10} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
