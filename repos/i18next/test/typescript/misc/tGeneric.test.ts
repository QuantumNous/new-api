import { describe, it, expectTypeOf } from 'vitest';
import i18next, { TOptions } from 'i18next';

describe('tGeneric', () => {
  type Keys = 'friend' | 'tree';

  it('should accept keys via generic', () => {
    const t = i18next.t<Keys, Record<string, unknown>, string>;

    expectTypeOf(t).parameter(0).toMatchTypeOf<string | string[]>();
    expectTypeOf(t).parameter(1).extract<object>().toMatchTypeOf<TOptions>();

    expectTypeOf(t('friend', { myVar: 'someValue' })).toEqualTypeOf<string>();
    expectTypeOf(t(['friend', 'tree'], { myVar: 'someValue' })).toEqualTypeOf<string>();
  });

  it('should work with interpolation values', () => {
    const t = i18next.t<Keys, Record<string, unknown>, '{{myVar}}'>;

    expectTypeOf(t).parameter(0).toMatchTypeOf<string | string[]>();
    expectTypeOf(t).parameter(1).extract<object>().toMatchTypeOf<Record<string, unknown>>();

    expectTypeOf(t('friend', { myVar: 'someValue' })).toEqualTypeOf<'{{myVar}}'>();
    expectTypeOf(t(['friend', 'tree'], { myVar: 'someValue' })).toEqualTypeOf<'{{myVar}}'>();
  });
});
