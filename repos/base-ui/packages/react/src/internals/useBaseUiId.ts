'use client';
import { useId } from '@base-ui/utils/useId';

/**
 * Wraps `useId` and prefixes generated `id`s with `base-ui-`
 * @param {string | undefined} idOverride overrides the generated id when provided
 * @returns {string | undefined}
 */
export function useBaseUiId(idOverride?: string): string | undefined {
  return useId(idOverride, 'base-ui');
}
