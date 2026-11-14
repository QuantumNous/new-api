import { describe, it, assertType, expectTypeOf } from 'vitest';
import { TFunction, TOptions } from 'i18next';

describe('t', () => {
  describe('default namespace usage', () => {
    const t = (() => '') as TFunction;

    it('should work with standard keys', () => {
      expectTypeOf(t('bar')).toEqualTypeOf<'bar'>();
      expectTypeOf(t('foo')).toEqualTypeOf<'foo'>();
      expectTypeOf(t('inter', { val: 'xx' })).toEqualTypeOf<'some {{val}}'>();

      expectTypeOf(t('baz.bing')).toEqualTypeOf<'boop'>();
    });

    it('should work with `returnObjects`', () => {
      expectTypeOf(t('baz', { returnObjects: true })).toEqualTypeOf<{
        bing: 'boop';
      }>();
    });

    it('should throw an error when keys are not defined', () => {
      // @ts-expect-error
      assertType(t('do_not_exists', { wrongOrNoValPassed: 'xx' }));

      // @ts-expect-error
      assertType(t('baz'));

      // @ts-expect-error
      assertType(t('foobar'));
    });

    it('should work when using `t` inside another `t` function', () => {
      expectTypeOf(t('foo', { defaultValue: t('bar') })).toEqualTypeOf<'foo'>();
      expectTypeOf(t('foo', { something: t('bar') })).toEqualTypeOf<'foo'>();
      expectTypeOf(
        t('foo', { defaultValue: t('bar'), something: t('bar') }),
      ).toEqualTypeOf<'foo'>();
    });
  });

  describe('named default namespace usage', () => {
    const t = (() => '') as TFunction<'alternate'>;

    it('should work with standard key', () => {
      expectTypeOf(t('baz')).toEqualTypeOf<'baz'>();

      expectTypeOf(t('foobar.barfoo')).toEqualTypeOf<'barfoo'>();
      expectTypeOf(t('foobar.deep.deeper.deeeeeper')).toEqualTypeOf<'foobar'>();
    });

    it('should throw an error when key is not present inside namespace', () => {
      // @ts-expect-error
      assertType(t('bar'));

      // @ts-expect-error
      assertType(t('alternate:foobar.barfoo'));
      // @ts-expect-error
      assertType(t('foobar'));

      // @ts-expect-error
      assertType(t('new.key'));
      // @ts-expect-error
      assertType(t('new.key', { other: 'stuff' }));
    });

    it('should work with `returnObjects`', () => {
      expectTypeOf(t('foobar', { returnObjects: true })).toBeObject();
      expectTypeOf(t('foobar', { returnObjects: true })).toEqualTypeOf<{
        barfoo: 'barfoo';
        deep: {
          deeper: {
            deeeeeper: 'foobar';
          };
        };
      }>();
    });

    it('should work with const keys', () => {
      const alternateTranslationKeys = ['baz', 'foobar.barfoo'] as const;

      const result = alternateTranslationKeys.map((value) => t(value));

      assertType<string[]>(result);
    });

    it('should not throw an error when `defaultValue` is provided and value should be equal to DefaultValue', () => {
      expectTypeOf(
        t('foobar.barfoo', { defaultValue: 'some default value' }),
      ).toMatchTypeOf<string>();
      expectTypeOf(t('new.key', { defaultValue: 'some default value' })).toMatchTypeOf<string>();
      expectTypeOf(t('new.key', 'some default value')).toMatchTypeOf<string>();
    });
  });

  describe('array namespace', () => {
    const t = (() => '') as TFunction<['custom', 'alternate']>;

    it('should work with standard keys', () => {
      expectTypeOf(t('baz.bing')).toEqualTypeOf<'boop'>();
      expectTypeOf(t('alternate:baz')).toEqualTypeOf<'baz'>();
      expectTypeOf(t('baz', { ns: 'alternate' })).toEqualTypeOf<'baz'>();

      expectTypeOf(t('custom:bar')).toEqualTypeOf<'bar'>();
      expectTypeOf(t('bar', { ns: 'custom' })).toEqualTypeOf<'bar'>();
      expectTypeOf(t('bar')).toEqualTypeOf<'bar'>();
      expectTypeOf(t('baz', { ns: ['alternate', 'custom'] })).toEqualTypeOf<'baz'>();
    });

    it('should work with `returnObjects`', () => {
      // t('alternate:foobar.deep').deeper.deeeeeper; // i18next would say: "key 'foobar.deep (en)' returned an object instead of string."
      expectTypeOf(t('alternate:foobar.deep', { returnObjects: true })).toEqualTypeOf<{
        deeper: {
          deeeeeper: 'foobar';
        };
      }>();
    });

    it('should throw an error when key is not present inside namespace', () => {
      // @ts-expect-error
      assertType(t('baz'));
      // @ts-expect-error
      assertType(t('baz', { ns: 'custom' }));
      // @ts-expect-error
      assertType(t('alternate:foobar.deep'));
    });
  });

  it('error when namespace does not exist', () => {
    // @ts-expect-error
    assertType(TFunction<'foo'>);
  });

  it('should process ordinal plurals', () => {
    const t = (() => '') as TFunction<'ord'>;

    expectTypeOf(t('place', { ordinal: true, count: 1 })).toBeString();
    expectTypeOf(t('place', { ordinal: true, count: 2 })).toBeString();
    expectTypeOf(t('place', { ordinal: true, count: 3 })).toBeString();
    expectTypeOf(t('place', { ordinal: true, count: 4 })).toBeString();
  });

  describe('context', () => {
    const t = (() => '') as TFunction<'ctx'>;

    it('should work with basic usage', () => {
      expectTypeOf(t('dessert', { context: 'cake' })).toEqualTypeOf<'a nice cake'>();

      // context + plural
      expectTypeOf(t('dessert', { context: 'muffin', count: 3 })).toMatchTypeOf<string>();

      // @ts-expect-error
      // valid key with invalid context
      assertType(t('foo', { context: 'cake' }));
    });

    it('should accept not mapped context if a fallback key is present', () => {
      // wine is not mapped
      const currentTheme = 'wine' as 'wine' | 'beer' | 'water';
      expectTypeOf(t('beverage', { context: currentTheme })).toMatchTypeOf<string>();
    });

    it('should accept a default context key as a valid `t` function key', () => {
      expectTypeOf(t('beverage')).toMatchTypeOf('cold water');
    });

    it('should throw error when no `context` is provided using and the context key has no default value ', () => {
      // @ts-expect-error dessert has no default value, it needs a context
      expectTypeOf(t('dessert')).toMatchTypeOf('error');
    });

    it('should work with enum as a context value', () => {
      enum Dessert {
        CAKE = 'cake',
        MUFFIN = 'muffin',
      }

      expectTypeOf(t('dessert', { context: Dessert.CAKE })).toMatchTypeOf<string>();

      const ctx: Dessert = Dessert.CAKE;
      expectTypeOf(t('dessert', { context: ctx })).toMatchTypeOf<string>();
    });

    it('should not provide partial match as option when keys include context separator', () => {
      // https://github.com/i18next/i18next/issues/2242
      // @ts-expect-error
      t('beverageater');
    });

    it('should trow error with string union with missing context value', () => {
      enum DessertMissingValue {
        COOKIE = 'cookie',
        CAKE = 'cake',
        MUFFIN = 'muffin',
        ANOTHER = 'another',
      }

      const ctxMissingValue = DessertMissingValue.ANOTHER;

      // @ts-expect-error Dessert.ANOTHER is not mapped so it must give a type error
      expectTypeOf(t('dessert', { context: ctxMissingValue })).toMatchTypeOf<string>();
    });

    it('should work with string union as a context value', () => {
      expectTypeOf(
        t('dessert', { context: 'muffin' as 'muffin' | 'cake' }),
      ).toMatchTypeOf<string>();
    });

    // @see https://github.com/i18next/i18next/issues/2172
    it('should throw error with string union with missing context value', () => {
      expectTypeOf(
        // @ts-expect-error
        t('dessert', { context: 'muffin' as 'muffin' | 'cake' | 'pippo' }),
      ).toMatchTypeOf<string>();
    });

    // @see https://github.com/i18next/i18next/issues/2418
    it('should accept TOptions as options parameter', () => {
      const opts = {} as TOptions;
      expectTypeOf(t('beverage', opts)).toBeString();
    });
  });

  describe('context + explicit namespace', () => {
    const t = (() => '') as TFunction<['ctx']>;

    it('should work with basic usage', () => {
      expectTypeOf(t('ctx:dessert', { context: 'cake' })).toEqualTypeOf<'a nice cake'>();

      // context + plural
      expectTypeOf(t('ctx:dessert', { context: 'muffin', count: 3 })).toMatchTypeOf<string>();

      // @ts-expect-error
      // valid key with invalid context
      assertType(t('ctx:foo', { context: 'cake' }));
    });
  });

  describe('context with `t` function with multiple namespaces', () => {
    const t = (() => '') as TFunction<['ctx', 'ctxAlternate']>;

    it('should work with basic usage', () => {
      expectTypeOf(t('ctx:dessert', { context: 'cake' })).toEqualTypeOf<'a nice cake'>();

      // context + plural
      expectTypeOf(t('ctx:dessert', { context: 'muffin', count: 3 })).toMatchTypeOf<string>();

      // @ts-expect-error
      // valid key with invalid context
      assertType(t('ctx:foo', { context: 'cake' }));
    });

    it('should work with text value from another namespace', () => {
      expectTypeOf(t('ctxAlternate:game')).toMatchTypeOf<string>();
      expectTypeOf(t('ctxAlternate:game', { context: 'monopoly' })).toMatchTypeOf<string>();
    });
  });

  it('should work with false plural usage', () => {
    const t = (() => '') as TFunction<'nonPlurals'>;

    // this currently errors, but should not...
    // expectTypeOf(t('test')).toEqualTypeOf<string>();

    expectTypeOf(t('test_2')).toEqualTypeOf<'Test 2'>();
    expectTypeOf(t('test_form.title')).toEqualTypeOf<'title'>();
  });

  it('should return `never` with invalid namespace', () => {
    // @ts-expect-error
    const t = (() => '') as TFunction<string>;
    assertType<never>(t('foo'));
  });

  it('each t function must have a type based on provided namespace', () => {
    const tOrdinal = (() => '') as TFunction<'ord'>;
    const tOrdPlurals = (() => '') as TFunction<['ord', 'plurals']>;
    const tPluralsOrd = (() => '') as TFunction<['plurals', 'ord']>;
    const tPlurals = (() => '') as TFunction<'plurals'>;

    expectTypeOf(tOrdinal).not.toMatchTypeOf(tPlurals);
    expectTypeOf(tOrdPlurals).not.toMatchTypeOf(tPlurals);
    expectTypeOf(tPluralsOrd).toMatchTypeOf(tPlurals);
  });

  describe('should work with `InterpolatorMap`', () => {
    const t = (() => '') as TFunction<['interpolator']>;

    it('should allow anything when key is a string', () => {
      expectTypeOf(t('just_a_string', { asd: '', beep: 'boop' }));
    });

    it('simple key', () => {
      expectTypeOf(t('simple', { olim: 'yes' })).toEqualTypeOf<'This is {{olim}}'>();

      // @ts-expect-error because nope isn't a valid key
      expectTypeOf(t('simple', { nope: 'yes' })).toEqualTypeOf<'This is {{olim}}'>();
    });

    it('simple key (multiple)', () => {
      type Expected = 'This has {{more}} than {{one}}';
      expectTypeOf(t('simple_multiple_keys', { more: '', one: '' })).toEqualTypeOf<Expected>();

      // @ts-expect-error one of the required keys is missing
      expectTypeOf(t('simple_multiple_keys', { less: '', one: '' })).toEqualTypeOf<Expected>();
    });

    it('keypath', () => {
      expectTypeOf(
        t('keypath', { out: { there: 'yes' } }),
      ).toEqualTypeOf<'Give me one day {{out.there}}'>();

      expectTypeOf(
        t('keypath_with_format', { out: { there: 'yes' } }),
      ).toEqualTypeOf<'Give me one day {{out.there, format}}'>();
    });

    it('keypath deep', () => {
      type Expected = '{{living.in.the}} in the sun';

      expectTypeOf(t('keypath_deep', { living: { in: { the: 'yes' } } })).toEqualTypeOf<Expected>();

      expectTypeOf(
        // @ts-expect-error one of the required keys is missing
        t('keypath_deep', { suffering: { in: { the: 'yes' } } }),
      ).toEqualTypeOf<Expected>();
    });
  });
});
