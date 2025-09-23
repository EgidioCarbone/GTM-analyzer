// Test unitari per la funzionalità fuzzy matching di params_subset
// =================================================================

import { SSDExpectationMatcher } from '../ssdExpectationMatcher';
import { Page } from 'puppeteer';

// Mock Page per i test
const mockPage = {} as Page;

describe('Fuzzy Matching per params_subset', () => {
  let matcher: SSDExpectationMatcher;

  beforeEach(() => {
    // Reset del matcher per ogni test
  });

  describe('Modalità strict (fuzzy: false)', () => {
    beforeEach(() => {
      matcher = new SSDExpectationMatcher(mockPage, { fuzzy: false });
    });

    it('dovrebbe fare confronti esatti per stringhe', () => {
      const expected = { name: 'Test' };
      const actual = { name: 'test' };
      
      // Accesso privato tramite any per testare isSubsetMatch
      const result = (matcher as any).isSubsetMatch(expected, actual);
      expect(result).toBe(false);
    });

    it('dovrebbe fare confronti esatti per numeri', () => {
      const expected = { value: 100 };
      const actual = { value: 100.5 };
      
      const result = (matcher as any).isSubsetMatch(expected, actual);
      expect(result).toBe(false);
    });

    it('dovrebbe fare confronti esatti per oggetti', () => {
      const expected = { a: 1, b: 2 };
      const actual = { b: 2, a: 1 };
      
      const result = (matcher as any).isSubsetMatch(expected, actual);
      expect(result).toBe(true); // Ordine chiavi non conta in strict mode
    });
  });

  describe('Modalità fuzzy (fuzzy: true)', () => {
    beforeEach(() => {
      matcher = new SSDExpectationMatcher(mockPage, { fuzzy: true });
    });

    describe('Confronto case-insensitive per stringhe', () => {
      it('dovrebbe matchare stringhe con case diverse', () => {
        const expected = { name: 'Test' };
        const actual = { name: 'test' };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe matchare stringhe con case miste', () => {
        const expected = { title: 'Hello World' };
        const actual = { title: 'HELLO WORLD' };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe matchare stringhe con caratteri speciali', () => {
        const expected = { message: 'Ciao Mondo!' };
        const actual = { message: 'CIAO MONDO!' };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('NON dovrebbe matchare stringhe completamente diverse', () => {
        const expected = { name: 'Test' };
        const actual = { name: 'Different' };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(false);
      });
    });

    describe('Tolleranza numerica ±1%', () => {
      it('dovrebbe matchare numeri entro ±1%', () => {
        const expected = { value: 100 };
        const actual = { value: 100.5 }; // +0.5%
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe matchare numeri entro ±1% (negativo)', () => {
        const expected = { value: 100 };
        const actual = { value: 99.5 }; // -0.5%
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe matchare numeri al limite ±1%', () => {
        const expected = { value: 100 };
        const actual = { value: 101 }; // +1%
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('NON dovrebbe matchare numeri oltre ±1%', () => {
        const expected = { value: 100 };
        const actual = { value: 102 }; // +2%
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(false);
      });

      it('dovrebbe usare epsilon per valori piccoli', () => {
        const expected = { value: 0.01 };
        const actual = { value: 0.015 }; // +50% ma < epsilon
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe gestire zero correttamente', () => {
        const expected = { value: 0 };
        const actual = { value: 0 };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe gestire valori infiniti', () => {
        const expected = { value: Infinity };
        const actual = { value: Infinity };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('NON dovrebbe matchare NaN', () => {
        const expected = { value: 100 };
        const actual = { value: NaN };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(false);
      });
    });

    describe('Confronto ignorando ordine chiavi oggetti', () => {
      it('dovrebbe matchare oggetti con chiavi in ordine diverso', () => {
        const expected = { a: 1, b: 'test', c: true };
        const actual = { c: true, a: 1, b: 'TEST' };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe matchare oggetti annidati con chiavi in ordine diverso', () => {
        const expected = { 
          user: { name: 'John', age: 30 },
          settings: { theme: 'dark', lang: 'en' }
        };
        const actual = { 
          settings: { lang: 'EN', theme: 'DARK' },
          user: { age: 30, name: 'john' }
        };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('NON dovrebbe matchare se mancano chiavi', () => {
        const expected = { a: 1, b: 'test', c: true };
        const actual = { a: 1, b: 'test' }; // manca 'c'
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(false);
      });
    });

    describe('Combinazioni complesse', () => {
      it('dovrebbe matchare oggetti complessi con fuzzy matching', () => {
        const expected = {
          event: 'purchase',
          value: 99.99,
          currency: 'USD',
          items: [
            { name: 'Product', price: 50.00 },
            { name: 'Service', price: 49.99 }
          ],
          user: { id: 123, name: 'John Doe' }
        };
        
        const actual = {
          event: 'PURCHASE',
          value: 100.50, // +0.51%
          currency: 'usd',
          items: [
            { name: 'PRODUCT', price: 50.25 }, // +0.5%
            { name: 'SERVICE', price: 49.75 }  // -0.48%
          ],
          user: { name: 'JOHN DOE', id: 123 }
        };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe gestire array con fuzzy matching', () => {
        const expected = { tags: ['important', 'urgent'] };
        const actual = { tags: ['IMPORTANT', 'URGENT'] };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe gestire valori null e undefined', () => {
        const expected = { a: null, b: undefined };
        const actual = { a: null, b: undefined };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });
    });

    describe('Test di regressione per compatibilità', () => {
      it('dovrebbe mantenere comportamento identico per match esatti', () => {
        const expected = { exact: 'match' };
        const actual = { exact: 'match' };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });

      it('dovrebbe mantenere comportamento identico per numeri esatti', () => {
        const expected = { value: 100 };
        const actual = { value: 100 };
        
        const result = (matcher as any).isSubsetMatch(expected, actual);
        expect(result).toBe(true);
      });
    });
  });

  describe('Test di integrazione con params_subset', () => {
    beforeEach(() => {
      matcher = new SSDExpectationMatcher(mockPage, { fuzzy: true });
    });

    it('dovrebbe funzionare con eventi dataLayer reali', () => {
      const expected = {
        event: 'purchase',
        ecommerce: {
          transaction_id: 'T123',
          value: 99.99,
          currency: 'USD',
          items: [
            { item_name: 'Product', item_id: 'P123', price: 50.00 }
          ]
        }
      };
      
      const actual = {
        event: 'PURCHASE',
        ecommerce: {
          currency: 'usd',
          transaction_id: 'T123',
          value: 100.25, // +0.26%
          items: [
            { item_id: 'P123', item_name: 'PRODUCT', price: 50.15 } // +0.3%
          ]
        }
      };
      
      const result = (matcher as any).isSubsetMatch(expected, actual);
      expect(result).toBe(true);
    });
  });
});
