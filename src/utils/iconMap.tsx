import {
  Tag,
  Braces,
  Hash,
  Cookie,
  Settings,
  Code,
  Layers,
  Zap,
  ActivitySquare,
} from "lucide-react";

/**
 * Mappa tipo → icona JSX
 */
export const typeIcons: Record<string, JSX.Element> = {
  /* Tag */
  ua: <Tag className="w-4 h-4" />,
  googtag: <ActivitySquare className="w-4 h-4" />,
  html: <Braces className="w-4 h-4" />,
  ga4: <ActivitySquare className="w-4 h-4" />,

  /* Variabili */
  c: <Hash className="w-4 h-4" />,
  k: <Cookie className="w-4 h-4" />,
  gas: <Settings className="w-4 h-4" />,
  jsm: <Code className="w-4 h-4" />,
  v: <Layers className="w-4 h-4" />,

  /* Fallback */
  default: <Tag className="w-4 h-4" />,
};