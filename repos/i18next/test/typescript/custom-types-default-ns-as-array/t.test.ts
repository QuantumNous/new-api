import { describe, it, assertType, expectTypeOf } from 'vitest';
import { TFunction } from 'i18next';

describe('t', () => {
  describe('default namespace usage', () => {
    const t = (() => '') as TFunction;

    it('should work with standard keys', () => {
      expectTypeOf(t('bar')).toEqualTypeOf<'bar'>();
      expectTypeOf(t('foo')).toEqualTypeOf<'foo'>();
      expectTypeOf(t('inter', { val: 'xx' })).toEqualTypeOf<'some {{val}}'>();

      expectTypeOf(t('baz.bing')).toEqualTypeOf<'boop'>();
    });

    it('should work with keys from both default namespaces', () => {
      expectTypeOf(t('custom:bar')).toEqualTypeOf<'bar'>();
      expectTypeOf(t('bar')).toEqualTypeOf<'bar'>();

      expectTypeOf(t('custom_b:another_entry')).toEqualTypeOf<'Argh'>();
      expectTypeOf(t('another_entry', { ns: 'custom_b' })).toEqualTypeOf<'Argh'>();
    });

    it('should work with `returnObjects`', () => {
      expectTypeOf(t('baz', { returnObjects: true })).toEqualTypeOf<{
        bing: 'boop';
      }>();
    });

    it('should trow an error when keys are not defined', () => {
      // @ts-expect-error
      assertType(t('inter', { wrongOrNoValPassed: 'xx' }));

      // @ts-expect-error
      assertType(t('baz'));
      // @ts-expect-error
      assertType(t('custom:foobar'));
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

  it('should work with context', () => {
    const t = (() => '') as TFunction<'ctx'>;

    expectTypeOf(t('dessert', { context: 'cake' })).toEqualTypeOf<'a nice cake'>();

    // context + plural
    expectTypeOf(t('dessert', { context: 'muffin', count: 3 })).toMatchTypeOf<string>();

    // @ts-expect-error
    // valid key with invalid context
    assertType(t('foo', { context: 'cake' }));
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
});
