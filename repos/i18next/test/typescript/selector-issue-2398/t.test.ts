import { describe, it, expectTypeOf } from 'vitest';
import type { TFunction } from 'i18next';

// Reproduces https://github.com/i18next/i18next/issues/2398
//
// When a JSON array has objects with different key sets (one with a context
// variant like `transKey1_withContext`, one without), TypeScript merges all
// keys into a single element type. The selector overload with `context` must
// still preserve `transKey1` and `transKey2` on every element after filtering.

describe('issue #2398 - returnObjects + context + array with selector', () => {
  const t = (() => []) as unknown as TFunction;

  it('should return full object shape for all array elements, not a union of partial types', () => {
    const result = t(($) => $.transWithArray, {
      returnObjects: true,
      context: 'withContext',
    });
    expectTypeOf(result[0]).toHaveProperty('transKey1');
    expectTypeOf(result[0]).toHaveProperty('transKey2');
    expectTypeOf(result[0].transKey1).toEqualTypeOf<string>();
    expectTypeOf(result[0].transKey2).toEqualTypeOf<string>();
  });

  it('should also work when context and plurals are combined on array elements', () => {
    const result = t(($) => $.transWithArrayAndPlurals, {
      returnObjects: true,
      context: 'withContext',
      count: 5,
    });
    expectTypeOf(result[0]).toHaveProperty('transKey1');
    expectTypeOf(result[0]).toHaveProperty('transKey2');
    expectTypeOf(result[0].transKey1).toEqualTypeOf<string>();
    expectTypeOf(result[0].transKey2).toEqualTypeOf<string>();
  });
});
