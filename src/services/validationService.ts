/**
 * Advanced Validation Service
 * 
 * Sistema di validazione e testing per le modifiche GTM
 * Risolve le lacune della mancanza di validazione e testing
 */

import { GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";

// ============================================================================
// 1. TIPI E INTERFACCE
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  score: number;
  criticalIssues: string[];
}

export interface ValidationError {
  type: 'syntax' | 'logic' | 'dependency' | 'configuration' | 'performance';
  severity: 'critical' | 'major' | 'minor';
  message: string;
  element: {
    type: 'tag' | 'trigger' | 'variable';
    id: string;
    name: string;
  };
  field?: string;
  value?: any;
  suggestion: string;
  fixable: boolean;
}

export interface ValidationWarning {
  type: 'performance' | 'best_practice' | 'deprecation' | 'security';
  message: string;
  element: {
    type: 'tag' | 'trigger' | 'variable';
    id: string;
    name: string;
  };
  impact: string;
  suggestion: string;
}

export interface ValidationSuggestion {
  type: 'optimization' | 'security' | 'performance' | 'maintenance';
  message: string;
  element: {
    type: 'tag' | 'trigger' | 'variable';
    id: string;
    name: string;
  };
  benefit: string;
  effort: 'low' | 'medium' | 'high';
}

export interface ValidationContext {
  container: {
    tag: GTMTag[];
    trigger: GTMTrigger[];
    variable: GTMVariable[];
  };
  changes: Array<{
    type: 'create' | 'update' | 'delete';
    element: GTMTag | GTMTrigger | GTMVariable;
    original?: GTMTag | GTMTrigger | GTMVariable;
  }>;
  environment: 'development' | 'staging' | 'production';
  businessContext: {
    siteType: string;
    performanceRequirements: any;
    complianceRequirements: string[];
  };
}

// ============================================================================
// 2. VALIDAZIONE SINTASSI GTM
// ============================================================================

/**
 * Valida la sintassi di un elemento GTM
 */
export function validateGTMSyntax(element: GTMTag | GTMTrigger | GTMVariable): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];
  
  // Validazione base
  validateBasicSyntax(element, errors, warnings, suggestions);
  
  // Validazione specifica per tipo
  if ('tagId' in element) {
    validateTagSyntax(element as GTMTag, errors, warnings, suggestions);
  } else if ('triggerId' in element) {
    validateTriggerSyntax(element as GTMTrigger, errors, warnings, suggestions);
  } else if ('variableId' in element) {
    validateVariableSyntax(element as GTMVariable, errors, warnings, suggestions);
  }
  
  // Calcola score
  const criticalErrors = errors.filter(e => e.severity === 'critical').length;
  const majorErrors = errors.filter(e => e.severity === 'major').length;
  const minorErrors = errors.filter(e => e.severity === 'minor').length;
  
  const score = Math.max(0, 100 - (criticalErrors * 40 + majorErrors * 20 + minorErrors * 10));
  
  return {
    isValid: criticalErrors === 0,
    errors,
    warnings,
    suggestions,
    score,
    criticalIssues: errors.filter(e => e.severity === 'critical').map(e => e.message)
  };
}

/**
 * Valida la sintassi base di un elemento
 */
function validateBasicSyntax(
  element: GTMTag | GTMTrigger | GTMVariable,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  // Controlla nome
  if (!element.name || element.name.trim() === '') {
    errors.push({
      type: 'syntax',
      severity: 'critical',
      message: 'Element name is required',
      element: {
        type: 'tagId' in element ? 'tag' : 'triggerId' in element ? 'trigger' : 'variable',
        id: (element as any).tagId || (element as any).triggerId || (element as any).variableId || 'unknown',
        name: element.name || 'unknown'
      },
      suggestion: 'Provide a descriptive name for the element',
      fixable: true
    });
  }
  
  // Controlla naming convention
  const elementType = 'tagId' in element ? 'tag' : 'triggerId' in element ? 'trigger' : 'variable';
  const namingPattern = getNamingPattern(elementType);
  
  if (element.name && !namingPattern.test(element.name)) {
    warnings.push({
      type: 'best_practice',
      message: `Element name does not follow ${elementType} naming convention`,
      element: {
        type: elementType,
        id: (element as any).tagId || (element as any).triggerId || (element as any).variableId || 'unknown',
        name: element.name
      },
      impact: 'Maintenance difficulty',
      suggestion: `Use format: ${getNamingExample(elementType)}`
    });
  }
  
  // Controlla caratteri speciali
  if (element.name && /[^a-zA-Z0-9_-]/.test(element.name)) {
    warnings.push({
      type: 'best_practice',
      message: 'Element name contains special characters',
      element: {
        type: elementType,
        id: (element as any).tagId || (element as any).triggerId || (element as any).variableId || 'unknown',
        name: element.name
      },
      impact: 'Potential compatibility issues',
      suggestion: 'Use only alphanumeric characters, underscores, and hyphens'
    });
  }
}

/**
 * Valida la sintassi di un tag
 */
function validateTagSyntax(
  tag: GTMTag,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  // Controlla tipo di tag
  if (!tag.type || tag.type.trim() === '') {
    errors.push({
      type: 'syntax',
      severity: 'critical',
      message: 'Tag type is required',
      element: {
        type: 'tag',
        id: tag.tagId || 'unknown',
        name: tag.name || 'unknown'
      },
      suggestion: 'Specify a valid tag type',
      fixable: true
    });
  }
  
  // Controlla firing triggers
  if (!tag.firingTriggerId || (Array.isArray(tag.firingTriggerId) && tag.firingTriggerId.length === 0)) {
    errors.push({
      type: 'syntax',
      severity: 'critical',
      message: 'Tag must have at least one firing trigger',
      element: {
        type: 'tag',
        id: tag.tagId || 'unknown',
        name: tag.name || 'unknown'
      },
      suggestion: 'Add firing triggers to the tag',
      fixable: true
    });
  }
  
  // Controlla parametri
  if (tag.parameter) {
    tag.parameter.forEach((param, index) => {
      if (!param.key || param.key.trim() === '') {
        errors.push({
          type: 'syntax',
          severity: 'major',
          message: `Parameter ${index + 1} has empty key`,
          element: {
            type: 'tag',
            id: tag.tagId || 'unknown',
            name: tag.name || 'unknown'
          },
          field: `parameter[${index}].key`,
          suggestion: 'Provide a valid parameter key',
          fixable: true
        });
      }
    });
  }
  
  // Controlla HTML custom
  if (tag.html) {
    validateCustomHTML(tag.html, tag, errors, warnings, suggestions);
  }
}

/**
 * Valida la sintassi di un trigger
 */
function validateTriggerSyntax(
  trigger: GTMTrigger,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  // Controlla tipo di trigger
  if (!trigger.type || trigger.type.trim() === '') {
    errors.push({
      type: 'syntax',
      severity: 'critical',
      message: 'Trigger type is required',
      element: {
        type: 'trigger',
        id: trigger.triggerId || 'unknown',
        name: trigger.name || 'unknown'
      },
      suggestion: 'Specify a valid trigger type',
      fixable: true
    });
  }
  
  // Controlla filtri
  if (trigger.filter) {
    trigger.filter.forEach((filter, index) => {
      if (!filter.key || filter.key.trim() === '') {
        errors.push({
          type: 'syntax',
          severity: 'major',
          message: `Filter ${index + 1} has empty key`,
          element: {
            type: 'trigger',
            id: trigger.triggerId || 'unknown',
            name: trigger.name || 'unknown'
          },
          field: `filter[${index}].key`,
          suggestion: 'Provide a valid filter key',
          fixable: true
        });
      }
    });
  }
}

/**
 * Valida la sintassi di una variabile
 */
function validateVariableSyntax(
  variable: GTMVariable,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  // Controlla tipo di variabile
  if (!variable.type || variable.type.trim() === '') {
    errors.push({
      type: 'syntax',
      severity: 'critical',
      message: 'Variable type is required',
      element: {
        type: 'variable',
        id: variable.variableId || 'unknown',
        name: variable.name || 'unknown'
      },
      suggestion: 'Specify a valid variable type',
      fixable: true
    });
  }
  
  // Controlla parametri
  if (variable.parameter) {
    variable.parameter.forEach((param, index) => {
      if (!param.key || param.key.trim() === '') {
        errors.push({
          type: 'syntax',
          severity: 'major',
          message: `Parameter ${index + 1} has empty key`,
          element: {
            type: 'variable',
            id: variable.variableId || 'unknown',
            name: variable.name || 'unknown'
          },
          field: `parameter[${index}].key`,
          suggestion: 'Provide a valid parameter key',
          fixable: true
        });
      }
    });
  }
}

// ============================================================================
// 3. VALIDAZIONE LOGICA E DIPENDENZE
// ============================================================================

/**
 * Valida la logica e le dipendenze di un container
 */
export function validateContainerLogic(context: ValidationContext): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];
  
  // Validazione dipendenze
  validateDependencies(context, errors, warnings, suggestions);
  
  // Validazione logica
  validateLogic(context, errors, warnings, suggestions);
  
  // Validazione performance
  validatePerformance(context, errors, warnings, suggestions);
  
  // Validazione compliance
  validateCompliance(context, errors, warnings, suggestions);
  
  // Calcola score
  const criticalErrors = errors.filter(e => e.severity === 'critical').length;
  const majorErrors = errors.filter(e => e.severity === 'major').length;
  const minorErrors = errors.filter(e => e.severity === 'minor').length;
  
  const score = Math.max(0, 100 - (criticalErrors * 40 + majorErrors * 20 + minorErrors * 10));
  
  return {
    isValid: criticalErrors === 0,
    errors,
    warnings,
    suggestions,
    score,
    criticalIssues: errors.filter(e => e.severity === 'critical').map(e => e.message)
  };
}

/**
 * Valida le dipendenze tra elementi
 */
function validateDependencies(
  context: ValidationContext,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  const { container } = context;
  
  // Controlla trigger orfani
  container.trigger.forEach(trigger => {
    const isUsed = container.tag.some(tag => 
      Array.isArray(tag.firingTriggerId) 
        ? tag.firingTriggerId.includes(trigger.triggerId || '')
        : tag.firingTriggerId === trigger.triggerId
    );
    
    if (!isUsed) {
      warnings.push({
        type: 'best_practice',
        message: 'Trigger is not used by any tags',
        element: {
          type: 'trigger',
          id: trigger.triggerId || 'unknown',
          name: trigger.name || 'unknown'
        },
        impact: 'Container bloat',
        suggestion: 'Remove unused trigger or assign to tags'
      });
    }
  });
  
  // Controlla variabili orfane
  container.variable.forEach(variable => {
    const isUsed = [...container.tag, ...container.trigger].some(element => 
      JSON.stringify(element).includes(variable.name || '')
    );
    
    if (!isUsed) {
      warnings.push({
        type: 'best_practice',
        message: 'Variable is not used by any elements',
        element: {
          type: 'variable',
          id: variable.variableId || 'unknown',
          name: variable.name || 'unknown'
        },
        impact: 'Container bloat',
        suggestion: 'Remove unused variable or use in tags/triggers'
      });
    }
  });
  
  // Controlla tag senza trigger
  container.tag.forEach(tag => {
    if (!tag.firingTriggerId || (Array.isArray(tag.firingTriggerId) && tag.firingTriggerId.length === 0)) {
      errors.push({
        type: 'dependency',
        severity: 'critical',
        message: 'Tag has no firing triggers',
        element: {
          type: 'tag',
          id: tag.tagId || 'unknown',
          name: tag.name || 'unknown'
        },
        suggestion: 'Add firing triggers to the tag',
        fixable: true
      });
    }
  });
}

/**
 * Valida la logica del container
 */
function validateLogic(
  context: ValidationContext,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  const { container } = context;
  
  // Controlla duplicati
  const tagNames = container.tag.map(t => t.name).filter(Boolean);
  const duplicateTags = tagNames.filter((name, index) => tagNames.indexOf(name) !== index);
  
  duplicateTags.forEach(name => {
    errors.push({
      type: 'logic',
      severity: 'critical',
      message: `Duplicate tag name: ${name}`,
      element: {
        type: 'tag',
        id: 'unknown',
        name
      },
      suggestion: 'Use unique names for all tags',
      fixable: true
    });
  });
  
  // Controlla trigger duplicati
  const triggerNames = container.trigger.map(t => t.name).filter(Boolean);
  const duplicateTriggers = triggerNames.filter((name, index) => triggerNames.indexOf(name) !== index);
  
  duplicateTriggers.forEach(name => {
    errors.push({
      type: 'logic',
      severity: 'critical',
      message: `Duplicate trigger name: ${name}`,
      element: {
        type: 'trigger',
        id: 'unknown',
        name
      },
      suggestion: 'Use unique names for all triggers',
      fixable: true
    });
  });
  
  // Controlla variabili duplicate
  const variableNames = container.variable.map(v => v.name).filter(Boolean);
  const duplicateVariables = variableNames.filter((name, index) => variableNames.indexOf(name) !== index);
  
  duplicateVariables.forEach(name => {
    errors.push({
      type: 'logic',
      severity: 'critical',
      message: `Duplicate variable name: ${name}`,
      element: {
        type: 'variable',
        id: 'unknown',
        name
      },
      suggestion: 'Use unique names for all variables',
      fixable: true
    });
  });
}

/**
 * Valida le performance del container
 */
function validatePerformance(
  context: ValidationContext,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  const { container, businessContext } = context;
  
  // Controlla numero di elementi
  const totalElements = container.tag.length + container.trigger.length + container.variable.length;
  
  if (totalElements > 1000) {
    warnings.push({
      type: 'performance',
      message: `Container has ${totalElements} elements (consider optimization)`,
      element: {
        type: 'tag',
        id: 'container',
        name: 'Container'
      },
      impact: 'Performance degradation',
      suggestion: 'Consider removing unused elements or splitting the container'
    });
  }
  
  // Controlla tag HTML custom
  const htmlTags = container.tag.filter(tag => tag.type === 'html');
  if (htmlTags.length > container.tag.length * 0.3) {
    warnings.push({
      type: 'performance',
      message: `${htmlTags.length} custom HTML tags (${Math.round(htmlTags.length / container.tag.length * 100)}% of total)`,
      element: {
        type: 'tag',
        id: 'container',
        name: 'Container'
      },
      impact: 'Performance and security risks',
      suggestion: 'Consider using built-in tag types when possible'
    });
  }
  
  // Controlla trigger "All Pages"
  const allPagesTriggers = container.trigger.filter(trigger => 
    trigger.type === 'PAGEVIEW' && (!trigger.filter || trigger.filter.length === 0)
  );
  
  if (allPagesTriggers.length > 5) {
    warnings.push({
      type: 'performance',
      message: `${allPagesTriggers.length} "All Pages" triggers detected`,
      element: {
        type: 'trigger',
        id: 'container',
        name: 'Container'
      },
      impact: 'Performance degradation',
      suggestion: 'Use more specific triggers to improve performance'
    });
  }
}

/**
 * Valida la compliance
 */
function validateCompliance(
  context: ValidationContext,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  const { container, businessContext } = context;
  
  // Controlla consent mode per tag marketing
  const marketingTags = container.tag.filter(tag => 
    tag.type?.includes('facebook') || 
    tag.type?.includes('google_ads') || 
    tag.type?.includes('linkedin') ||
    tag.name?.toLowerCase().includes('marketing')
  );
  
  marketingTags.forEach(tag => {
    const hasConsentConfig = tag.consentSettings || 
      (tag.parameter && tag.parameter.some(p => 
        ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization'].includes(p.key)
      ));
    
    if (!hasConsentConfig) {
      errors.push({
        type: 'configuration',
        severity: 'critical',
        message: 'Marketing tag without consent configuration',
        element: {
          type: 'tag',
          id: tag.tagId || 'unknown',
          name: tag.name || 'unknown'
        },
        suggestion: 'Configure consent mode for marketing tags',
        fixable: true
      });
    }
  });
}

// ============================================================================
// 4. VALIDAZIONE HTML CUSTOM
// ============================================================================

/**
 * Valida il codice HTML custom
 */
function validateCustomHTML(
  html: string,
  tag: GTMTag,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  // Controlla sintassi JavaScript
  const jsPattern = /<script[^>]*>(.*?)<\/script>/gis;
  let match;
  
  while ((match = jsPattern.exec(html)) !== null) {
    const jsCode = match[1];
    validateJavaScript(jsCode, tag, errors, warnings, suggestions);
  }
  
  // Controlla URL non sicure
  const httpPattern = /http:\/\//g;
  if (httpPattern.test(html)) {
    warnings.push({
      type: 'security',
      message: 'HTTP URLs detected in custom HTML',
      element: {
        type: 'tag',
        id: tag.tagId || 'unknown',
        name: tag.name || 'unknown'
      },
      impact: 'Security risk',
      suggestion: 'Use HTTPS URLs for security'
    });
  }
  
  // Controlla eval e document.write
  if (html.includes('eval(') || html.includes('document.write')) {
    errors.push({
      type: 'security',
      severity: 'critical',
      message: 'Dangerous JavaScript functions detected',
      element: {
        type: 'tag',
        id: tag.tagId || 'unknown',
        name: tag.name || 'unknown'
      },
      suggestion: 'Remove eval() and document.write for security',
      fixable: true
    });
  }
}

/**
 * Valida il codice JavaScript
 */
function validateJavaScript(
  jsCode: string,
  tag: GTMTag,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  suggestions: ValidationSuggestion[]
): void {
  // Controlla try/catch
  if (!jsCode.includes('try') && !jsCode.includes('catch')) {
    warnings.push({
      type: 'best_practice',
      message: 'JavaScript code without error handling',
      element: {
        type: 'tag',
        id: tag.tagId || 'unknown',
        name: tag.name || 'unknown'
      },
      impact: 'Potential runtime errors',
      suggestion: 'Add try/catch blocks for error handling'
    });
  }
  
  // Controlla accessi a proprietà annidate
  const nestedAccessPattern = /\w+\.\w+\.\w+/;
  if (nestedAccessPattern.test(jsCode)) {
    warnings.push({
      type: 'best_practice',
      message: 'Nested property access without null checks',
      element: {
        type: 'tag',
        id: tag.tagId || 'unknown',
        name: tag.name || 'unknown'
      },
      impact: 'Potential runtime errors',
      suggestion: 'Add null checks for nested property access'
    });
  }
}

// ============================================================================
// 5. FUNZIONI UTILITY
// ============================================================================

function getNamingPattern(elementType: string): RegExp {
  switch (elementType) {
    case 'tag':
      return /^(UA|GA4_EVENT|GTAG|HTML)_[A-Z0-9_]+$/;
    case 'trigger':
      return /^TRG_[A-Z0-9_]+$/;
    case 'variable':
      return /^(DLV|JS|CONST|URL|CSS|RANDOM)_[A-Z0-9_]+$/;
    default:
      return /^[A-Z0-9_]+$/;
  }
}

function getNamingExample(elementType: string): string {
  switch (elementType) {
    case 'tag':
      return 'GA4_EVENT_PURCHASE';
    case 'trigger':
      return 'TRG_PAGE_VIEW';
    case 'variable':
      return 'DLV_PRODUCT_ID';
    default:
      return 'ELEMENT_NAME';
  }
}

