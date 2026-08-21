import { describe, it, assertType, expectTypeOf } from 'vitest';
import i18next from 'i18next';

describe('i18next.t', () => {
  it('should work with standard keys', () => {
    expectTypeOf(i18next.t('bar', {})).toEqualTypeOf<'bar'>();
    expectTypeOf(i18next.t('bar')).toEqualTypeOf<'bar'>();

    expectTypeOf(i18next.t('foobar.barfoo', { ns: 'alternate' })).toEqualTypeOf<'barfoo'>();
    expectTypeOf(i18next.t('alternate:foobar.barfoo')).toEqualTypeOf<'barfoo'>();

    expectTypeOf(i18next.t('custom:bar')).toEqualTypeOf<'bar'>();
    expectTypeOf(i18next.t('bar', { ns: 'custom' })).toEqualTypeOf<'bar'>();

    expectTypeOf(i18next.t('baz.bing')).toEqualTypeOf<'boop'>();

    expectTypeOf(i18next.t('alternate:foobar.barfoo')).toEqualTypeOf<'barfoo'>();
  });

  it('should throw error when key is not defined in namespace', () => {
    // @ts-expect-error
    assertType(i18next.t('bar', { ns: 'alternate' }));
  });

  it('should work with `returnObjects`', () => {
    type AlternateFoobarDeepResult = {
      deeper: {
        deeeeeper: 'foobar';
      };
    };

    // i18next.t('alternate:foobar.deep').deeper.deeeeeper; // i18next would say: "key 'foobar.deep (en)' returned an object instead of string."
    expectTypeOf(
      i18next.t('alternate:foobar.deep', { returnObjects: true }),
    ).toEqualTypeOf<AlternateFoobarDeepResult>();
    expectTypeOf(
      i18next.t('foobar.deep', { ns: 'alternate', returnObjects: true }),
    ).toEqualTypeOf<AlternateFoobarDeepResult>();
    expectTypeOf(
      i18next.t('foobar.deep', { ns: 'alternate', returnObjects: true, returnDetails: true }).res,
    ).toEqualTypeOf<AlternateFoobarDeepResult>();
  });

  describe('interpolation', () => {
    it('should work with passing along values', () => {
      expectTypeOf(i18next.t('custom:inter', { val: 'asdf' })).toEqualTypeOf<'some {{val}}'>();
      expectTypeOf(
        i18next.t('inter', { val: 'asdf', ns: 'custom' }),
      ).toEqualTypeOf<'some {{val}}'>();
      expectTypeOf(i18next.t('inter', { val: 'asdf' })).toEqualTypeOf<'some {{val}}'>();
      expectTypeOf(i18next.t('qux', { val: 123 })).toEqualTypeOf<'some {{val, number}}'>();
    });

    it('should work when using unescaped values', () => {
      expectTypeOf(
        i18next.t('interUnescaped', { val: 'asdf' }),
      ).toEqualTypeOf<'some unescaped {{- val}}'>();
      expectTypeOf(
        i18next.t('interUnescapedNoSpace', { val: 'asdf' }),
      ).toEqualTypeOf<'some unescaped {{-val}}'>();
      expectTypeOf(
        i18next.t('interUnescapedFormatted', { val: 'asdf' }),
      ).toEqualTypeOf<'some unescaped {- val, number}}'>();
    });

    it('should throw an error when value is not present inside key', () => {
      // @ts-expect-error
      assertType(i18next.t('custom:inter', { foo: 'asdf' }));
    });
  });

  describe('defaultValue', () => {
    it('should work with default value for existing keys', () => {
      expectTypeOf(
        i18next.t('custom:bar', { defaultValue: 'some default value' }),
      ).toEqualTypeOf<'bar'>();
      expectTypeOf(i18next.t('custom:bar', 'some default value')).toEqualTypeOf<'bar'>();
      expectTypeOf(
        i18next.t('bar', { ns: 'custom', defaultValue: 'some default value' }),
      ).toEqualTypeOf<'bar'>();

      expectTypeOf(i18next.t('bar', { defaultValue: 'some default value' })).toEqualTypeOf<'bar'>();
      expectTypeOf(i18next.t('bar', 'some default value')).toEqualTypeOf<'bar'>();
    });

    it('should accept any key if default value is provided, return type must the type of defaultValue', () => {
      assertType<'default value'>(i18next.t('unknown-ns:unknown-key', 'default value'));
      assertType<'default value'>(
        i18next.t('unknown-ns:unknown-key', { defaultValue: 'default value' }),
      );
    });
  });

  it('should fallback for null translations with unset returnNull in config', () => {
    expectTypeOf(i18next.t('nullKey')).toEqualTypeOf<'nullKey'>();
  });

  it('should accept empty string translations with returnEmpty with unset returnEmpty in config', () => {
    expectTypeOf(i18next.t('empty string with {{val}}')).toEqualTypeOf<''>();
  });

  it('should work with plurals', () => {
    expectTypeOf(i18next.t('plurals:foo', { count: 1 })).toBeString();
    expectTypeOf(i18next.t('plurals:foo_many', { count: 10 })).toBeString();
  });

  it('should throw error with invalid key', () => {
    // @ts-expect-error
    assertType(i18next.t('custom:test'));
  });

  it('should throw error with invalid namespace', () => {
    // @ts-expect-error
    assertType(i18next.t('test:bar'));
  });
});
