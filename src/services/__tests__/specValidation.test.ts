import { validateTestSpec, SpecValidationError } from '../specValidation';

describe('specValidation', () => {
  describe('validateTestSpec', () => {
    it('should validate a correct TestSpec', () => {
      const validDSL = {
        site: 'https://example.com',
        allowed_hosts: ['example.com', 'www.example.com'],
        consent: ['accept'],
        tests: [
          {
            section: 'Header Navigation',
            steps: [
              {
                description: 'Click on header link',
                action: 'click',
                target: {
                  region: 'header',
                  kind: 'text',
                  value: 'Home'
                },
                expect: [
                  {
                    type: 'dataLayer',
                    event: 'page_view',
                    params_subset: {
                      page_title: '*',
                      page_location: '*'
                    }
                  }
                ],
                severity: 'critical',
                confidence: 0.9
              }
            ]
          }
        ]
      };

      const result = validateTestSpec(validDSL);
      expect(result).toEqual(validDSL);
    });

    it('should reject DSL with missing required fields', () => {
      const invalidDSL = {
        site: 'https://example.com',
        // missing tests
      };

      expect(() => validateTestSpec(invalidDSL)).toThrow(SpecValidationError);
    });

    it('should reject DSL with invalid site URL', () => {
      const invalidDSL = {
        site: 'not-a-url',
        tests: []
      };

      expect(() => validateTestSpec(invalidDSL)).toThrow(SpecValidationError);
    });

    it('should reject DSL with placeholders', () => {
      const dslWithPlaceholders = {
        site: 'https://example.com',
        tests: [
          {
            section: 'Product Selection',
            steps: [
              {
                action: 'click',
                target: {
                  kind: 'text',
                  value: '[PRODUCT NAME]' // placeholder
                }
              }
            ]
          }
        ]
      };

      expect(() => validateTestSpec(dslWithPlaceholders)).toThrow(SpecValidationError);
    });

    it('should reject DSL with invalid regions', () => {
      const dslWithInvalidRegion = {
        site: 'https://example.com',
        tests: [
          {
            section: 'Test',
            steps: [
              {
                action: 'click',
                target: {
                  region: 'invalid_region', // invalid region
                  kind: 'text',
                  value: 'Button'
                }
              }
            ]
          }
        ]
      };

      expect(() => validateTestSpec(dslWithInvalidRegion)).toThrow(SpecValidationError);
    });

    it('should reject DSL with invalid actions', () => {
      const dslWithInvalidAction = {
        site: 'https://example.com',
        tests: [
          {
            section: 'Test',
            steps: [
              {
                action: 'invalid_action', // invalid action
                target: {
                  kind: 'text',
                  value: 'Button'
                }
              }
            ]
          }
        ]
      };

      expect(() => validateTestSpec(dslWithInvalidAction)).toThrow(SpecValidationError);
    });

    it('should reject DSL with invalid allowed_hosts', () => {
      const dslWithInvalidHosts = {
        site: 'https://example.com',
        allowed_hosts: ['unrelated-domain.com'], // not related to site
        tests: []
      };

      expect(() => validateTestSpec(dslWithInvalidHosts)).toThrow(SpecValidationError);
    });

    it('should accept DSL with wildcard params_subset', () => {
      const dslWithWildcards = {
        site: 'https://example.com',
        tests: [
          {
            section: 'Ecommerce',
            steps: [
              {
                action: 'click',
                target: {
                  kind: 'text',
                  value: 'Add to Cart'
                },
                expect: [
                  {
                    type: 'dataLayer',
                    event: 'add_to_cart',
                    params_subset: {
                      item_id: '*',
                      item_name: '*',
                      price: '*'
                    }
                  }
                ]
              }
            ]
          }
        ]
      };

      const result = validateTestSpec(dslWithWildcards);
      expect(result).toEqual(dslWithWildcards);
    });

    it('should reject DSL with placeholder patterns in params_subset', () => {
      const dslWithPlaceholderParams = {
        site: 'https://example.com',
        tests: [
          {
            section: 'Ecommerce',
            steps: [
              {
                action: 'click',
                target: {
                  kind: 'text',
                  value: 'Add to Cart'
                },
                expect: [
                  {
                    type: 'dataLayer',
                    event: 'add_to_cart',
                    params_subset: {
                      item_name: '[PRODUCT NAME]', // placeholder
                      price: '{{price}}' // placeholder
                    }
                  }
                ]
              }
            ]
          }
        ]
      };

      expect(() => validateTestSpec(dslWithPlaceholderParams)).toThrow(SpecValidationError);
    });

    it('should accept DSL with valid allowed_hosts related to site', () => {
      const dslWithValidHosts = {
        site: 'https://example.com',
        allowed_hosts: ['example.com', 'www.example.com', 'shop.example.com'],
        tests: []
      };

      const result = validateTestSpec(dslWithValidHosts);
      expect(result).toEqual(dslWithValidHosts);
    });

    it('should accept DSL with empty tests array but reject it', () => {
      const dslWithEmptyTests = {
        site: 'https://example.com',
        tests: []
      };

      expect(() => validateTestSpec(dslWithEmptyTests)).toThrow(SpecValidationError);
    });

    it('should accept DSL with valid consent values', () => {
      const dslWithConsent = {
        site: 'https://example.com',
        consent: ['accept', 'reject'],
        tests: [
          {
            section: 'Test',
            steps: [
              {
                action: 'click',
                target: {
                  kind: 'text',
                  value: 'Button'
                }
              }
            ]
          }
        ]
      };

      const result = validateTestSpec(dslWithConsent);
      expect(result).toEqual(dslWithConsent);
    });

    it('should reject DSL with invalid consent values', () => {
      const dslWithInvalidConsent = {
        site: 'https://example.com',
        consent: ['maybe'], // invalid consent value
        tests: [
          {
            section: 'Test',
            steps: [
              {
                action: 'click',
                target: {
                  kind: 'text',
                  value: 'Button'
                }
              }
            ]
          }
        ]
      };

      expect(() => validateTestSpec(dslWithInvalidConsent)).toThrow(SpecValidationError);
    });
  });
});
