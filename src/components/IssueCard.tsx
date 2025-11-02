import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Theme types & helpers (self-contained)                             */
/* ------------------------------------------------------------------ */

type ImpactLevel = "critical" | "high" | "warning" | "ok";

export interface ImpactTheme {
  bg: string;
  border: string;
  text: string;
  badge: string;
  icon?: string;
  type: ImpactLevel;
  severity?: string;
}

const THEMES: Record<ImpactLevel, ImpactTheme> = {
  critical: {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-300",
    badge: "bg-red-100 text-red-800",
    type: "critical",
    severity: "Critica",
  },
  high: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-800",
    type: "high",
    severity: "Maggiore",
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-700 dark:text-yellow-300",
    badge: "bg-yellow-100 text-yellow-800",
    type: "warning",
    severity: "Minore",
  },
  ok: {
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-700 dark:text-green-300",
    badge: "bg-green-100 text-green-800",
    type: "ok",
    severity: "OK",
  },
};

/** Heuristics: con count=0 → ok; soglie tarabili a piacere */
function getImpactTheme(count: number): ImpactTheme {
  if (count <= 0) return THEMES.ok;
  if (count >= 20) return THEMES.critical;
  if (count >= 8) return THEMES.high;
  return THEMES.warning;
}

/** Mappa status esplicito su un tema coerente (per override da UI) */
type Status = "ok" | "minor" | "major" | "critical";
function themeFromStatus(status: Status): ImpactTheme {
  switch (status) {
    case "critical":
      return THEMES.critical;
    case "major":
      return THEMES.high;
    case "minor":
      return THEMES.warning;
    default:
      return THEMES.ok;
  }
}

/* ------------------------------------------------------------------ */
/*  Component props                                                    */
/* ------------------------------------------------------------------ */

interface IssueCardProps {
  title: string;
  count: number;
  icon?: React.ReactNode;
  bullets?: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  /** Label legacy (se vuoi forzare una scritta specifica) */
  severityLabel?: string;
  subtitle?: string;
  breakdown?: React.ReactNode;
  details?: React.ReactNode;
  defaultExpanded?: boolean;
  /** Opzionale: forza lo stato visuale (usalo per Doppio Page View) */
  status?: Status;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const IssueCard: React.FC<IssueCardProps> = ({
  title,
  count,
  icon,
  bullets,
  ctaLabel,
  onCta,
  severityLabel,
  subtitle,
  breakdown,
  details,
  defaultExpanded = false,
  status, // opzionale – override dei colori/pill
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Se passo uno status, uso quello; altrimenti il tema legacy basato sul count
  const theme: ImpactTheme = status ? themeFromStatus(status) : getImpactTheme(count);

  // Se count=0 E non è stato forzato uno status “non ok”, mostro pill "OK" e layout compatto
  const isZeroOk = count === 0 && (!status || status === "ok");

  // Label pill: priorità a severityLabel prop; poi al tema/status; poi fallback
  const derivedSeverity =
    isZeroOk
      ? "OK"
      : severityLabel ??
        theme.severity ??
        (theme.type === "critical"
          ? "Critica"
          : theme.type === "high"
          ? "Maggiore"
          : theme.type === "warning"
          ? "Minore"
          : "OK");

  const dotClass =
    theme.type === "critical"
      ? "bg-red-500"
      : theme.type === "high"
      ? "bg-orange-500"
      : theme.type === "warning"
      ? "bg-yellow-500"
      : "bg-green-500";

  const ariaLabel = `${title} – severità ${derivedSeverity} – ${count} elementi`;

  /* ---------- Layout compatto (controllo superato) ---------- */
  if (isZeroOk) {
    return (
      <div
        className={`${theme.bg} rounded-lg p-3 border-l-4 ${theme.border} border-l-current`}
        aria-label={ariaLabel}
        role="article"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-xl ${theme.icon}`}>{icon}</span>
            <div>
              <div className={`text-lg font-bold ${theme.text}`}>{title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ✓ Controllo superato
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${theme.badge}`}>
              OK
            </span>
            <div className="w-3 h-3 bg-green-500 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Layout esteso (problemi presenti o status forzato) ---------- */
  return (
    <div
      className={`${theme.bg} rounded-lg p-5 border-l-4 ${theme.border} border-l-current flex flex-col h-full`}
      aria-label={ariaLabel}
      role="article"
    >
      {/* Header cliccabile per expand/collapse */}
      <div
        className="flex items-center justify-between mb-3 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Chiudi" : "Espandi"} dettagli per ${title}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          {/* Pallino semaforo */}
          <div className={`w-4 h-4 rounded-full ${dotClass}`} />
          <span className={`text-2xl ${theme.icon}`}>{icon}</span>
          <div>
            <div className={`text-3xl font-black ${theme.text}`}>{count}</div>
            <div className={`text-lg font-bold ${theme.text}`}>{title}</div>
            {subtitle && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${dotClass}`} />
            <span className={`text-xs font-medium ${theme.text}`}>{derivedSeverity}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {/* Contenuto espandibile */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="pt-2">
          {breakdown && (
            <div className="text-xs mb-2 p-2 bg-white/30 rounded">
              <div className="font-medium mb-1">Breakdown:</div>
              <div className="flex gap-2 text-xs">{breakdown}</div>
            </div>
          )}

          {details && (
            <div className="text-xs mb-2 p-2 bg-white/30 rounded">
              <div className="font-medium mb-1">Dettagli:</div>
              {details}
            </div>
          )}

          {bullets && <div className="text-sm mb-4">{bullets}</div>}
        </div>
      </div>

      {/* CTA: visibile solo se count > 0 e c'è un'azione */}
      {count > 0 && ctaLabel && onCta && (
        <div className="mt-5 pt-4 border-t border-white/20">
          <button
            className={`w-full text-sm px-4 py-2.5 rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
              theme.type === "critical"
                ? "bg-red-500 hover:bg-red-600 text-white border-2 border-red-600 shadow-lg hover:shadow-xl"
                : theme.type === "high"
                ? "bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-600 shadow-md hover:shadow-lg"
                : theme.type === "warning"
                ? "bg-yellow-500 hover:bg-yellow-600 text-white border-2 border-yellow-600 shadow-md hover:shadow-lg"
                : "bg-blue-500 hover:bg-blue-600 text-white border-2 border-blue-600 shadow-md hover:shadow-lg"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onCta();
            }}
            aria-label={`Azione per ${title}: ${ctaLabel}`}
          >
            <span className="flex items-center justify-center gap-2">{ctaLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};
