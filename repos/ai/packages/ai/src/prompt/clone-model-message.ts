import type { ModelMessage } from '@ai-sdk/provider-utils';

/**
 * Clone model messages while preserving URL instances. Node's structuredClone
 * currently rejects URL objects, which are valid file/image prompt payloads.
 */
export function cloneModelMessages<T extends ModelMessage>(
  messages: Array<T>,
): Array<T> {
  return messages.map(message => cloneValue(message)) as Array<T>;
}

function cloneValue<T>(value: T): T {
  if (value instanceof URL) {
    return new URL(value.href) as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as T;
  }

  if (value instanceof Uint8Array) {
    return new Uint8Array(value) as T;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0) as T;
  }

  if (value instanceof Date) {
    return new Date(value) as T;
  }

  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, value]) => [key, cloneValue(value)]),
    ) as T;
  }

  return value;
}
