import { useState, useEffect } from 'react';

export interface SSDConfig {
  maxFileSize: number;
  maxFileSizeMB: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  supportedFormats: string[];
  ambiguityMinConfidence: number;
}

export interface SSDConfigResponse {
  success: boolean;
  config: SSDConfig;
}

export function useSSDConfig(apiBaseUrl: string) {
  const [config, setConfig] = useState<SSDConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${apiBaseUrl}/api/ssd/config`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.status}`);
        }
        
        const data: SSDConfigResponse = await response.json();
        
        if (data.success && data.config) {
          setConfig(data.config);
        } else {
          throw new Error('Invalid config response');
        }
      } catch (err) {
        console.error('Error fetching SSD config:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [apiBaseUrl]);

  return { config, loading, error };
}
