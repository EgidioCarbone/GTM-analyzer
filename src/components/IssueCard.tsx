import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type ImpactLevel = "critical" | "high" | "warning" | "ok";

export interface ImpactTheme {
  border: string;
  text: string;
  badge: string;
  dot: string;
  type: ImpactLevel;
  severity?: string;
}

const THEMES: Record<ImpactLevel, ImpactTheme> = {
  critical: {
    border: "border-rose-200",
    text: "text-rose-700",
    badge: "ls-pill ls-pill-critical",
    dot: "bg-rose-500",
    type: "critical",
    severity: "Critica",
  },
  high: {
    border: "border-purple-200",
    text: "text-purple-700",
    badge: "ls-pill ls-pill-warn",
    dot: "bg-purple-500",
    type: "high",
    severity: "Maggiore",
  },
  warning: {
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "ls-pill ls-pill-warn",
    dot: "bg-amber-500",
    type: "warning",
    severity: "Minore",
  },
  ok: {
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "ls-pill ls-pill-ok",
    dot: "bg-emerald-500",
    type: "ok",
    severity: "OK",
  },
};

function getImpactTheme(count: number): ImpactTheme {
  if (count <= 0) return THEMES.ok;
  if (count >= 20) return THEMES.critical;
  if (count >= 8) return THEMES.high;
  return THEMES.warning;
}

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

interface IssueCardProps {
  title: string;
  count: number;
  icon?: React.ReactNode;
  bullets?: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  severityLabel?: string;
  subtitle?: string;
  breakdown?: React.ReactNode;
  details?: React.ReactNode;
  defaultExpanded?: boolean;
  status?: Status;
  palette?: "default" | "lilac";
  className?: string;
}

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
  status,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const theme: ImpactTheme = status ? themeFromStatus(status) : getImpactTheme(count);

  const isZeroOk = count === 0 && (!status || status === "ok");

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

  const ariaLabel = `${title} - severità ${derivedSeverity} - ${count} elementi`;

  if (isZeroOk) {
    return (
      <div
        className={`ls-card flex-1 flex flex-col min-h-[260px] ${theme.border} ${className ?? ''}`}
        aria-label={ariaLabel}
        role="article"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-xl`}>{icon}</span>
            <div>
              <div className={`text-lg font-bold ${theme.text}`}>{title}</div>
              <div className="text-xs text-slate-500">Controllo superato</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={theme.badge}>OK</span>
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`ls-card flex flex-col h-full min-h-[260px] ${theme.border} ${className ?? ''}`}
      aria-label={ariaLabel}
      role="article"
    >
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
          <div className={`w-4 h-4 rounded-full ${theme.dot}`} />
          <span className="text-2xl">{icon}</span>
          <div>
            <div className={`text-3xl font-black ${theme.text}`}>{count}</div>
            <div className={`text-lg font-bold ${theme.text}`}>{title}</div>
            {subtitle && (
              <div className="text-xs text-slate-500">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${theme.dot}`} />
            <span className={`text-xs font-medium ${theme.text}`}>{derivedSeverity}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="pt-2 space-y-3">
          {breakdown && (
            <div className="text-xs p-3 bg-slate-50/70 border border-slate-100 rounded-xl">
              <div className="font-medium mb-1">Breakdown:</div>
              <div className="flex flex-wrap gap-2 text-xs">{breakdown}</div>
            </div>
          )}

          {details && (
            <div className="text-xs p-3 bg-slate-50/70 border border-slate-100 rounded-xl">
              <div className="font-medium mb-1">Dettagli:</div>
              {details}
            </div>
          )}

          {bullets && <div className="text-sm text-slate-700">{bullets}</div>}
        </div>
      </div>

      {count > 0 && ctaLabel && onCta && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <button
            className="ls-btn ls-btn-sm w-full justify-center"
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

