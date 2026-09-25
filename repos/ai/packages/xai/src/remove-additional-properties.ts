/**
 * Recursively removes `additionalProperties: false` entries from a JSON
 * schema.
 * Used to sanitize tool input schemas before sending them to the xAI API.
 * https://docs.x.ai/developers/model-capabilities/text/structured-outputs#supported-types
 */
export function removeAdditionalPropertiesFalse(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeAdditionalPropertiesFalse);
  }

  if (value == null || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, propertyValue] of Object.entries(value)) {
    if (key === 'additionalProperties' && propertyValue === false) {
      continue;
    }
    result[key] = removeAdditionalPropertiesFalse(propertyValue);
  }
  return result;
}
