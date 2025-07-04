import {
  Braces,
  Code,
  Tag,
  Zap,
  Boxes,
  ActivitySquare,
} from "lucide-react";

/**
 * Mappa tipo → icona JSX
 * Per i tipi speciali delle variabili (c, k, gas, jsm, v)
 * uso una semplice lettera monospace racchiusa in uno span.
 */
export const typeIcons: Record<string, JSX.Element> = {
  // TAG
  ua: <Tag className="w-4 h-4" />,
  googtag: <Tag className="w-4 h-4" />,
  html: <Braces className="w-4 h-4" />,
  ga4: <ActivitySquare className="w-4 h-4" />,

  // VARIABILI
  c: <span className="font-mono text-xs">C</span>, // Constant
  k: <span className="font-mono text-xs">K</span>, // Cookie
  gas: <Zap className="w-4 h-4" />,               // GA Settings
  jsm: <Code className="w-4 h-4" />,              // JS Macro
  v: <Boxes className="w-4 h-4" />,               // DL Variable

  // fallback
  default: <Tag className="w-4 h-4" />,
};