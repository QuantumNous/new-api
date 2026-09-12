import { describe, it, expectTypeOf } from 'vitest';
import i18next, { ExistsFunction, TOptions } from 'i18next';

describe('exists', () => {
  it('should accept a string or an array of string as first parameter', () => {
    // i18next.exists('friend');
    // i18next.exists(['friend', 'tree']);
    expectTypeOf(i18next.exists).parameter(0).toEqualTypeOf<string | string[]>();
  });

  it('should accept `TOptions` as second parameter', () => {
    // i18next.exists('friend', { myVar: 'someValue' });
    // i18next.exists(['friend', 'tree'], { myVar: 'someValue' });
    expectTypeOf(i18next.exists).parameter(1).toEqualTypeOf<TOptions | undefined>();
  });

  it('should return boolean', () => {
    expectTypeOf(i18next.exists).returns.toBeBoolean();
  });

  // https://github.com/i18next/i18next/issues/2425
  it('should accept a plain arrow function when typed as `ExistsFunction`', () => {
    const a: ExistsFunction = (key, options) => i18next.exists(key, options);
    const b: ExistsFunction = (key, options) =>
      i18next.exists(key, { lng: 'en', ns: 'ourNamespace', ...options });
    expectTypeOf(a).returns.toBeBoolean();
    expectTypeOf(b).returns.toBeBoolean();
  });
});
