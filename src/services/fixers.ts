/**
 * Fixers Service - Automated fixes for GTM container issues
 * 
 * This service provides automated fixes for common GTM container issues
 * identified by the analysis system.
 */

import { GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getParam(item: GTMTag | GTMVariable, key: string): any {
  return (item.parameter || []).find(p => p.key === key)?.value;
}

function setParam(item: GTMTag | GTMVariable, key: string, value: any): void {
  if (!item.parameter) item.parameter = [];
  const existing = item.parameter.find(p => p.key === key);
  if (existing) {
    existing.value = value;
  } else {
    item.parameter.push({ key, value });
  }
}

function normalize(s: string): string {
  return s.trim().replace(/[^\w]+/g, '_').replace(/_+/g, '_');
}

// ============================================================================
// NAMING FIXERS
// ============================================================================

export function suggestName(itemType: 'tag' | 'trigger' | 'variable', name: string): string {
  // Regole di naming basate su gtm-metrics.ts
  if (itemType === 'trigger') {
    return name.startsWith('TRG_') ? name : 'TRG_' + normalize(name);
  }
  if (itemType === 'variable') {
    return /^[A-Z]+_/.test(name) ? name : 'DLV_' + normalize(name);
  }
  // tag:
  return /^(UA|GA4_EVENT|GTAG|HTML)_/.test(name) ? name : 'HTML_' + normalize(name);
}

export function fixNaming(item: GTMTag | GTMTrigger | GTMVariable, itemType: 'tag' | 'trigger' | 'variable'): void {
  item.name = suggestName(itemType, item.name);
}

// ============================================================================
// VARIABLE FIXERS
// ============================================================================

export function addDLVFallback(variable: GTMVariable): void {
  variable.parameter ||= [];
  const hasDefault = variable.parameter.some(p => p.key === 'defaultValue');
  if (!hasDefault) {
    variable.parameter.push({ key: 'defaultValue', value: '' });
  }
}

export function addLookupDefault(variable: GTMVariable): void {
  variable.parameter ||= [];
  const hasDefault = variable.parameter.some(p => p.key === 'defaultTable');
  if (!hasDefault) {
    variable.parameter.push({ key: 'defaultTable', value: '' });
  }
}

export function wrapJsTryCatch(variable: GTMVariable): void {
  const code = getParam(variable, 'value');
  if (typeof code === 'string' && !/try\s*\{/.test(code)) {
    setParam(variable, 'value', `try{\n${code}\n}catch(e){console.warn('JS Var error',e);return undefined;}`);
  }
}

// ============================================================================
// HTML SECURITY FIXERS
// ============================================================================

export function forceHttps(tag: GTMTag): void {
  if (tag.type !== 'html' || !tag.html) return;
  tag.html = tag.html.replace(/http:\/\//g, 'https://');
}

export function addIdempotencyGuard(tag: GTMTag): void {
  if (tag.type !== 'html' || !tag.html || /__htmlTag_loaded/.test(tag.html)) return;
  tag.html = `if(window.__htmlTag_loaded)return;window.__htmlTag_loaded=true;\n${tag.html}`;
}

// ============================================================================
// TRIGGER FIXERS
// ============================================================================

export function changeTriggerTiming(trigger: GTMTrigger, newTiming: string): void {
  // Cambia il timing del trigger (es. da All Pages a DOM Ready)
  if (trigger.type === 'pageview' && newTiming === 'DOM_READY') {
    trigger.type = 'dom_ready';
  }
}

// ============================================================================
// BULK FIXERS
// ============================================================================

export function bulkFixNaming(items: (GTMTag | GTMTrigger | GTMVariable)[], itemType: 'tag' | 'trigger' | 'variable'): void {
  items.forEach(item => fixNaming(item, itemType));
}

export function bulkAddDLVFallback(variables: GTMVariable[]): void {
  variables.forEach(addDLVFallback);
}

export function bulkAddLookupDefault(variables: GTMVariable[]): void {
  variables.forEach(addLookupDefault);
}

export function bulkWrapJsTryCatch(variables: GTMVariable[]): void {
  variables.forEach(wrapJsTryCatch);
}

export function bulkForceHttps(tags: GTMTag[]): void {
  tags.forEach(forceHttps);
}

export function bulkAddIdempotencyGuard(tags: GTMTag[]): void {
  tags.forEach(addIdempotencyGuard);
}

export function bulkChangeTriggerTiming(triggers: GTMTrigger[], newTiming: string): void {
  triggers.forEach(trigger => changeTriggerTiming(trigger, newTiming));
}

// ============================================================================
// HELPER FUNCTIONS FOR CONTAINER MANAGER
// ============================================================================

export function getItemsWithIssues(container: any, issueCategory: string, itemType: 'tag' | 'trigger' | 'variable'): any[] {
  const items = container[itemType] || [];
  
  // Questo sarà integrato con l'issuesIndex quando disponibile
  // Per ora, implementiamo la logica base
  switch (issueCategory) {
    case 'naming':
      const namingRules = {
        tag: /^(UA|GA4_EVENT|GTAG|HTML)_[A-Z0-9_]+$/,
        trigger: /^TRG_[A-Z0-9_]+$/,
        variable: /^(DLV|JS|CONST|URL|CSS|RANDOM)_[A-Z0-9_]+$/
      };
      const rule = namingRules[itemType];
      return items.filter((item: any) => !rule.test(String(item.name || '')));
    
    case 'paused':
      return items.filter((item: any) => item.paused === true);
    
    case 'ua_obsolete':
      return items.filter((item: any) => 
        item.type.includes('UA') || 
        item.type.includes('Universal') ||
        item.type === 'ua'
      );
    
    default:
      return [];
  }
}

export function canApplyBulkFix(issueCategory: string, itemType: 'tag' | 'trigger' | 'variable'): boolean {
  const supportedFixes = {
    naming: ['tag', 'trigger', 'variable'],
    variable_dlv_fallback: ['variable'],
    variable_lookup_default: ['variable'],
    variable_js_unsafe: ['variable'],
    html_security_critical: ['tag'],
    html_security_major: ['tag'],
    html_security_minor: ['tag'],
    trigger_timing: ['trigger'],
    paused: ['tag', 'trigger', 'variable'],
    ua_obsolete: ['tag']
  };
  
  return supportedFixes[issueCategory as keyof typeof supportedFixes]?.includes(itemType) || false;
}

export function getBulkFixFunction(issueCategory: string): ((items: any[]) => void) | null {
  const fixFunctions = {
    naming: bulkFixNaming,
    variable_dlv_fallback: bulkAddDLVFallback,
    variable_lookup_default: bulkAddLookupDefault,
    variable_js_unsafe: bulkWrapJsTryCatch,
    html_security_critical: bulkForceHttps,
    html_security_major: bulkForceHttps,
    html_security_minor: bulkForceHttps,
    trigger_timing: bulkChangeTriggerTiming
  };
  
  return fixFunctions[issueCategory as keyof typeof fixFunctions] || null;
}
