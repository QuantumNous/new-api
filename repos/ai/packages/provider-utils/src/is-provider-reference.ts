import type { SharedV4ProviderReference } from '@ai-sdk/provider';
import { isBuffer } from './is-buffer';

/**
 * Checks whether a value is a provider reference (a mapping of provider names
 * to provider-specific identifiers) as opposed to raw bytes, a URL, or a
 * tagged `{ type: ... }` object.
 */
export function isProviderReference(
  data: unknown,
): data is SharedV4ProviderReference {
  return (
    typeof data === 'object' &&
    data !== null &&
    !(data instanceof Uint8Array) &&
    !(data instanceof URL) &&
    !(data instanceof ArrayBuffer) &&
    !isBuffer(data) &&
    !('type' in data)
  );
}
