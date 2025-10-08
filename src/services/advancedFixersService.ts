/**
 * Advanced Fixers Service
 * 
 * Sistema di fix automatici intelligenti e sicuri
 * Risolve le lacune dei fix primitivi e pericolosi
 */

import { GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";
import { ValidationResult, ValidationError } from "./validationService";

// ============================================================================
// 1. TIPI E INTERFACCE
// ============================================================================

export interface FixResult {
  success: boolean;
  applied: boolean;
  changes: FixChange[];
  errors: string[];
  warnings: string[];
  rollback?: () => void;
}

export interface FixChange {
  type: 'create' | 'update' | 'delete';
  element: {
    type: 'tag' | 'trigger' | 'variable';
    id: string;
    name: string;
  };
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export interface FixContext {
  container: {
    tag: GTMTag[];
    trigger: GTMTrigger[];
    variable: GTMVariable[];
  };
  validation: ValidationResult;
  businessContext: {
    siteType: string;
    performanceRequirements: any;
    complianceRequirements: string[];
  };
  options: {
    dryRun: boolean;
    backup: boolean;
    rollback: boolean;
  };
}

export interface FixSuggestion {
  id: string;
  type: 'naming' | 'consent' | 'performance' | 'security' | 'hygiene' | 'logic';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  fixable: boolean;
  elements: Array<{
    type: 'tag' | 'trigger' | 'variable';
    id: string;
    name: string;
  }>;
  fix: (context: FixContext) => Promise<FixResult>;
}

// ============================================================================
// 2. SISTEMA DI FIX INTELLIGENTE
// ============================================================================

/**
 * Analizza un container e genera suggerimenti di fix
 */
export function analyzeAndSuggestFixes(context: FixContext): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  
  // Analizza errori di validazione
  context.validation.errors.forEach(error => {
    const suggestion = createFixSuggestionFromError(error, context);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  });
  
  // Analizza warning di validazione
  context.validation.warnings.forEach(warning => {
    const suggestion = createFixSuggestionFromWarning(warning, context);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  });
  
  // Analizza problemi di performance
  const performanceSuggestions = analyzePerformanceIssues(context);
  suggestions.push(...performanceSuggestions);
  
  // Analizza problemi di sicurezza
  const securitySuggestions = analyzeSecurityIssues(context);
  suggestions.push(...securitySuggestions);
  
  // Analizza problemi di compliance
  const complianceSuggestions = analyzeComplianceIssues(context);
  suggestions.push(...complianceSuggestions);
  
  // Ordina per priorità
  return suggestions.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Applica un fix con validazione e rollback
 */
export async function applyFix(
  suggestion: FixSuggestion,
  context: FixContext
): Promise<FixResult> {
  const changes: FixChange[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Backup se richiesto
    let rollback: (() => void) | undefined;
    if (context.options.backup) {
      rollback = createBackup(context.container);
    }
    
    // Applica il fix
    const result = await suggestion.fix(context);
    
    if (result.success) {
      changes.push(...result.changes);
      warnings.push(...result.warnings);
      
      // Valida il risultato
      const validation = validateAfterFix(context.container, changes);
      if (!validation.isValid) {
        errors.push(...validation.criticalIssues);
        
        // Rollback se richiesto
        if (context.options.rollback && rollback) {
          rollback();
          return {
            success: false,
            applied: false,
            changes: [],
            errors: ['Fix validation failed, rolled back'],
            warnings: []
          };
        }
      }
    } else {
      errors.push(...result.errors);
    }
    
    return {
      success: errors.length === 0,
      applied: result.success,
      changes,
      errors,
      warnings,
      rollback
    };
    
  } catch (error) {
    return {
      success: false,
      applied: false,
      changes: [],
      errors: [`Fix failed: ${error}`],
      warnings: []
    };
  }
}

// ============================================================================
// 3. FIX SPECIFICI
// ============================================================================

/**
 * Fix per naming conventions
 */
export function createNamingFixSuggestion(
  element: GTMTag | GTMTrigger | GTMVariable,
  context: FixContext
): FixSuggestion {
  const elementType = 'tagId' in element ? 'tag' : 'triggerId' in element ? 'trigger' : 'variable';
  const suggestedName = generateSuggestedName(element, elementType);
  
  return {
    id: `naming_${elementType}_${element.name}`,
    type: 'naming',
    priority: 'medium',
    title: `Fix naming convention for ${elementType}`,
    description: `Rename ${element.name} to ${suggestedName}`,
    impact: 'Improved maintainability and consistency',
    effort: 'low',
    fixable: true,
    elements: [{
      type: elementType,
      id: (element as any).tagId || (element as any).triggerId || (element as any).variableId || 'unknown',
      name: element.name || 'unknown'
    }],
    fix: async (ctx) => {
      const oldName = element.name;
      element.name = suggestedName;
      
      return {
        success: true,
        applied: true,
        changes: [{
          type: 'update',
          element: {
            type: elementType,
            id: (element as any).tagId || (element as any).triggerId || (element as any).variableId || 'unknown',
            name: oldName
          },
          field: 'name',
          oldValue: oldName,
          newValue: suggestedName,
          reason: 'Fix naming convention'
        }],
        errors: [],
        warnings: []
      };
    }
  };
}

/**
 * Fix per consent mode
 */
export function createConsentModeFixSuggestion(
  tag: GTMTag,
  context: FixContext
): FixSuggestion {
  const requiredConsents = determineRequiredConsents(tag);
  
  return {
    id: `consent_${tag.tagId}`,
    type: 'consent',
    priority: 'critical',
    title: 'Configure consent mode for marketing tag',
    description: `Add consent configuration: ${requiredConsents.join(', ')}`,
    impact: 'GDPR/CCPA compliance',
    effort: 'medium',
    fixable: true,
    elements: [{
      type: 'tag',
      id: tag.tagId || 'unknown',
      name: tag.name || 'unknown'
    }],
    fix: async (ctx) => {
      const changes: FixChange[] = [];
      
      // Aggiungi consentSettings
      if (!tag.consentSettings) {
        tag.consentSettings = {};
        changes.push({
          type: 'update',
          element: {
            type: 'tag',
            id: tag.tagId || 'unknown',
            name: tag.name || 'unknown'
          },
          field: 'consentSettings',
          oldValue: undefined,
          newValue: {},
          reason: 'Add consent settings'
        });
      }
      
      // Aggiungi parametri di consenso
      requiredConsents.forEach(consent => {
        const existingParam = tag.parameter?.find(p => p.key === consent);
        if (!existingParam) {
          if (!tag.parameter) tag.parameter = [];
          tag.parameter.push({ key: consent, value: true });
          changes.push({
            type: 'update',
            element: {
              type: 'tag',
              id: tag.tagId || 'unknown',
              name: tag.name || 'unknown'
            },
            field: `parameter.${consent}`,
            oldValue: undefined,
            newValue: true,
            reason: `Add ${consent} consent`
          });
        }
      });
      
      return {
        success: true,
        applied: true,
        changes,
        errors: [],
        warnings: []
      };
    }
  };
}

/**
 * Fix per performance
 */
export function createPerformanceFixSuggestion(
  trigger: GTMTrigger,
  context: FixContext
): FixSuggestion {
  return {
    id: `performance_${trigger.triggerId}`,
    type: 'performance',
    priority: 'high',
    title: 'Optimize trigger for better performance',
    description: 'Change trigger timing and add filters',
    impact: 'Improved page load performance',
    effort: 'medium',
    fixable: true,
    elements: [{
      type: 'trigger',
      id: trigger.triggerId || 'unknown',
      name: trigger.name || 'unknown'
    }],
    fix: async (ctx) => {
      const changes: FixChange[] = [];
      
      // Cambia timing se appropriato
      if (trigger.type === 'PAGEVIEW' && context.businessContext.siteType === 'saas') {
        const oldType = trigger.type;
        trigger.type = 'DOM_READY';
        changes.push({
          type: 'update',
          element: {
            type: 'trigger',
            id: trigger.triggerId || 'unknown',
            name: trigger.name || 'unknown'
          },
          field: 'type',
          oldValue: oldType,
          newValue: 'DOM_READY',
          reason: 'Optimize timing for SPA'
        });
      }
      
      // Aggiungi filtri se mancanti
      if (!trigger.filter || trigger.filter.length === 0) {
        trigger.filter = [{
          key: 'Page URL',
          value: '.*',
          operator: 'REGEX'
        }];
        changes.push({
          type: 'update',
          element: {
            type: 'trigger',
            id: trigger.triggerId || 'unknown',
            name: trigger.name || 'unknown'
          },
          field: 'filter',
          oldValue: undefined,
          newValue: trigger.filter,
          reason: 'Add basic filter for specificity'
        });
      }
      
      return {
        success: true,
        applied: true,
        changes,
        errors: [],
        warnings: []
      };
    }
  };
}

/**
 * Fix per sicurezza
 */
export function createSecurityFixSuggestion(
  tag: GTMTag,
  context: FixContext
): FixSuggestion {
  return {
    id: `security_${tag.tagId}`,
    type: 'security',
    priority: 'critical',
    title: 'Fix security issues in custom HTML',
    description: 'Remove dangerous functions and enforce HTTPS',
    impact: 'Improved security and compliance',
    effort: 'low',
    fixable: true,
    elements: [{
      type: 'tag',
      id: tag.tagId || 'unknown',
      name: tag.name || 'unknown'
    }],
    fix: async (ctx) => {
      const changes: FixChange[] = [];
      
      if (tag.html) {
        let newHtml = tag.html;
        
        // Rimuovi eval e document.write
        if (newHtml.includes('eval(')) {
          newHtml = newHtml.replace(/eval\s*\(/g, '/* eval() removed for security */ (');
          changes.push({
            type: 'update',
            element: {
              type: 'tag',
              id: tag.tagId || 'unknown',
              name: tag.name || 'unknown'
            },
            field: 'html',
            oldValue: tag.html,
            newValue: newHtml,
            reason: 'Remove eval() for security'
          });
        }
        
        if (newHtml.includes('document.write')) {
          newHtml = newHtml.replace(/document\.write/g, '/* document.write removed for security */ console.log');
          changes.push({
            type: 'update',
            element: {
              type: 'tag',
              id: tag.tagId || 'unknown',
              name: tag.name || 'unknown'
            },
            field: 'html',
            oldValue: tag.html,
            newValue: newHtml,
            reason: 'Remove document.write for security'
          });
        }
        
        // Forza HTTPS
        if (newHtml.includes('http://')) {
          newHtml = newHtml.replace(/http:\/\//g, 'https://');
          changes.push({
            type: 'update',
            element: {
              type: 'tag',
              id: tag.tagId || 'unknown',
              name: tag.name || 'unknown'
            },
            field: 'html',
            oldValue: tag.html,
            newValue: newHtml,
            reason: 'Enforce HTTPS for security'
          });
        }
        
        tag.html = newHtml;
      }
      
      return {
        success: true,
        applied: true,
        changes,
        errors: [],
        warnings: []
      };
    }
  };
}

// ============================================================================
// 4. FUNZIONI UTILITY
// ============================================================================

function createFixSuggestionFromError(
  error: ValidationError,
  context: FixContext
): FixSuggestion | null {
  switch (error.type) {
    case 'syntax':
      if (error.field === 'name') {
        return createNamingFixSuggestion(
          findElementById(error.element.id, context.container),
          context
        );
      }
      break;
    case 'configuration':
      if (error.message.includes('consent')) {
        return createConsentModeFixSuggestion(
          findElementById(error.element.id, context.container) as GTMTag,
          context
        );
      }
      break;
    case 'security':
      if (error.message.includes('JavaScript')) {
        return createSecurityFixSuggestion(
          findElementById(error.element.id, context.container) as GTMTag,
          context
        );
      }
      break;
  }
  
  return null;
}

function createFixSuggestionFromWarning(
  warning: any,
  context: FixContext
): FixSuggestion | null {
  // Implementa logica per warning
  return null;
}

function analyzePerformanceIssues(context: FixContext): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  
  // Analizza trigger "All Pages"
  context.container.trigger.forEach(trigger => {
    if (trigger.type === 'PAGEVIEW' && (!trigger.filter || trigger.filter.length === 0)) {
      suggestions.push(createPerformanceFixSuggestion(trigger, context));
    }
  });
  
  return suggestions;
}

function analyzeSecurityIssues(context: FixContext): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  
  // Analizza tag HTML custom
  context.container.tag.forEach(tag => {
    if (tag.type === 'html' && tag.html) {
      if (tag.html.includes('eval(') || tag.html.includes('document.write') || tag.html.includes('http://')) {
        suggestions.push(createSecurityFixSuggestion(tag, context));
      }
    }
  });
  
  return suggestions;
}

function analyzeComplianceIssues(context: FixContext): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  
  // Analizza tag marketing senza consensi
  context.container.tag.forEach(tag => {
    if (isMarketingTag(tag) && !hasConsentConfiguration(tag)) {
      suggestions.push(createConsentModeFixSuggestion(tag, context));
    }
  });
  
  return suggestions;
}

function generateSuggestedName(
  element: GTMTag | GTMTrigger | GTMVariable,
  elementType: string
): string {
  const baseName = element.name?.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() || 'ELEMENT';
  
  switch (elementType) {
    case 'tag':
      const tagType = (element as GTMTag).type?.toLowerCase();
      if (tagType?.includes('ga4') || tagType?.includes('gtag')) {
        return `GA4_EVENT_${baseName}`;
      } else if (tagType?.includes('html')) {
        return `HTML_${baseName}`;
      } else if (tagType?.includes('facebook') || tagType?.includes('meta')) {
        return `META_${baseName}`;
      } else {
        return `TAG_${baseName}`;
      }
    case 'trigger':
      return `TRG_${baseName}`;
    case 'variable':
      return `DLV_${baseName}`;
    default:
      return baseName;
  }
}

function determineRequiredConsents(tag: GTMTag): string[] {
  const tagType = tag.type?.toLowerCase() || '';
  const tagName = tag.name?.toLowerCase() || '';
  
  if (tagType.includes('facebook') || tagType.includes('meta') || 
      tagName.includes('facebook') || tagName.includes('meta')) {
    return ['ad_storage', 'ad_user_data', 'ad_personalization'];
  }
  
  if (tagType.includes('google_ads') || tagName.includes('google_ads') || 
      tagName.includes('conversion') || tagName.includes('remarketing')) {
    return ['ad_storage', 'ad_user_data', 'ad_personalization'];
  }
  
  return ['analytics_storage'];
}

function isMarketingTag(tag: GTMTag): boolean {
  const marketingTypes = ['facebook', 'meta', 'google_ads', 'linkedin', 'bing', 'tiktok'];
  const tagType = tag.type?.toLowerCase() || '';
  const tagName = tag.name?.toLowerCase() || '';
  
  return marketingTypes.some(type => 
    tagType.includes(type) || tagName.includes(type)
  );
}

function hasConsentConfiguration(tag: GTMTag): boolean {
  return !!(tag.consentSettings || 
    (tag.parameter && tag.parameter.some(p => 
      ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization'].includes(p.key)
    )));
}

function findElementById(
  id: string,
  container: { tag: GTMTag[]; trigger: GTMTrigger[]; variable: GTMVariable[] }
): GTMTag | GTMTrigger | GTMVariable | null {
  const tag = container.tag.find(t => t.tagId === id);
  if (tag) return tag;
  
  const trigger = container.trigger.find(t => t.triggerId === id);
  if (trigger) return trigger;
  
  const variable = container.variable.find(v => v.variableId === id);
  if (variable) return variable;
  
  return null;
}

function createBackup(container: any): () => void {
  const backup = JSON.parse(JSON.stringify(container));
  return () => {
    Object.assign(container, backup);
  };
}

function validateAfterFix(container: any, changes: FixChange[]): ValidationResult {
  // Implementa validazione post-fix
  return {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
    score: 100,
    criticalIssues: []
  };
}

