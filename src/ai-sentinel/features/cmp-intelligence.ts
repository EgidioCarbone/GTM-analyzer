// @ts-nocheck
// src/ai-sentinel/features/cmp-intelligence.ts

import { Page } from 'playwright';

export interface CMPAnalysis {
  name: string;
  version?: string;
  confidence: number;
  features: {
    hasCustomizable?: boolean;
    hasTCF?: boolean;
    hasCategories?: boolean;
    hasPreference?: boolean;
  };
  detectedSelectors: string[];
  complianceLevel: 'basic' | 'enhanced' | 'advanced';
}

export class CMPIntelligenceDetector {
  
  async analyzeCMP(page: Page): Promise<CMPAnalysis> {
    // 1. Rileva CMP provider attraverso librerie caricate
    const libs = await page.evaluate(() => {
      const scripts = Array.from(document.scripts).filter(s => s.src);
      const links = Array.from(document.links).filter(l => l.href);
      return [...scripts, ...links].map(s => {
        const url = (s as HTMLScriptElement).src || s.href || '';
        return {
          source: url,
          attributes: Array.from(s.attributes).map(a => `${a.name}="${a.value}"`)
        };
      });
    });

    // 2. Valuta candidati provider
    const candidates = await this.evaluateProviders(page, libs);

    // 3. Analizza lo stato e configurazione
    return await this.analyzeCMPState(page, candidates[0]);
  }

  private async evaluateProviders(page: Page, libs: any[]): Promise<CMPAnalysis[]> {
    const providerMap = [
      {
        name: 'OneTrust',
        patterns: ['onetrust', 'opentrust'],
        selectors: ['#onetrust-consent-sdk', '#onetrust-pc-sdk']
      },
      {
        name: 'Cookiebot',
        patterns: ['cookiebot', 'cookiedecline'],
        selectors: ['#CybotCookiebotDialog', '#CybotCookiebotDialogBody']
      },
      {
        name: 'Iubenda',
        patterns: ['iubenda', 'iubent-cs'],
        selectors: ['.iubenda-cs-banner', '#iubenda-cs-banner']
      },
      {
        name: 'Didomi',
        patterns: ['didomi'],
        selectors: ['.didomi-popup', '#didomi-host']
      },
      {
        name: 'UserCentrics',
        patterns: ['usercentrics', 'uc-ui'],
        selectors: ['.uc-knwtr', '#uc-banner']
      }
    ];

    const results: CMPAnalysis[] = [];

    for (const provider of providerMap) {
      let confidence = 0;
      const detectedSelectors: string[] = [];

      // Check for JS library presence
      const matchesLib = libs.some(lib => 
        provider.patterns.some(pattern => 
          lib.source.toLowerCase().includes(pattern)
        )
      );

      if (matchesLib) confidence += 0.6;

      // Check DOM elements
      for (const selector of provider.selectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            detectedSelectors.push(selector);
            confidence += 0.4;
          }
        } catch (e) {
          // Elemento non trovato o non visibile
        }
      }

      if (confidence > 0.3) {
        results.push({
          name: provider.name,
          confidence: Math.min(confidence, 1.0),
          detectedSelectors,
          features: await this.detectFeatures(page, provider.name),
          complianceLevel: confidence > 0.7 ? 'enhanced' : 'basic'
        } as CMPAnalysis);
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private async detectFeatures(page: Page, providerName: string): Promise<CMPAnalysis['features']> {
    const features = {
      hasCustomizable: false,
      hasTCF: false,
      hasCategories: false,
      hasPreference: false
    };

    try {
      // Check for TCF compliance by looking for TCF signals
      const tcfPresent = await page.evaluate(() => {
        return typeof (window as any).__tcfapi === 'function';
      });
      features.hasTCF = tcfPresent;

      // Check for category/preference controls
      features.hasCategories = await page.evaluate((provider) => {
        const categorySelectors = [
          '[data-category]',
          '[data-o-id*="preference"]',
          '.category-toggle',
          '.consent-category'
        ];
        
        return categorySelectors.some(sel => document.querySelector(sel) !== null);
      }, providerName);

      features.hasCustomizable = features.hasTCF || features.hasCategories;

    } catch (e) {
      // Feature detection failed
    }

    return features;
  }

  private async analyzeCMPState(page: Page, candidate: CMPAnalysis): Promise<CMPAnalysis> {
    // Active analyze current CMP state and configuration
    candidate.complianceLevel = await this.assessComplianceLevel(page, candidate);
    return candidate;
  }

  private async assessComplianceLevel(page: Page, analysis: CMPAnalysis): Promise<'basic' | 'enhanced' | 'advanced'> {
    const checks = await Promise.all([
      page.evaluate(() => typeof (window as any).gtag === 'function'),
      page.evaluate(() => Array.isArray((window as any).dataLayer)),
      page.evaluate(() => document.querySelector('[data-consent-origin]') !== null),
      page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        return Array.from(iframes).some(i => 
          i.src.includes('consentmanager') || 
          i.src.includes('cookiebot')
        );
      })
    ]);

    const score = checks.filter(Boolean).length;
    
    if (score >= 3) return 'advanced';
    if (score >= 2) return 'enhanced';
    return 'basic';
  }
}
// @ts-nocheck
