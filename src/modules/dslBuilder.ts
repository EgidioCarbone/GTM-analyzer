import { SSDModule, ModuleUseCaseStep, ModuleUseCaseStepEvent } from './types';
import { ModuleConfig, TestSpec, Test, Step, Expectation } from '../types/ssd';

interface BuildManifestOptions {
  site: string;
  moduleConfig?: ModuleConfig;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function sanitizeDescription(description?: string, notes?: string): string | undefined {
  if (!description && !notes) return undefined;
  if (description && notes) return `${description} (${notes})`;
  return description ?? notes;
}

function buildExpectations(
  step: ModuleUseCaseStep,
  allowedHosts: Set<string>,
  site: string
): Expectation[] {
  const expectations: Expectation[] = [];

  const addHostFromUrl = (maybeUrl?: string) => {
    if (!maybeUrl) return;
    try {
      const resolved = new URL(maybeUrl, site);
      allowedHosts.add(resolved.host);
    } catch {
      // ignore invalid URLs
    }
  };

  if (step.expectEvents) {
    for (const evt of step.expectEvents) {
      if (!evt || !evt.event) continue;
      const subset = isObject(evt.payload) ? evt.payload : undefined;
      expectations.push({
        type: 'dataLayer',
        event: evt.event,
        params_subset: subset,
      });
      if (subset && typeof subset.link_url === 'string') {
        addHostFromUrl(subset.link_url);
      }
    }
  }

  if (step.expectUrlContains) {
    expectations.push({
      type: 'navigation',
      url_contains: step.expectUrlContains,
    });
  }

  return expectations;
}

function mapStep(
  step: ModuleUseCaseStep,
  allowedHosts: Set<string>,
  site: string
): Step | null {
  const description = sanitizeDescription(step.description, step.notes);
  const expectations = buildExpectations(step, allowedHosts, site);

  switch (step.action) {
    case 'click': {
      if (!step.targetSelector) {
        return null;
      }
      const mappedStep: Step = {
        action: 'click',
        description,
        target: {
          kind: 'selector',
          value: step.targetSelector,
        },
      };
      if (expectations.length > 0) {
        mappedStep.expect = expectations;
      }
      return mappedStep;
    }
    case 'input': {
      if (!step.targetSelector || typeof step.value !== 'string') {
        return null;
      }
      const mappedStep: Step = {
        action: 'input',
        description,
        target: {
          kind: 'selector',
          value: step.targetSelector,
        },
        value: step.value,
      };
      if (expectations.length > 0) {
        mappedStep.expect = expectations;
      }
      return mappedStep;
    }
    case 'waitFor': {
      if (!step.waitForSelector) return null;
      const mappedStep: Step = {
        action: 'wait_for_selector',
        description,
        target: {
          kind: 'selector',
          value: step.waitForSelector,
        },
      };
      if (expectations.length > 0) {
        mappedStep.expect = expectations;
      }
      return mappedStep;
    }
    case 'assertEvent': {
      if (!step.expectEvents || step.expectEvents.length === 0) return null;
      const mappedStep: Step = {
        action: 'custom',
        description: description ?? 'Verifica eventi attesi',
        expect: expectations,
      };
      return mappedStep;
    }
    case 'navigate': {
      if (!step.expectUrlContains) return null;
      const mappedStep: Step = {
        action: 'navigate',
        description,
        target: step.targetSelector
          ? {
              kind: 'href',
              value: step.targetSelector,
            }
          : undefined,
        expect: expectations,
      };
      return mappedStep;
    }
    default:
      return null;
  }
}

export function buildTestSpecFromManifest(
  module: SSDModule,
  options: BuildManifestOptions
): TestSpec | null {
  const { manifest } = module;
  if (!manifest || !manifest.useCases || manifest.useCases.length === 0) {
    return null;
  }

  const allowedHosts = new Set<string>();
  try {
    const siteHost = new URL(options.site).host;
    allowedHosts.add(siteHost);
  } catch {
    // ignore invalid site host
  }

  const tests: Test[] = [];

  for (const useCase of manifest.useCases) {
    const steps: Step[] = [];
    for (const step of useCase.steps) {
      const mapped = mapStep(step, allowedHosts, options.site);
      if (mapped) {
        steps.push(mapped);
      }
    }

    if (steps.length === 0) {
      continue;
    }

    tests.push({
      section: useCase.label || useCase.id,
      steps,
    });
  }

  if (tests.length === 0) {
    return null;
  }

  return {
    site: options.site,
    allowed_hosts: Array.from(allowedHosts),
    consent: ['accept'],
    tests,
    meta: {
      model: `module-manifest:${module.meta.id}`,
      moduleId: module.meta.id,
      tokens: {
        input: 0,
        output: 0,
      },
    },
  };
}

export type { ModuleUseCaseStepEvent };
