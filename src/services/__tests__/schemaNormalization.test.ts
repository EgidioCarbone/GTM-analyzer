import { TestSpecSchema } from '../ssdValidation';

describe('Schema normalization', () => {
  describe('TestSpecSchema site field normalization', () => {
    it('should normalize fibra.aruba.it to https://fibra.aruba.it', () => {
      const dsl = {
        site: 'fibra.aruba.it',
        tests: [{ section: 'test', steps: [{ action: 'click' }] }]
      };
      
      const result = TestSpecSchema.parse(dsl);
      expect(result.site).toBe('https://fibra.aruba.it');
    });

    it('should preserve https://fibra.aruba.it as is', () => {
      const dsl = {
        site: 'https://fibra.aruba.it',
        tests: [{ section: 'test', steps: [{ action: 'click' }] }]
      };
      
      const result = TestSpecSchema.parse(dsl);
      expect(result.site).toBe('https://fibra.aruba.it');
    });

    it('should normalize http://example.com:8080 as is', () => {
      const dsl = {
        site: 'http://example.com:8080',
        tests: [{ section: 'test', steps: [{ action: 'click' }] }]
      };
      
      const result = TestSpecSchema.parse(dsl);
      expect(result.site).toBe('http://example.com:8080');
    });

    it('should remove path and query from URL', () => {
      const dsl = {
        site: 'https://fibra.aruba.it/qualcosa?param=value',
        tests: [{ section: 'test', steps: [{ action: 'click' }] }]
      };
      
      const result = TestSpecSchema.parse(dsl);
      expect(result.site).toBe('https://fibra.aruba.it');
    });

    it('should throw error for invalid URL', () => {
      const dsl = {
        site: 'not-a-url',
        tests: [{ section: 'test', steps: [{ action: 'click' }] }]
      };
      
      expect(() => TestSpecSchema.parse(dsl)).toThrow();
    });

    it('should handle null/undefined site gracefully', () => {
      const dsl = {
        site: null,
        tests: [{ section: 'test', steps: [{ action: 'click' }] }]
      };
      
      expect(() => TestSpecSchema.parse(dsl)).toThrow();
    });
  });
});
