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

    it('should work with keys from both namespaces', () => {
      expectTypeOf(t(($) => $.bar)).toEqualTypeOf<'bar'>();
      expectTypeOf(t(($) => $.bar, { ns: 'custom' })).toEqualTypeOf<'bar'>();
      expectTypeOf(t(($) => $.custom_b.another_entry)).toEqualTypeOf<'Argh'>();
      expectTypeOf(t(($) => $.another_entry, { ns: 'custom_b' })).toEqualTypeOf<'Argh'>();
    });

    it('should work with `returnObjects`', () => {
      expectTypeOf(t(($) => $.baz, { returnObjects: true })).toEqualTypeOf<{
        bing: 'boop';
      }>();
    });

    it('should raise a TypeError when keys are not defined', () => {
      // @ts-expect-error
      assertType(t(($) => $.inter, { wrongOrNoValPassed: 'xx' }));

      // @ts-expect-error
      assertType(t(($) => $.baz));
      // @ts-expect-error
      assertType(t(($) => $.custom.foobar));
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

  describe('union accessors', () => {
    const t: TFunction<'custom_b'> = (() => '') as never;
    it('should work with const keys', () => {
      const alternateTranslationKeys = ['another_entry', 'one_more'] as const;

      const result = alternateTranslationKeys.map((value) => t(($) => $[value]));

      expectTypeOf(result).toEqualTypeOf<('Argh' | 'Whyyy')[]>();
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
      assertType(t(($) => $.alternate.foobar.barfoo));
      // @ts-expect-error
      assertType(t(($) => $.foobar));

      // @ts-expect-error
      assertType(t(($) => $.new.key));
      // @ts-expect-error
      assertType(t(($) => $.new.key, { other: 'stuff' }));
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
  });

  describe('array namespace', () => {
    const t: TFunction<['custom', 'alternate']> = (() => '') as never;

    it('should work with standard keys', () => {
      expectTypeOf(t(($) => $.bar)).toEqualTypeOf<'bar'>();
      expectTypeOf(t(($) => $.alternate.baz)).toEqualTypeOf<'baz'>();
      expectTypeOf(t(($) => $.baz, { ns: 'alternate' })).toEqualTypeOf<'baz'>();
      expectTypeOf(t(($) => $.bar, { ns: 'custom' })).toEqualTypeOf<'bar'>();
      // @ts-expect-error - `custom` namespace should no longer be available when `alternate` namespace is chosen in options
      expectTypeOf(t(($) => $.custom.bar, { ns: 'alternate' })).toEqualTypeOf<'bar'>();

      expectTypeOf(t(($) => $.bar, { ns: ['custom', 'alternate'] })).toEqualTypeOf<'bar'>();
      expectTypeOf(t(($) => $.custom.bar, { ns: ['alternate', 'custom'] })).toEqualTypeOf<'bar'>();

      expectTypeOf(t(($) => $.baz, { ns: ['alternate', 'custom'] })).toEqualTypeOf<'baz'>();
      expectTypeOf(
        t(($) => $.alternate.baz, { ns: ['custom', 'alternate'] }),
      ).toEqualTypeOf<'baz'>();
    });

    it('should work with `returnObjects`', () => {
      // t($ => $.alternate.foobar.deep').deeper.deeeeeper; // i18next would say: "key 'foobar.deep (en)' returned an object instead of string."
      expectTypeOf(t(($) => $.alternate.foobar.deep, { returnObjects: true })).toEqualTypeOf<{
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
      assertType(t(($) => $.alternate.foobar.deep));
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

  it('should work with context', () => {
    const t: TFunction<'ctx'> = (() => '') as never;

    expectTypeOf(t(($) => $.dessert, { context: 'cake' })).toEqualTypeOf<'a nice cake'>();

    // context + plural
    expectTypeOf(t(($) => $.dessert, { context: 'muffin', count: 3 })).toMatchTypeOf<string>();

    // @ts-expect-error
    // valid key with invalid context
    assertType(t(($) => $.foo, { context: 'cake' }));
  });

  it('should work with context and array namespaces', () => {
    const t: TFunction<['ord', 'ctx']> = (() => '') as never;

    expectTypeOf(t(($) => $.ctx.dessert, { context: 'cake' })).toEqualTypeOf<'a nice cake'>();
    expectTypeOf(
      t(($) => $.dessert, { context: 'cake', ns: 'ctx' }),
    ).toEqualTypeOf<'a nice cake'>();
    expectTypeOf(
      t(($) => $.dessert, { context: 'cake', ns: ['ctx'] }),
    ).toEqualTypeOf<'a nice cake'>();
    expectTypeOf(
      t(($) => $.dessert, { context: 'cake', ns: ['ctx', 'ord'] }),
    ).toEqualTypeOf<'a nice cake'>();

    // context + plural
    expectTypeOf(t(($) => $.ctx.dessert, { context: 'muffin', count: 3 })).toEqualTypeOf<
      'a nice muffin' | '{{count}} nice muffins'
    >();

    // @ts-expect-error
    // valid key with invalid context
    assertType(t('foo', { context: 'cake' }));
  });

  it('should work with false plural usage', () => {
    const t: TFunction<'nonPlurals'> = (() => '') as never;

    expectTypeOf(t(($) => $.test)).toEqualTypeOf<'Test'>();
    expectTypeOf(t(($) => $.test_2)).toEqualTypeOf<'Test 2'>();
    expectTypeOf(t(($) => $.test_form.title)).toEqualTypeOf<'title'>();
  });

  it('should return `never` with invalid namespace', () => {
    // @ts-expect-error
    const t: TFunction<string> = (() => '') as never;
    // @ts-expect-error
    t(($) => $.foo);
  });

  it('each t function must have a type based on provided namespace', () => {
    const tOrdinal: TFunction<'ord'> = (() => '') as never;
    const tPlurals: TFunction<'plurals'> = (() => '') as never;
    const tPluralsOrd: TFunction<['plurals', 'ord']> = (() => '') as never;
    const tOrdPlurals: TFunction<['ord', 'plurals']> = (() => '') as never;

    expectTypeOf(tOrdinal).not.toMatchTypeOf(tPlurals);
    expectTypeOf(tOrdPlurals).not.toEqualTypeOf(tPlurals);
    expectTypeOf(tPluralsOrd).not.toEqualTypeOf(tPlurals);
  });
});
