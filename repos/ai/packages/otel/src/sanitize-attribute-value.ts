import type { Attributes, AttributeValue } from '@opentelemetry/api';

function isPrimitiveAttributeValue(
  value: unknown,
): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

export function sanitizeAttributeValue(
  value: AttributeValue,
): AttributeValue | undefined {
  if (!Array.isArray(value)) {
    return value;
  }

  const primitiveTypes = new Set(
    value.filter(isPrimitiveAttributeValue).map(item => typeof item),
  );

  if (primitiveTypes.size !== 1) {
    return undefined;
  }

  const [primitiveType] = primitiveTypes;

  if (primitiveType === 'string') {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (primitiveType === 'number') {
    return value.filter((item): item is number => typeof item === 'number');
  }

  return value.filter((item): item is boolean => typeof item === 'boolean');
}

export function sanitizeAttributes(
  attributes: Attributes | undefined,
): Attributes {
  const result: Attributes = {};

  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (value == null) continue;
    const sanitized = sanitizeAttributeValue(value);
    if (sanitized != null) result[key] = sanitized;
  }

  return result;
}
