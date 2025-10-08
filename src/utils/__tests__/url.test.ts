import { normalizeOrigin, isValidUrl, extractDomain } from '../url';

describe('URL normalization utilities', () => {
  describe('normalizeOrigin', () => {
    it('should add https:// to domain without protocol', () => {
      expect(normalizeOrigin('fibra.aruba.it')).toBe('https://fibra.aruba.it');
      expect(normalizeOrigin('example.com')).toBe('https://example.com');
    });

    it('should preserve https:// protocol', () => {
      expect(normalizeOrigin('https://fibra.aruba.it')).toBe('https://fibra.aruba.it');
      expect(normalizeOrigin('https://example.com')).toBe('https://example.com');
    });

    it('should preserve http:// protocol', () => {
      expect(normalizeOrigin('http://example.com')).toBe('http://example.com');
    });

    it('should remove path and query parameters', () => {
      expect(normalizeOrigin('https://fibra.aruba.it/qualcosa')).toBe('https://fibra.aruba.it');
      expect(normalizeOrigin('https://example.com/path?query=value')).toBe('https://example.com');
    });

    it('should preserve port numbers', () => {
      expect(normalizeOrigin('http://example.com:8080')).toBe('http://example.com:8080');
      expect(normalizeOrigin('https://example.com:3000')).toBe('https://example.com:3000');
    });

    it('should handle subdomains', () => {
      expect(normalizeOrigin('www.example.com')).toBe('https://www.example.com');
      expect(normalizeOrigin('api.example.com')).toBe('https://api.example.com');
    });

    it('should throw error for invalid input', () => {
      expect(() => normalizeOrigin('')).toThrow('Missing URL');
      expect(() => normalizeOrigin('not-a-url')).toThrow('Invalid URL format');
      expect(() => normalizeOrigin('http://')).toThrow('Invalid URL format');
    });

    it('should throw error for null/undefined input', () => {
      expect(() => normalizeOrigin(null as any)).toThrow('Missing URL');
      expect(() => normalizeOrigin(undefined as any)).toThrow('Missing URL');
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com:8080')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(extractDomain('https://fibra.aruba.it')).toBe('fibra.aruba.it');
      expect(extractDomain('https://example.com')).toBe('example.com');
      expect(extractDomain('https://www.example.com')).toBe('www.example.com');
    });

    it('should handle URLs with ports', () => {
      expect(extractDomain('https://example.com:8080')).toBe('example.com');
    });
  });
});
