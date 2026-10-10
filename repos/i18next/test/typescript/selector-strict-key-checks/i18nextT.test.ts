import { describe, it, assertType, expectTypeOf } from 'vitest';
import i18next from 'i18next';

describe('i18next.t defaultValue with strictKeyChecks == true', () => {
  it('should resolve to the correct type when `defaultValue` is provided and key exists', () => {
    expectTypeOf(i18next.t(($) => $.foobar.barfoo, { ns: 'alternate' })).toEqualTypeOf<'barfoo'>();
    expectTypeOf(
      i18next.t(($) => $.foobar.barfoo, { defaultValue: 'some default value', ns: 'alternate' }),
    ).toEqualTypeOf<'barfoo' | 'some default value'>();
    expectTypeOf(
      i18next.t(($) => $.bar, { defaultValue: 'some default value', ns: 'custom' }),
    ).toEqualTypeOf<'bar' | 'some default value'>();
  });

  it('should throw an error even when `defaultValue` is provided if key is missing', () => {
    expectTypeOf(
      i18next.t(($) => $.bar, { ns: 'custom', defaultValue: 'some default value' }),
    ).toEqualTypeOf<'bar' | 'some default value'>();
    expectTypeOf(i18next.t(($) => $.bar, { defaultValue: 'some default value' })).toEqualTypeOf<
      'bar' | 'some default value'
    >();

    // @ts-expect-error
    assertType(i18next.t(($) => $['unknown-key']));
    assertType(
      // @ts-expect-error
      i18next.t(($) => $['unknown-key'], { ns: 'custom', defaultValue: 'some default value' }),
    );
    assertType(
      // @ts-expect-error
      i18next.t(($) => $['unknown-key'], { ns: 'unknown-ns', defaultValue: 'default value' }),
    );
  });
});
