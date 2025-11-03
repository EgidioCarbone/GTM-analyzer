import React, { useMemo } from 'react';
import { Card } from '../ui/card';
import { SSDModule, ModuleConfigField, ModuleConfigFieldType } from '../../modules/types';
import { ModuleConfig } from '../../types/ssd';
import { ensureValueArray, isModuleFieldEmpty } from '../../modules/utils';

type ModuleConfigFormProps = {
  module: SSDModule;
  values: ModuleConfig;
  onChange: (nextValues: ModuleConfig) => void;
};

const noop: ModuleConfig = {};

function renderInput(field: ModuleConfigField, value: unknown, onValueChange: (next: unknown) => void) {
  const common = {
    id: `module-config-${field.id}`,
    name: field.id,
    className: 'w-full rounded-md border border-gray-200 focus:border-blue-500 focus:ring-blue-200 px-3 py-2 text-sm bg-white shadow-sm',
  };

  switch (field.type as ModuleConfigFieldType) {
    case 'select':
      return (
        <select
          {...common}
          value={value == null ? '' : String(value)}
          onChange={event => onValueChange(event.target.value)}
        >
          <option value="" disabled>
            Seleziona un valore
          </option>
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case 'multi-select': {
      const selected = ensureValueArray(value);
      return (
        <select
          {...common}
          multiple
          value={selected}
          onChange={event => {
            const options = Array.from(event.target.selectedOptions).map(option => option.value);
            onValueChange(options);
          }}
        >
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    case 'textarea':
      return (
        <textarea
          {...common}
          rows={4}
          value={value == null ? '' : String(value)}
          onChange={event => onValueChange(event.target.value)}
        />
      );
    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <input
            id={`module-config-${field.id}`}
            name={field.id}
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={Boolean(value ?? field.defaultValue ?? false)}
            onChange={event => onValueChange(event.target.checked)}
          />
          <label htmlFor={`module-config-${field.id}`} className="text-sm text-gray-700">
            {field.label}
          </label>
        </div>
      );
    case 'text':
    default:
      return (
        <input
          {...common}
          type="text"
          value={value == null ? '' : String(value)}
          placeholder={field.placeholder}
          onChange={event => onValueChange(event.target.value)}
        />
      );
  }
}

export default function ModuleConfigForm({ module, values, onChange }: ModuleConfigFormProps) {
  if (!module.configFields || module.configFields.length === 0) {
    return null;
  }

  const effectiveValues = values ?? noop;

  const requiredErrors = useMemo(() => {
    const missing: string[] = [];
    for (const field of module.configFields) {
      if (field.required) {
        const fieldValue = effectiveValues[field.id];
        if (isModuleFieldEmpty(field, fieldValue)) {
          missing.push(field.label);
        }
      }
    }
    return missing;
  }, [module.configFields, effectiveValues]);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    onChange({
      ...effectiveValues,
      [fieldId]: value,
    });
  };

  return (
    <Card className="mb-6 p-6 border border-blue-100 bg-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Configura Modulo</h2>
          <p className="text-sm text-gray-600 mt-1">
            Personalizza il comportamento dei test per <strong>{module.meta.title}</strong>.
            Le modifiche verranno applicate all&apos;analisi e alla fase di esecuzione.
          </p>
        </div>
        {requiredErrors.length > 0 ? (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Campi obbligatori mancanti: {requiredErrors.join(', ')}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {module.configFields.map(field => (
          <div key={field.id} className="flex flex-col gap-2">
            {field.type !== 'checkbox' && (
              <label htmlFor={`module-config-${field.id}`} className="text-sm font-medium text-gray-800">
                {field.label}
                {field.required ? <span className="text-red-500">*</span> : null}
              </label>
            )}

            {renderInput(field, effectiveValues[field.id] ?? field.defaultValue, value =>
              handleFieldChange(field.id, value)
            )}

            {field.helperText && field.type !== 'checkbox' ? (
              <p className="text-xs text-gray-500">{field.helperText}</p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
