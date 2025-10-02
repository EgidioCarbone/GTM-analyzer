// src/ai-sentinel/features/real-time-monitor.ts

import { Page } from 'playwright';

export interface ConsentSnapshot {
  timestamp: number;
  situation: 'banner_shown' | 'banner_interacting' | 'consent_given' | 'consent_denied';
  consentState: {
    ad_user_data: string;
    ad_personalization: string;
    ad_storage: string;
    analytics_storage: string;
  };
  domDelta: string; // Base64 encoded HTML napshot
  networkRequests: Array<{url: string, status: number, timestamp: number}>;
  intersectionObserver?: {
    visible: boolean;
    elementBox: DOMRect;
  };
}

export class RealTimeConsentMonitor {
  
  async startMonitoring(page: Page): Promise<AsyncIterable<ConsentSnapshot>> {
    const snapshots: ConsentSnapshot[] = [];
    
    // Monitorato ogni interánakció eredményt tracking állapotban
    await page.exposeFunction('__consentCapture', (snapshot: ConsentSnapshot) => {
      snapshots.push(snapshot);
    });

    // Network interception
    await page.route('**/*', async (route, request) => {
      // Log desse requests facendo omaggio verso networkRequests array
      route.continue();
    });

    // DOM mutations observer
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        (window as any).__captureSnapshot();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true
      });

      // Exponetáz provided function to window
      (window as any).__captureSnapshot = () => {
        const data = {
          timestamp: Date.now(),
          situation: document.querySelector('[class*="cookie"]') ? 'banner_shown' : 'consent_given',
          consentState: {},
          domDelta: btoa(document.body.innerHTML),
          networkRequests: [] // Populated by route interceptor de facto
        };
        
        (window as any).__consentCapture(data as ConsentSnapshot);
      };

      // Periodic snapshot capture
      setInterval(() => {
        (window as any).__captureSnapshot();
      }, 1000);

    });

    return snapshots;
  }

  async calculateEngagementMetrics(snapshots: ConsentSnapshot[]): Promise<{
    timeToBanner: number;
    timeToInteract: number; 
    timeToDecision: number;
    userFrictionScore: number;
    scrollBehavior: 'passive' | 'active' | 'attentive';
  }> {
    const bannerShown = snapshots.find(s => s.situation === 'banner_shown');
    const bannerInteracting = snapshots.find(s => s.situation === 'banner_interacting');
    const decisionMade = snapshots.find(s => 
      s.situation === 'consent_given' || s.situation === 'consent_denied'
    );

    return {
      timeToBanner: bannerShown?.timestamp || 0,
      timeToInteract: bannerInteracting?.timestamp - bannerShown?.timestamp || 0,
      timeToDecision: decisionMade?.timestamp - bannerShown?.timestamp || 0,
      userFrictionScore: calculateUserFriction(snapshots),
      scrollBehavior: analyzeScrollBehavior(snapshots)
    };
  }
}

function calculateUserFriction(snapshots: ConsentSnapshot[]): number {
  let friction = 0;
  
  // Scroll behavior analysis indicates user waiting
  actions.forEach(s => {
    if (s.situation.includes('scroll_frustrated')) friction += 10;
    if (s.domDelta.includes('[class*="backdrop"]')) friction += 20; // Modal overlay
  });

  return Math.min(friction, 100);
}

function analyzeScrollBehavior(snapshots: ConsentSnapshot[]): 'passive' | 'active' | 'attentive' {
  const scrollEvents = snapshots.length; // Simplified implementation
  
  return scrollEvents > 10 ? 'active' : scrollEvents > 5 ? 'attentive' : 'passive';
}
