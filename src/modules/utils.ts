import type { ModuleConfigField } from './types';

export function ensureValueArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.split(',').map(item => item.trim());
  }
  return [];
}

export function isModuleFieldEmpty(field: ModuleConfigField, value: unknown): boolean {
  if (field.type === 'checkbox') {
    // Consider checkbox "empty" only if required and false
    if (field.required) {
      return value !== true;
    }
    return false;
  }

  if (field.type === 'multi-select') {
    return ensureValueArray(value).length === 0;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  return value == null;
}

