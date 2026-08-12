import { describe, it, assertType, expectTypeOf } from 'vitest';
import { TFunction } from 'i18next';

describe('t', () => {
  describe('default namespace usage', () => {
    const t: TFunction = (() => '') as never;

    it('should work with standard keys', () => {
      expectTypeOf(t(($) => $.bar)).toEqualTypeOf<'bar'>();
      expectTypeOf(t(($) => $.foo)).toEqualTypeOf<'foo'>();
      expectTypeOf(t(($) => $.inter, { val: 'xx' })).toEqualTypeOf<'some {{val}}'>();
      expectTypeOf(t(($) => $.baz.bing)).toEqualTypeOf<'boop'>();
    });

    it('should work with `returnObjects`', () => {
      expectTypeOf(t(($) => $.baz, { returnObjects: true })).toEqualTypeOf<{ bing: 'boop' }>();
    });

    it('should throw an error when keys are not defined', () => {
      // @ts-expect-error
      assertType(t(($) => $.does_not_exist, { wrongOrNoValPassed: 'xx' }));

      // @ts-expect-error
      assertType(t(($) => $.baz));

      // @ts-expect-error
      assertType(t(($) => $.foobar));
    });

    it('should work when using `t` inside another `t` function', () => {
      expectTypeOf(t(($) => $.foo, { defaultValue: t(($) => $.bar) })).toEqualTypeOf<
        'foo' | 'bar'
      >();
      expectTypeOf(t(($) => $.foo, { something: t(($) => $.bar) })).toEqualTypeOf<'foo'>();
      expectTypeOf(
        t(($) => $.foo, { defaultValue: t(($) => $.bar), something: t(($) => $.bar) }),
      ).toEqualTypeOf<'foo' | 'bar'>();
    });
  });

  describe('named default namespace usage', () => {
    const t: TFunction<'alternate'> = (() => '') as never;

    it('should work with standard key', () => {
      expectTypeOf(t(($) => $.baz)).toEqualTypeOf<'baz'>();
      expectTypeOf(t(($) => $.foobar.barfoo)).toEqualTypeOf<'barfoo'>();
      expectTypeOf(t(($) => $.foobar.deep.deeper.deeeeeper)).toEqualTypeOf<'foobar'>();
    });

    it('should throw an error when key is not present inside namespace', () => {
      // @ts-expect-error
      assertType(t(($) => $.bar));
      // @ts-expect-error
      assertType(t(($) => $.foobar.barfoo, { ns: 'ctx' }));
      // @ts-expect-error
      assertType(t(($) => $.foobar));
    });

    it('should work with `returnObjects`', () => {
      expectTypeOf(t(($) => $.foobar, { returnObjects: true })).toBeObject();
      expectTypeOf(t(($) => $.foobar, { returnObjects: true })).toEqualTypeOf<{
        barfoo: 'barfoo';
        deep: {
          deeper: {
            deeeeeper: 'foobar';
          };
        };
      }>();
    });

    it('should raise a TypeError when `defaultValue` is provided and value should be equal to DefaultValue', () => {
      expectTypeOf(t(($) => $.foobar.barfoo, { defaultValue: 'some default value' })).toEqualTypeOf<
        'barfoo' | 'some default value'
      >();
    });
  });

  describe('array namespace', () => {
    const t: TFunction<['custom', 'alternate']> = (() => '') as never;

    /**
     * @example
     * {
     *   custom: {
     *     foo: 'foo';
     *     bar: 'bar';
     *     baz: {
     *       bing: 'boop';
     *     };
     *     qux: 'some {{val, number}}';
     *     inter: 'some {{val}}';
     *     interUnescaped: 'some unescaped {{- val}}';
     *     interUnescapedNoSpace: 'some unescaped {{-val}}';
     *     interUnescapedFormatted: 'some unescaped {- val, number}}';
     *     nullKey: null;
     *     'empty string with {{val}}': '';
     *   }
     * }
     */
    it('TODO', () => {
      t(($) => $.baz, { ns: 'alternate' });
    });

    it('should work with standard keys', () => {
      expectTypeOf(t(($) => $.baz.bing)).toEqualTypeOf<'boop'>();
      expectTypeOf(t(($) => $.bar)).toEqualTypeOf<'bar'>();
      expectTypeOf(t(($) => $.bar, { ns: 'custom' })).toEqualTypeOf<'bar'>();
      expectTypeOf(t(($) => $.bar)).toEqualTypeOf<'bar'>();

      expectTypeOf(t(($) => $.baz, { ns: 'alternate' })).toEqualTypeOf<'baz'>();
      expectTypeOf(t(($) => $.baz, { ns: ['alternate', 'custom'] })).toEqualTypeOf<'baz'>();
      expectTypeOf(t(($) => $.custom.bar, { ns: ['alternate', 'custom'] })).toEqualTypeOf<'bar'>();
      expectTypeOf(t(($) => $.alternate.foobar.deep.deeper.deeeeeper)).toEqualTypeOf<'foobar'>();
      expectTypeOf(
        t(($) => $.foobar.deep.deeper.deeeeeper, { ns: 'alternate' }),
      ).toEqualTypeOf<'foobar'>();
    });

    it('should work with `returnObjects`', () => {
      // t('alternate:foobar.deep').deeper.deeeeeper; // i18next would say: "key 'foobar.deep (en)' returned an object instead of string."
      expectTypeOf(
        t(($) => $.foobar.deep, { returnObjects: true, ns: 'alternate' }),
      ).toEqualTypeOf<{
        deeper: {
          deeeeeper: 'foobar';
        };
      }>();
    });

    it('should throw an error when key is not present inside namespace', () => {
      // @ts-expect-error
      assertType(t(($) => $.baz));
      // @ts-expect-error
      assertType(t(($) => $.baz, { ns: 'custom' }));
      // @ts-expect-error
      assertType(t(($) => $.foobar.deep, { ns: 'alternate' }));
    });
  });

  it('error when namespace does not exist', () => {
    // @ts-expect-error
    assertType(TFunction<'foo'>);
  });

  it('should process ordinal plurals', () => {
    const t: TFunction<'ord'> = (() => '') as never;

    expectTypeOf(t(($) => $.place, { ordinal: true, count: 1 })).toEqualTypeOf<
      '1st place' | '2nd place' | '3rd place' | '{{count}}th place'
    >();
    expectTypeOf(t(($) => $.place, { ordinal: true, count: 2 })).toEqualTypeOf<
      '1st place' | '2nd place' | '3rd place' | '{{count}}th place'
    >();
    expectTypeOf(t(($) => $.place, { ordinal: true, count: 3 })).toEqualTypeOf<
      '1st place' | '2nd place' | '3rd place' | '{{count}}th place'
    >();
    expectTypeOf(t(($) => $.place, { ordinal: true, count: 4 })).toEqualTypeOf<
      '1st place' | '2nd place' | '3rd place' | '{{count}}th place'
    >();
  });

  describe('context', () => {
    const t: TFunction<'ctx'> = (() => '') as never;

    it('should work with basic usage', () => {
      expectTypeOf(t(($) => $.dessert, { context: 'cake' })).toEqualTypeOf<'a nice cake'>();

      // context + plural
      expectTypeOf(t(($) => $.dessert, { context: 'muffin', count: 3 })).toEqualTypeOf<
        'a nice muffin' | '{{count}} nice muffins'
      >();

      // @ts-expect-error
      // valid key with invalid context
      assertType(t(($) => $.dessert, { context: 'bad context' }));
    });

    it('should accept not mapped context if a fallback key is present', () => {
      // wine is not mapped
      const currentTheme = 'wine' as 'wine' | 'beer' | 'water';
      expectTypeOf(t(($) => $.beverage, { context: currentTheme })).toEqualTypeOf<
        'fresh beer' | 'cold water'
      >();
    });

    it('should accept a default context key as a valid `t` function key', () => {
      expectTypeOf(t(($) => $.beverage_water)).toEqualTypeOf<'cold water'>();
    });

    it('should throw error when no `context` is provided using and the context key has no default value ', () => {
      // @ts-expect-error dessert has no default value, it needs a context
      expectTypeOf(t(($) => $.dessert)).toMatchTypeOf('error');
    });

    it('should work with enum as a context value', () => {
      enum Dessert {
        CAKE = 'cake',
        MUFFIN = 'muffin',
      }

      expectTypeOf(t(($) => $.dessert, { context: Dessert.CAKE })).toEqualTypeOf<'a nice cake'>();

      const ctx: Dessert = Dessert.CAKE;
      expectTypeOf(t(($) => $.dessert, { context: ctx })).toEqualTypeOf<'a nice cake'>();
    });

    it('should not provide partial match as option when keys include context separator', () => {
      // https://github.com/i18next/i18next/issues/2242
      // @ts-expect-error
      t(($) => $.beverageater);
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
      expectTypeOf(t(($) => $.dessert, { context: ctxMissingValue })).toMatchTypeOf<string>();
    });

    it('should work with string union as a context value', () => {
      expectTypeOf(
        t(($) => $.dessert, { context: 'muffin' as 'muffin' | 'cake', count: 2 }),
      ).toEqualTypeOf<'a nice cake' | 'a nice muffin' | '{{count}} nice muffins'>();
    });

    // @see https://github.com/i18next/i18next/issues/2172
    // it('should trow error with string union with missing context value', () => {
    //   expectTypeOf(
    //     // @ts-expect-error
    //     t('dessert', { context: 'muffin' as 'muffin' | 'cake' | 'pippo' }),
    //   ).toMatchTypeOf<string>();
    // });
  });

  describe('context + explicit namespace', () => {
    const t: TFunction<['ctx']> = (() => '') as never;

    it('should work with basic usage', () => {
      expectTypeOf(t(($) => $.dessert, { context: 'cake' })).toEqualTypeOf<'a nice cake'>();
      expectTypeOf(
        t(($) => $.dessert, { context: 'cake', ns: 'ctx' }),
      ).toEqualTypeOf<'a nice cake'>();

      // context + plural
      expectTypeOf(t(($) => $.dessert, { context: 'muffin', count: 3 })).toEqualTypeOf<
        'a nice muffin' | '{{count}} nice muffins'
      >();
      expectTypeOf(t(($) => $.dessert, { context: 'muffin', count: 3, ns: 'ctx' })).toEqualTypeOf<
        'a nice muffin' | '{{count}} nice muffins'
      >();

      // @ts-expect-error
      // valid key with invalid context
      assertType(t(($) => $.dessert, { context: 'bad context' }));
    });
  });

  describe('context with `t` function with multiple namespaces', () => {
    const t: TFunction<['ctx', 'ctxAlternate']> = (() => '') as never;

    it('should work with basic usage', () => {
      expectTypeOf(t(($) => $.dessert, { context: 'cake' })).toEqualTypeOf<'a nice cake'>();

      expectTypeOf(t(($) => $.ctxAlternate.game_chess)).toEqualTypeOf<'Chess'>();

      // context + plural
      expectTypeOf(t(($) => $.dessert, { context: 'muffin', count: 3 })).toEqualTypeOf<
        'a nice muffin' | '{{count}} nice muffins'
      >();

      // @ts-expect-error
      // valid key with invalid context
      assertType(t(($) => $.ctx.dessert, { context: 'bad context' }));
    });

    it('should work with text value from another namespace', () => {
      expectTypeOf(t(($) => $.game, { ns: 'ctxAlternate' })).toEqualTypeOf<'A fun game'>();
      expectTypeOf(
        t(($) => $.game, { context: 'monopoly', ns: 'ctxAlternate' }),
      ).toEqualTypeOf<'Monopoly'>();
    });
  });

  it('should work with non-plural usage', () => {
    const t: TFunction<'nonPlurals'> = (() => '') as never;

    // this currently errors, but should not...
    // expectTypeOf(t('test')).toEqualTypeOf<string>();

    expectTypeOf(t(($) => $.test_2)).toEqualTypeOf<'Test 2'>();
    expectTypeOf(t(($) => $.test_form.title)).toEqualTypeOf<'title'>();
  });

  it('each t function must have a type based on provided namespace', () => {
    const tOrdinal: TFunction<'ord'> = (() => '') as never;
    const tPlurals: TFunction<'plurals'> = (() => '') as never;
    const tPluralsOrd: TFunction<['plurals', 'ord']> = (() => '') as never;
    const tOrdPlurals: TFunction<['ord', 'plurals']> = (() => '') as never;

    expectTypeOf(tOrdinal).not.toMatchTypeOf(tOrdPlurals);
    expectTypeOf(tPlurals).not.toMatchTypeOf(tPluralsOrd);
    expectTypeOf(tPlurals).not.toMatchTypeOf(tOrdPlurals);
    expectTypeOf(tOrdinal).not.toMatchTypeOf(tPluralsOrd);
    expectTypeOf(tOrdPlurals).not.toMatchTypeOf(tPluralsOrd);
  });

  describe('should work with `InterpolatorMap`', () => {
    const t: TFunction<['interpolator']> = (() => '') as never;

    it('should allow anything when key is a string', () => {
      expectTypeOf(t(($) => $.just_a_string, { asd: '', beep: 'boop' }));
    });

    it('simple key', () => {
      expectTypeOf(t(($) => $.simple, { olim: 'yes' })).toEqualTypeOf<'This is {{olim}}'>();

      // @ts-expect-error because nope isn't a valid key
      expectTypeOf(t(($) => $.simple, { nope: 'yes' })).toEqualTypeOf<'This is {{olim}}'>();
    });

    it('simple key (multiple)', () => {
      expectTypeOf(
        t(($) => $.simple_multiple_keys, { more: '', one: '' }),
      ).toEqualTypeOf<'This has {{more}} than {{one}}'>();

      // @ts-expect-error one of the required keys is missing
      t(($) => $.simple_multiple_keys, { less: '', one: '' });
    });

    it('keypath', () => {
      expectTypeOf(
        t(($) => $.keypath, { out: { there: 'yes' } }),
      ).toEqualTypeOf<'Give me one day {{out.there}}'>();

      expectTypeOf(
        t(($) => $.keypath_with_format, { out: { there: 'yes' } }),
      ).toEqualTypeOf<'Give me one day {{out.there, format}}'>();
    });

    it('keypath deep', () => {
      type Expected = '{{living.in.the}} in the sun';

      expectTypeOf(
        t(($) => $.keypath_deep, { living: { in: { the: 'yes' } } }),
      ).toEqualTypeOf<Expected>();

      // @ts-expect-error one of the required keys is missing
      t(($) => $.keypath_deep, { suffering: { in: { the: 'yes' } } });
    });
  });

  // https://github.com/i18next/i18next/issues/2383
  it('should error when using a defined namespace that is not present in TFunction NS type parameter', () => {
    const t: TFunction<['alternate']> = (() => '') as never;

    // @ts-expect-error
    t(($) => $.foo, { ns: 'custom' });
  });
});
