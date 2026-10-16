import { describe, expectTypeOf, it } from 'vitest';
import type { HasRequiredKey } from './index';

describe('HasRequiredKey', () => {
  it('returns false for an empty object', () => {
    expectTypeOf<HasRequiredKey<{}>>().toEqualTypeOf<false>();
  });

  it('returns false when all keys are optional', () => {
    expectTypeOf<
      HasRequiredKey<{
        id?: string;
        name?: string;
      }>
    >().toEqualTypeOf<false>();
  });

  it('returns true when at least one key is required', () => {
    expectTypeOf<
      HasRequiredKey<{
        id?: string;
        name: string;
      }>
    >().toEqualTypeOf<true>();
  });

  it('returns true when all keys are required', () => {
    expectTypeOf<
      HasRequiredKey<{
        id: string;
        name: string;
      }>
    >().toEqualTypeOf<true>();
  });
});
