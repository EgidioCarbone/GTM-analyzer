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
        
        const data: any = await response.json();

        let resolvedConfig: SSDConfig | null = null;

        if (data?.success && data.config) {
          resolvedConfig = data.config;
        } else if (data?.config) {
          resolvedConfig = data.config;
        } else if (data && typeof data === 'object') {
          const fallbackMaxFileSize = typeof data.maxFileSize === 'number' ? data.maxFileSize : 10 * 1024 * 1024;
          resolvedConfig = {
            maxFileSize: fallbackMaxFileSize,
            maxFileSizeMB: typeof data.maxFileSizeMB === 'number'
              ? data.maxFileSizeMB
              : Math.round(fallbackMaxFileSize / 1024 / 1024),
            allowedMimeTypes: Array.isArray(data.allowedMimeTypes)
              ? data.allowedMimeTypes
              : Array.isArray(data.allowedFileTypes)
                ? data.allowedFileTypes
                : ['application/pdf', 'application/octet-stream'],
            allowedExtensions: Array.isArray(data.allowedExtensions) && data.allowedExtensions.length > 0
              ? data.allowedExtensions
              : ['.pdf'],
            supportedFormats: Array.isArray(data.supportedFormats) && data.supportedFormats.length > 0
              ? data.supportedFormats
              : ['PDF'],
            ambiguityMinConfidence: typeof data.ambiguityMinConfidence === 'number'
              ? data.ambiguityMinConfidence
              : 0.6,
          };
        }

        if (resolvedConfig) {
          setConfig(resolvedConfig);
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
