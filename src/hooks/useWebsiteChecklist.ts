// src/hooks/useWebsiteChecklist.ts
import { useState } from "react";
import { runWebsiteChecklist, WebsiteChecklistResult } from "../services/websiteChecklist";

export function useWebsiteChecklist() {
  const [data, setData] = useState<WebsiteChecklistResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      setData(await runWebsiteChecklist(url));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, run };
}