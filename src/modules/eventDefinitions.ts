import type { TestSpec, Step } from '../types/ssd';
import { ModuleEventDefinition, ModuleId, ScenarioStep } from './types';

const createNavigationStep = (url: string): Step => ({
  description: 'Naviga alla pagina di test',
  action: 'navigate',
  target: { kind: 'href', value: url },
  expect: [
    {
      type: 'navigation',
      url_contains: (() => {
        try {
          return new URL(url).host;
        } catch {
          return url;
        }
      })(),
    },
  ],
});

const actalisEvents: Record<string, ModuleEventDefinition> = {
  view_item_list: {
    id: 'view_item_list',
    label: 'View Item List',
    description: 'Verifica il push view_item_list nella pagina elenco prodotti.',
    inputs: [],
    steps: [
      {
        id: 'navigate',
        label: 'Vai alla pagina elenco prodotti',
        type: 'navigate',
        description: 'Assicurati che l’URL porti alla listing con il push view_item_list.',
      },
      {
        id: 'await_view_item_list',
        label: 'Attendi evento view_item_list',
        type: 'custom',
        description: 'Il runner ascolta il dataLayer e attende il push view_item_list.',
      },
    ],
    expectationTemplate: {
      type: 'dataLayer',
      event: 'view_item_list',
      payloadTemplate: {
        ecommerce: {
          items: [
            {
              item_name: '*',
              item_id: '*',
              price: '*',
              quantity: '*',
            },
          ],
        },
      },
    },
    buildTestSpec: ({ url, steps }) => {
      const allowedHosts = new Set<string>();
      try {
        allowedHosts.add(new URL(url).host);
      } catch {
        /* ignore */
      }

      const scenarioSteps = steps.length > 0 ? steps : [];
      const testSteps: Step[] = [];

      if (!scenarioSteps.some(step => step.type === 'navigate')) {
        testSteps.push(createNavigationStep(url));
      }

      for (const step of scenarioSteps) {
        if (step.type === 'navigate') {
          testSteps.push(createNavigationStep(url));
        } else if (step.type === 'click' && step.selector) {
          testSteps.push({
            description: step.label || 'Esegui click configurato',
            action: 'click',
            target: { kind: 'selector', value: step.selector },
            delayAfterMs: step.delayAfterMs,
          });
        }
      }

      if (testSteps.length === 0) {
        testSteps.push(createNavigationStep(url));
      }

      const test: TestSpec = {
        site: url,
        allowed_hosts: Array.from(allowedHosts),
        consent: ['accept'],
        tests: [
          {
            section: 'Ecommerce: view_item_list',
            steps: testSteps,
          },
        ],
        meta: {
          model: 'module-scenario:actalis:view_item_list',
          moduleId: 'actalis',
          tokens: { input: 0, output: 0 },
        },
      };

      return test;
    },
  },
  add_to_cart: {
    id: 'add_to_cart',
    label: 'Add To Cart',
    description: 'Verifica che il click su “Acquista” generi add_to_cart sul dataLayer.',
    inputs: [
      {
        id: 'ctaSelector',
        label: 'Selettore CSS della CTA',
        type: 'selector',
        placeholder: '.btn.btn-primary-alt.add-product.bronzeplan',
        helperText: 'Classe o ID univoco del bottone da cliccare.',
        required: true,
      },
    ],
    steps: [
      {
        id: 'navigate',
        label: 'Vai alla pagina prodotto',
        type: 'navigate',
      },
      {
        id: 'click_cta',
        label: 'Clicca la CTA Acquista',
        type: 'click',
        input: {
          id: 'ctaSelector',
          label: 'Selettore CTA',
          placeholder: '.btn.btn-primary-alt.add-product.bronzeplan',
          required: true,
          helperText: 'Usiamo il selettore per eseguire il click.',
          type: 'selector',
        },
      },
      {
        id: 'await_add_to_cart',
        label: 'Attendi evento add_to_cart',
        type: 'custom',
      },
    ],
    expectationTemplate: {
      type: 'dataLayer',
      event: 'add_to_cart',
      payloadTemplate: {
        ecommerce: {
          items: [
            {
              item_name: '*',
              item_id: '*',
              item_brand: '*',
              price: '*',
              quantity: 1,
            },
          ],
        },
      },
    },
    buildTestSpec: ({ url, config, steps }) => {
      const allowedHosts = new Set<string>();
      try {
        allowedHosts.add(new URL(url).host);
      } catch {
        /* ignore */
      }

      const ctaSelector = String(config.ctaSelector || '').trim();
      const scenarioSteps = steps.length > 0 ? steps : [];
      const testSteps: Step[] = [];

      let clickInserted = false;
      let navigatePresent = false;

      for (const step of scenarioSteps) {
        if (step.type === 'navigate') {
          navigatePresent = true;
          testSteps.push(createNavigationStep(url));
        } else if (step.type === 'click') {
          clickInserted = true;
          const selector = (step.selector || ctaSelector).trim();
          if (selector) {
            testSteps.push({
              description: step.label || 'Clicca la CTA configurata',
              action: 'click',
              target: { kind: 'selector', value: selector },
              delayAfterMs: step.delayAfterMs,
            });
          }
        }
      }

      if (!navigatePresent) {
        testSteps.unshift(createNavigationStep(url));
      }

      if (!clickInserted && ctaSelector) {
        testSteps.push({
          description: 'Clicca la CTA configurata',
          action: 'click',
          target: { kind: 'selector', value: ctaSelector },
        });
      }

      const test: TestSpec = {
        site: url,
        allowed_hosts: Array.from(allowedHosts),
        consent: ['accept'],
        tests: [
          {
            section: 'Ecommerce: add_to_cart',
            steps: testSteps,
          },
        ],
        meta: {
          model: 'module-scenario:actalis:add_to_cart',
          moduleId: 'actalis',
          tokens: { input: 0, output: 0 },
        },
      };

      return test;
    },
  },
};

const moduleEvents: Record<ModuleId, Record<string, ModuleEventDefinition>> = {
  actalis: actalisEvents,
  fibra: {},
  genertel: {},
};

export function listModuleEventDefinitions(moduleId: ModuleId): ModuleEventDefinition[] {
  const events = moduleEvents[moduleId];
  if (!events) return [];
  return Object.values(events);
}

export function getModuleEventDefinition(
  moduleId: ModuleId,
  eventId: string
): ModuleEventDefinition | undefined {
  const events = moduleEvents[moduleId];
  if (!events) return undefined;
  return events[eventId];
}
