import type { PushCommand } from '../../types/live-debugger';

export type ConsoleMode = 'datalayer' | 'gtag' | 'meta' | 'linkedin' | 'adobe';

export const formatJSON = (value: unknown) => JSON.stringify(value, null, 2);

export const DATALAYER_PRESETS: Record<string, Record<string, any>> = {
  page_view: { event: 'page_view' },
  view_item: {
    event: 'view_item',
    ecommerce: {
      items: [{ item_id: 'SKU_123', item_name: 'Prodotto' }],
    },
  },
  add_to_cart: {
    event: 'add_to_cart',
    ecommerce: {
      currency: 'EUR',
      value: 19.9,
      items: [{ item_id: 'SKU_123', quantity: 1 }],
    },
  },
  purchase: {
    event: 'purchase',
    ecommerce: {
      transaction_id: 'T123',
      value: 99,
      currency: 'EUR',
      items: [{ item_id: 'SKU_123' }],
    },
  },
};

type MetaPreset = NonNullable<PushCommand['meta']>;
type LinkedinPreset = NonNullable<PushCommand['linkedin']>;
type AdobePreset = NonNullable<PushCommand['adobe']>;

export const META_PRESETS: Record<string, MetaPreset> = {
  pageView: {
    eventName: 'PageView',
    params: {
      event_id: 'meta-pageview-001',
      currency: 'EUR',
      value: 0,
      content_category: 'debug',
    },
    pixelId: '999999999999999',
    trackType: 'track',
  },
  addToCart: {
    eventName: 'AddToCart',
    params: {
      event_id: 'meta-addtocart-001',
      currency: 'EUR',
      value: 29.9,
      contents: [{ id: 'SKU_ABC', quantity: 1 }],
    },
    pixelId: '999999999999999',
    trackType: 'track',
  },
  purchase: {
    eventName: 'Purchase',
    params: {
      event_id: 'meta-purchase-001',
      currency: 'EUR',
      value: 129.0,
      contents: [{ id: 'SKU_ABC', quantity: 1 }],
    },
    pixelId: '999999999999999',
    trackType: 'track',
  },
};

export const LINKEDIN_PRESETS: Record<string, LinkedinPreset> = {
  lead: {
    conversionId: '1234567',
    trackingId: '9876543',
    payload: {
      value: 45,
      currency: 'EUR',
      event_name: 'Lead',
    },
  },
  newsletter: {
    conversionId: '1357911',
    payload: {
      value: 0,
      currency: 'EUR',
      event_name: 'NewsletterSignup',
    },
  },
};

export const ADOBE_PRESETS: Record<string, AdobePreset> = {
  pageView: {
    call: 't',
    reportSuite: 'debugsuite',
    variables: {
      pageName: 'Live Debugger Demo',
      channel: 'live-debugger',
      eVar1: 'logged-in',
      prop1: 'home',
      events: 'event1',
    },
  },
  linkClick: {
    call: 'tl',
    linkType: 'o',
    linkName: 'CTA - preventivo',
    reportSuite: 'debugsuite',
    variables: {
      eVar2: 'Hero CTA',
      prop2: 'Hero',
      events: 'event2',
    },
  },
};

export const MODE_LABELS: Record<ConsoleMode, string> = {
  datalayer: 'DataLayer push',
  gtag: "gtag('event')",
  meta: 'Meta Pixel',
  linkedin: 'LinkedIn Insight',
  adobe: 'Adobe Analytics',
};

export const DEFAULT_META_PRESET = META_PRESETS.pageView;
export const DEFAULT_LINKEDIN_PRESET = LINKEDIN_PRESETS.lead;
export const DEFAULT_ADOBE_PRESET = ADOBE_PRESETS.pageView;

export const getPresetOptions = (mode: ConsoleMode): string[] => {
  switch (mode) {
    case 'datalayer':
      return Object.keys(DATALAYER_PRESETS);
    case 'meta':
      return Object.keys(META_PRESETS);
    case 'linkedin':
      return Object.keys(LINKEDIN_PRESETS);
    case 'adobe':
      return Object.keys(ADOBE_PRESETS);
    default:
      return [];
  }
};

export const commandPayloadSnapshot = (command: Omit<PushCommand, 'id' | 'origin'>): unknown => {
  switch (command.mode) {
    case 'datalayer':
      return command.payload;
    case 'gtag':
      return { name: command.name, params: command.params };
    case 'meta':
      return command.meta;
    case 'linkedin':
      return command.linkedin;
    case 'adobe':
      return command.adobe;
    default:
      return command;
  }
};

export const commandExpectedEvent = (command: Omit<PushCommand, 'id' | 'origin'>): string | undefined => {
  switch (command.mode) {
    case 'datalayer': {
      const source = Array.isArray(command.payload) ? command.payload[0] : command.payload;
      if (source && typeof source === 'object') {
        const obj = source as Record<string, any>;
        const eventName = obj.event ?? obj.event_name ?? obj.eventName;
        if (typeof eventName === 'string' && eventName.trim()) {
          return eventName.trim();
        }
      }
      return undefined;
    }
    case 'gtag':
      return command.name ?? undefined;
    case 'meta':
      return command.meta?.eventName ?? undefined;
    case 'linkedin':
      return (
        command.linkedin?.conversionId ||
        (command.linkedin?.payload && typeof command.linkedin.payload === 'object'
          ? (command.linkedin.payload as Record<string, any>).event_name
          : undefined)
      ) ?? undefined;
    case 'adobe':
      return (
        command.adobe?.linkName ||
        (command.adobe?.variables && typeof command.adobe.variables === 'object'
          ? (command.adobe.variables as Record<string, any>).events
          : undefined)
      ) ?? undefined;
    default:
      return undefined;
  }
};
