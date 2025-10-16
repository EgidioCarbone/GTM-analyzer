/**
 * Utility functions to check OpenAI model capabilities
 */

/**
 * Check if a model supports custom temperature parameter
 * Some models like o1 and o1-mini don't support temperature customization
 */
export function modelSupportsCustomTemperature(model: string): boolean {
  const modelsWithoutTemperature = [
    'o1',
    'o1-mini',
    'o1-preview',
    'o1-pro',
  ];
  
  // Check if the model starts with any of the models that don't support temperature
  return !modelsWithoutTemperature.some(unsupportedModel => 
    model.toLowerCase().startsWith(unsupportedModel)
  );
}







