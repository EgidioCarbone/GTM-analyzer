// Cookie Banner Extractor Service
// Estrae il cookie banner dall'HTML della pagina
// ============================================================================

export interface CookieBannerInfo {
  found: boolean;
  html: string;
  text: string;
  selectors: string[];
  attributes: Record<string, string>;
  position: 'top' | 'bottom' | 'center' | 'unknown';
  type: 'banner' | 'modal' | 'popup' | 'unknown';
  buttons: ConsentButton[];
}

export interface ConsentButton {
  id: string;
  className: string;
  text: string;
  type: string;
  role: string;
  selector: string;
  isAcceptAll: boolean;
  confidence: number; // 0-1, quanto siamo sicuri che sia il bottone "Accept All"
}

/**
 * Estrae il cookie banner dall'HTML della pagina
 */
export function extractCookieBanner(html: string): CookieBannerInfo {
  const result: CookieBannerInfo = {
    found: false,
    html: '',
    text: '',
    selectors: [],
    attributes: {},
    position: 'unknown',
    type: 'unknown',
    buttons: []
  };

  // Pattern comuni per cookie banner - PRIORITÀ AI SELETTORI SPECIFICI CMP
  const cookieBannerSelectors = [
    // Selettori specifici per librerie CMP (PRIORITÀ ALTA)
    '#onetrust-consent-sdk',
    '.ot-sdk-container',
    '.CybotCookiebotDialogContentWrapper', // Cookiebot specifico
    '.CybotCookiebotDialog', // Cookiebot specifico
    '#cookieChoiceInfo',
    '.cookie-notice',
    '.cookie-banner',
    '.consent-banner',
    '.gdpr-banner',
    '.privacy-banner',
    '#cookie-law-info-bar',
    '.cli-modal-backdrop',
    '.cc-window',
    '.cc-banner',
    '.cc-modal',
    '#cookieconsent',
    '.cookie-consent',
    '.eu-cookie-compliance-banner',
    '.cookie-notification',
    '.privacy-notice',
    '.consent-notice',
    // Selettori generici (PRIORITÀ BASSA)
    '[id*="cookie"]',
    '[class*="cookie"]',
    '[id*="consent"]',
    '[class*="consent"]',
    '[id*="gdpr"]',
    '[class*="gdpr"]',
    '[id*="privacy"]',
    '[class*="privacy"]',
    '[data-testid*="cookie"]',
    '[data-testid*="consent"]',
    '[role="banner"]',
    '[role="dialog"]',
    '[aria-label*="cookie"]',
    '[aria-label*="consent"]',
    '[aria-label*="privacy"]',
    // Selettori generici banner (ULTIMA PRIORITÀ)
    '[id*="banner"]',
    '[class*="banner"]'
  ];

  try {
    // Crea un parser HTML semplice usando regex
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    let cookieBannerElement: Element | null = null;
    let matchedSelector = '';

    // Cerca il cookie banner usando i selettori comuni
    for (const selector of cookieBannerSelectors) {
      try {
        const element = doc.querySelector(selector);
        if (element) {
          cookieBannerElement = element;
          matchedSelector = selector;
          break;
        }
      } catch (e) {
        // Ignora selettori non validi
        continue;
      }
    }

    if (cookieBannerElement) {
      result.found = true;
      result.html = cookieBannerElement.outerHTML;
      result.text = cookieBannerElement.textContent?.trim() || '';
      result.selectors = [matchedSelector];

      // Estrai attributi rilevanti
      const attributes: Record<string, string> = {};
      for (const attr of cookieBannerElement.attributes) {
        attributes[attr.name] = attr.value;
      }
      result.attributes = attributes;

      // Determina la posizione basata su stili CSS o attributi
      const style = cookieBannerElement.getAttribute('style') || '';
      const className = cookieBannerElement.className || '';
      
      if (style.includes('top:') || className.includes('top')) {
        result.position = 'top';
      } else if (style.includes('bottom:') || className.includes('bottom')) {
        result.position = 'bottom';
      } else if (style.includes('center') || className.includes('center')) {
        result.position = 'center';
      }

      // Determina il tipo
      if (className.includes('modal') || cookieBannerElement.tagName === 'DIALOG') {
        result.type = 'modal';
      } else if (className.includes('popup') || className.includes('pop-up')) {
        result.type = 'popup';
      } else if (className.includes('banner')) {
        result.type = 'banner';
      }
    }
  } catch (error) {
    console.error('Error parsing HTML for cookie banner:', error);
  }

  return result;
}

/**
 * Identifica se un bottone è per accettare tutti i cookie
 */
function identifyAcceptAllButton(button: any): { isAcceptAll: boolean; confidence: number } {
  const text = button.text?.toLowerCase() || '';
  const id = button.id?.toLowerCase() || '';
  const className = button.className?.toLowerCase() || '';
  
  // Pattern per "Accept All" in diverse lingue
  const acceptAllPatterns = [
    'accept all', 'accetta tutti', 'accept all cookies', 'accetta tutti i cookie',
    'allow all', 'consenti tutto', 'allow all cookies', 'consenti tutti i cookie',
    'accept', 'accetta', 'allow', 'consenti', 'i accept', 'accetto',
    'accept all and continue', 'accetta e continua', 'accept and continue',
    'ok', 'okay', 'yes', 'sì', 'si', 'continue', 'continua'
  ];
  
  // Pattern per identificare bottoni di rifiuto (da escludere)
  const rejectPatterns = [
    'reject', 'rifiuta', 'decline', 'declina', 'deny', 'nega',
    'only necessary', 'solo necessari', 'essential only', 'solo essenziali',
    'customize', 'personalizza', 'settings', 'impostazioni', 'preferences', 'preferenze'
  ];
  
  // Controlla se contiene pattern di rifiuto
  for (const pattern of rejectPatterns) {
    if (text.includes(pattern) || id.includes(pattern) || className.includes(pattern)) {
      return { isAcceptAll: false, confidence: 0.9 };
    }
  }
  
  // Controlla pattern di accettazione
  let confidence = 0;
  for (const pattern of acceptAllPatterns) {
    if (text.includes(pattern)) {
      confidence = Math.max(confidence, 0.8);
    }
    if (id.includes(pattern)) {
      confidence = Math.max(confidence, 0.7);
    }
    if (className.includes(pattern)) {
      confidence = Math.max(confidence, 0.6);
    }
  }
  
  // Bonus per selettori specifici
  if (id.includes('accept') || id.includes('allow') || id.includes('consent')) {
    confidence = Math.max(confidence, 0.5);
  }
  
  // Bonus per essere il primo o ultimo bottone
  if (button.position === 'first' || button.position === 'last') {
    confidence += 0.1;
  }
  
  return { isAcceptAll: confidence > 0.3, confidence: Math.min(confidence, 1) };
}

/**
 * Estrae il cookie banner usando Puppeteer (per uso server-side)
 */
export async function extractCookieBannerWithPuppeteer(page: any): Promise<CookieBannerInfo> {
  const result: CookieBannerInfo = {
    found: false,
    html: '',
    text: '',
    selectors: [],
    attributes: {},
    position: 'unknown',
    type: 'unknown',
    buttons: []
  };

  try {
    // Esegui script nel browser per trovare il cookie banner
    const cookieBannerData = await page.evaluate(() => {
      const cookieBannerSelectors = [
        // Selettori specifici per librerie CMP (PRIORITÀ ALTA)
        '#onetrust-consent-sdk',
        '.ot-sdk-container',
        '.CybotCookiebotDialogContentWrapper', // Cookiebot specifico
        '.CybotCookiebotDialog', // Cookiebot specifico
        '#cookieChoiceInfo',
        '.cookie-notice',
        '.cookie-banner',
        '.consent-banner',
        '.gdpr-banner',
        '.privacy-banner',
        '#cookie-law-info-bar',
        '.cli-modal-backdrop',
        '.cc-window',
        '.cc-banner',
        '.cc-modal',
        '#cookieconsent',
        '.cookie-consent',
        '.eu-cookie-compliance-banner',
        '.cookie-notification',
        '.privacy-notice',
        '.consent-notice',
        // Selettori generici (PRIORITÀ BASSA)
        '[id*="cookie"]',
        '[class*="cookie"]',
        '[id*="consent"]',
        '[class*="consent"]',
        '[id*="gdpr"]',
        '[class*="gdpr"]',
        '[id*="privacy"]',
        '[class*="privacy"]',
        '[data-testid*="cookie"]',
        '[data-testid*="consent"]',
        '[role="banner"]',
        '[role="dialog"]',
        '[aria-label*="cookie"]',
        '[aria-label*="consent"]',
        '[aria-label*="privacy"]',
        // Selettori generici banner (ULTIMA PRIORITÀ)
        '[id*="banner"]',
        '[class*="banner"]'
      ];

      for (const selector of cookieBannerSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            const rect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);
            
            // Verifica che l'elemento sia visibile
            if (rect.width > 0 && rect.height > 0 && 
                computedStyle.display !== 'none' && 
                computedStyle.visibility !== 'hidden') {
              
              const attributes: Record<string, string> = {};
              for (const attr of element.attributes) {
                attributes[attr.name] = attr.value;
              }

              let position = 'unknown';
              if (rect.top < window.innerHeight / 2) {
                position = 'top';
              } else if (rect.bottom > window.innerHeight / 2) {
                position = 'bottom';
              }

              let type = 'unknown';
              if (element.tagName === 'DIALOG' || element.getAttribute('role') === 'dialog') {
                type = 'modal';
              } else if (element.className.includes('popup') || element.className.includes('pop-up')) {
                type = 'popup';
              } else if (element.className.includes('banner')) {
                type = 'banner';
              }

              // Estrai solo i bottoni di azione principali dal cookie banner
              // Escludi elementi interni come provider di cookie, dettagli, etc.
              const buttonSelectors = [
                'button[id*="Accept"]',
                'button[id*="Decline"]', 
                'button[id*="Allow"]',
                'button[id*="Reject"]',
                'button[id*="Customize"]',
                'button[id*="Personalize"]',
                'button[id*="Close"]',
                'button[id*="Button"]',
                'button[class*="Button"]',
                'input[type="button"][id*="Accept"]',
                'input[type="button"][id*="Decline"]',
                'input[type="button"][id*="Allow"]',
                'input[type="button"][id*="Reject"]',
                'input[type="submit"]'
              ];
              
              const buttons = [];
              for (const selector of buttonSelectors) {
                try {
                  const foundButtons = Array.from(element.querySelectorAll(selector));
                  buttons.push(...foundButtons);
                } catch (e) {
                  // Ignora selettori non validi
                }
              }
              
              // Rimuovi duplicati e filtra solo elementi visibili
              const uniqueButtons = [...new Set(buttons)].filter(btn => {
                const rect = btn.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(btn);
                return rect.width > 0 && rect.height > 0 && 
                       computedStyle.display !== 'none' && 
                       computedStyle.visibility !== 'hidden' &&
                       btn.textContent && btn.textContent.trim().length > 0;
              });
              
              const buttonData = uniqueButtons.map((btn, index) => {
                const buttonElement = btn as HTMLElement;
                return {
                  id: buttonElement.id || '',
                  className: buttonElement.className || '',
                  text: buttonElement.textContent?.trim() || '',
                  type: buttonElement.getAttribute('type') || 'button',
                  role: buttonElement.getAttribute('role') || '',
                  selector: buttonElement.id ? `#${buttonElement.id}` : `.${buttonElement.className.split(' ')[0]}` || `button:nth-child(${index + 1})`,
                  position: index === 0 ? 'first' : index === uniqueButtons.length - 1 ? 'last' : 'middle'
                };
              });

              return {
                found: true,
                html: element.outerHTML,
                text: element.textContent?.trim() || '',
                selectors: [selector],
                attributes,
                position,
                type,
                buttons: buttonData
              };
            }
          }
        } catch (e) {
          continue;
        }
      }

      return {
        found: false,
        html: '',
        text: '',
        selectors: [],
        attributes: {},
        position: 'unknown',
        type: 'unknown'
      };
    });

    Object.assign(result, cookieBannerData);
    
    // Identifica i bottoni "Accept All" e aggiungi confidence
    if (result.buttons) {
      result.buttons = result.buttons.map(button => {
        const identification = identifyAcceptAllButton(button);
        return {
          ...button,
          isAcceptAll: identification.isAcceptAll,
          confidence: identification.confidence
        };
      });
    }
  } catch (error) {
    console.error('Error extracting cookie banner with Puppeteer:', error);
  }

  return result;
}
