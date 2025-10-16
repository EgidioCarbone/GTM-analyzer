import type { MacroContext } from '../types/push-cases.js';

// Counters volatile in memoria server
const counters = new Map<string, number>();

export function resolveMacros(obj: any, ctx: MacroContext = {}): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return resolveStringMacros(obj, ctx);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => resolveMacros(item, ctx));
  }

  if (typeof obj === 'object') {
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveMacros(value, ctx);
    }
    return resolved;
  }

  return obj;
}

function resolveStringMacros(str: string, ctx: MacroContext): string {
  return str.replace(/\{\{([^}]+)\}\}/g, (match, macro) => {
    try {
      return resolveMacro(macro.trim(), ctx);
    } catch (err) {
      console.warn(`[MACRO] Failed to resolve macro ${macro}:`, err);
      return match; // Return original if resolution fails
    }
  });
}

function resolveMacro(macro: string, ctx: MacroContext): string {
  const parts = macro.split(':');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'uuid':
      return crypto.randomUUID();

    case 'ts':
      return Date.now().toString();

    case 'now':
      if (args[0] === 'iso') {
        return new Date().toISOString();
      }
      return new Date().toISOString();

    case 'today':
      const format = args[0] || 'YYYY-MM-DD';
      return formatDate(new Date(), format);

    case 'randint':
      if (args.length !== 1) {
        throw new Error('randInt requires format: min-max');
      }
      const [min, max] = args[0].split('-').map(Number);
      if (isNaN(min) || isNaN(max) || min >= max) {
        throw new Error('randInt requires valid min-max range');
      }
      return Math.floor(Math.random() * (max - min + 1)) + min;

    case 'increment':
      if (args.length !== 1) {
        throw new Error('increment requires counter name');
      }
      const counterName = args[0];
      const current = counters.get(counterName) || 0;
      const next = current + 1;
      counters.set(counterName, next);
      return next.toString();

    case 'env':
      if (args.length !== 1) {
        throw new Error('env requires variable name');
      }
      const envVar = args[0];
      if (ctx.env && ctx.env[envVar]) {
        return ctx.env[envVar];
      }
      return process.env[envVar] || '';

    case 'urlparam':
      if (args.length !== 1) {
        throw new Error('urlParam requires parameter name');
      }
      const paramName = args[0];
      if (ctx.url) {
        try {
          const url = new URL(ctx.url);
          return url.searchParams.get(paramName) || '';
        } catch {
          return '';
        }
      }
      return '';

    default:
      throw new Error(`Unknown macro: ${command}`);
  }
}

function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year.toString())
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

// Utility per testare le macro
export function testMacros() {
  const testCtx: MacroContext = {
    url: 'https://example.com?test=123&debug=true',
    env: { NODE_ENV: 'development' },
    counters: {}
  };

  const testCases = [
    '{{uuid}}',
    '{{ts}}',
    '{{now:iso}}',
    '{{today:YYYY-MM-DD}}',
    '{{randInt:1000-9999}}',
    '{{increment:test}}',
    '{{increment:test}}',
    '{{env:NODE_ENV}}',
    '{{urlParam:test}}',
    '{{urlParam:debug}}',
  ];

  console.log('[MACRO] Testing macros:');
  testCases.forEach(test => {
    try {
      const result = resolveStringMacros(test, testCtx);
      console.log(`  ${test} → ${result}`);
    } catch (err) {
      console.log(`  ${test} → ERROR: ${err}`);
    }
  });
}
