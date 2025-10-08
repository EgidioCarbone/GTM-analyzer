// URL normalization utilities for SSD Test
// ============================================================================

/**
 * Normalizes a URL input to a valid origin (protocol + host + port)
 * - Adds https:// if no protocol is provided
 * - Truncates to origin (removes path, query, fragment)
 * - Removes trailing slash
 * 
 * @param input - URL string from user input
 * @returns Normalized origin string (e.g., "https://example.com")
 * @throws Error if input is invalid or cannot be normalized
 */
export function normalizeOrigin(input: string): string {
  if (!input || typeof input !== "string") {
    throw new Error("Missing URL");
  }
  
  let s = input.trim();
  
  // Add https:// if no protocol is provided
  if (!/^https?:\/\//i.test(s)) {
    s = "https://" + s;
  }
  
  try {
    const u = new URL(s);
    return u.origin; // Forces to origin (protocol + host + port)
  } catch (error) {
    throw new Error(`Invalid URL format: ${input}. Please include http/https (e.g., https://example.com)`);
  }
}

/**
 * Validates if a string is a valid URL
 * @param input - URL string to validate
 * @returns true if valid URL, false otherwise
 */
export function isValidUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts domain from URL for allowed_hosts
 * @param input - URL string
 * @returns Domain string (e.g., "example.com")
 */
export function extractDomain(input: string): string {
  const origin = normalizeOrigin(input);
  const url = new URL(origin);
  return url.hostname;
}
