export const getApiBaseUrl = (): string => {
  const envBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  if (envBase && envBase.trim()) {
    return envBase.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');

    if (/localhost:517\d$/i.test(origin)) {
      return 'http://localhost:3001';
    }

    return origin;
  }

  return '';
};

export const resolveScreenshotUrl = (raw: string, apiBaseUrl?: string): string => {
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;

  let cleaned = raw.startsWith('./') ? raw.substring(2) : raw;
  if (!cleaned.startsWith('artifacts/')) {
    cleaned = `artifacts/${cleaned}`;
  }

  const base = apiBaseUrl?.replace(/\/$/, '');
  if (base) {
    return `${base}/api/screenshot/${cleaned}`;
  }
  return `/api/screenshot/${cleaned}`;
};
