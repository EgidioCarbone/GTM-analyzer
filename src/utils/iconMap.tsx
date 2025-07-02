// src/utils/iconMap.tsx

import { Zap, Eye, Layers, AlertTriangle, Tag } from "lucide-react";
import React from "react";

export const typeIcons: Record<string, JSX.Element> = {
  CUSTOM_EVENT: <Zap className="w-5 h-5 text-blue-500" />,
  PAGEVIEW: <Eye className="w-5 h-5 text-green-500" />,
  TRIGGER_GROUP: <Layers className="w-5 h-5 text-purple-500" />,
  JS_ERROR: <AlertTriangle className="w-5 h-5 text-red-500" />,
  WINDOW_LOADED: <Eye className="w-5 h-5 text-yellow-500" />,
  html: <Tag className="w-5 h-5 text-gray-500" />,
  ua: <Tag className="w-5 h-5 text-blue-400" />,
  googtag: <Tag className="w-5 h-5 text-green-400" />,
  gaawe: <Tag className="w-5 h-5 text-indigo-400" />,
};

export function getTypeIcon(type: string): JSX.Element {
  return typeIcons[type] ?? <Tag className="w-5 h-5 text-gray-400" />;
}