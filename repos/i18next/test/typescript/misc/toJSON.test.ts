import { describe, it, expectTypeOf } from 'vitest';
import i18next, { InitOptions, ResourceStore } from 'i18next';

describe('toJSON', () => {
  it('should be callable', () => {
    expectTypeOf(i18next.toJSON).toBeFunction();
  });

  it('should return an object with the correct shape', () => {
    const result = i18next.toJSON();

    expectTypeOf(result).toHaveProperty('options').toEqualTypeOf<InitOptions>();
    expectTypeOf(result).toHaveProperty('store').toEqualTypeOf<ResourceStore>();
    expectTypeOf(result).toHaveProperty('language').toEqualTypeOf<string>();
    expectTypeOf(result).toHaveProperty('languages').toEqualTypeOf<readonly string[]>();
    expectTypeOf(result).toHaveProperty('resolvedLanguage').toEqualTypeOf<string | undefined>();
  });
});
