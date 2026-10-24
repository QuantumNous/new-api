import { describe, it, expectTypeOf } from 'vitest';
import i18next, { TFunction } from 'i18next';

describe('t', () => {
  it('basic usage', () => {
    const t = (() => '') as TFunction;

    expectTypeOf(t('friend')).toEqualTypeOf<string>();
    expectTypeOf(t`friend`).toEqualTypeOf<string>();
    expectTypeOf(t(['friend', 'tree'])).toEqualTypeOf<string>();
    expectTypeOf(t('friend', { myVar: 'someValue' })).toEqualTypeOf<string>();
    expectTypeOf(t(['friend', 'tree'], { myVar: 'someValue' })).toEqualTypeOf<string>();
  });

  it('overloaded usage', () => {
    const t = (() => '') as TFunction;

    expectTypeOf(t('friend', 'test {{myVar}}', { myVar: 'someValue' })).toEqualTypeOf<string>();
    expectTypeOf(
      t(['friend', 'tree'], 'test {{myVar}}', { myVar: 'someValue' }),
    ).toEqualTypeOf<string>();
  });

  it('return cast', () => {
    const t = (() => '') as TFunction;

    expectTypeOf(t('friend')).toEqualTypeOf<string>();
    expectTypeOf(t`friend`).toEqualTypeOf<string>();

    expectTypeOf(t('friend', { returnObjects: true })).toMatchTypeOf<
      object | string[] | object[]
    >();

    // @ts-expect-error this is not a string
    expectTypeOf(t('friend', { returnObjects: true })).toEqualTypeOf<string>();
  });

  it('default value', () => {
    const t = (() => '') as TFunction;

    expectTypeOf(t('translation:test', { defaultValue: 'test_en' })).toEqualTypeOf<string>();
    expectTypeOf(
      t('translation:test', { defaultValue: 'test_en', count: 1 }),
    ).toEqualTypeOf<string>();
    expectTypeOf(
      t('translation:test', {
        defaultValue_other: 'test_en_plural',
        defaultValue_one: 'test_en',
        count: 10,
      }),
    ).toEqualTypeOf<string>();

    // string (only) default value as second arg
    //  https://www.i18next.com/translation-function/essentials#passing-a-default-value
    //  https://github.com/i18next/i18next/blob/master/src/Translator.js#L66
    expectTypeOf(t('translation:test', 'test_en')).toEqualTypeOf<string>();
  });

  describe('`t` result as function arg', () => {
    const t = (() => '') as TFunction;

    it('call method with optional null arg', () => {
      type DisplayHint = (hint?: string | null) => string;

      expectTypeOf<DisplayHint>().parameter(0).extract<string>().toMatchTypeOf(t('friend'));
    });

    it('call method with required null arg', () => {
      type DisplayHint = (hint: string | null) => string;

      expectTypeOf<DisplayHint>().parameter(0).extract<string>().toMatchTypeOf(t('friend'));
    });

    it('call method with required arg', () => {
      type DisplayHint = (hint: string) => string;

      expectTypeOf<DisplayHint>().parameter(0).toMatchTypeOf(t('friend'));
    });
  });

  describe('keys', () => {
    const t = (() => '') as TFunction;

    it('array key', () => {
      const error404 = '404';
      expectTypeOf(t([`error.${error404}`, 'error.unspecific'])).toEqualTypeOf<string>(); // -> "The page was not found"

      const error502 = '502';
      expectTypeOf(t([`error.${error502}`, 'error.unspecific'])).toEqualTypeOf<string>(); // -> "Something went wrong"
    });

    it('string key', () => {
      expectTypeOf(t('No one says a key can not be the fallback.')).toEqualTypeOf<string>();
      // -> "Niemand sagt ein key kann nicht als Ersatz dienen."

      expectTypeOf(
        t('This will be shown if the current loaded translations to not have this.'),
      ).toEqualTypeOf<string>();
      // -> "This will be shown if the current loaded translations to not have this."
    });

    it('null translation', () => {
      expectTypeOf(i18next.t('nullKey')).toEqualTypeOf<string>();
    });
  });

  it('using `t` function inside another `t` function', () => {
    const t = (() => '') as TFunction;

    expectTypeOf(t('foobar', { defaultValue: t('inter') })).toEqualTypeOf<string>();
    expectTypeOf(
      t('foobar', { defaultValue: t('inter'), someValue: t('inter') }),
    ).toEqualTypeOf<string>();
    expectTypeOf(t('foobar', { something: t('inter') })).toEqualTypeOf<string>();
  });

  describe('interpolation', () => {
    const t = (() => '') as TFunction;

    it('simple', () => {
      // key = 'hello {{what}}'
      // -> hello WORLD
      expectTypeOf(
        t('key', { what: i18next.format('world', 'uppercase') }),
      ).toEqualTypeOf<string>();

      expectTypeOf(t('key', { what: 'i18next', how: 'great' })).toEqualTypeOf<string>();
    });

    it('with an object', () => {
      const author = {
        name: 'Jan',
        github: 'jamuhl',
      };
      expectTypeOf(t('key', { author })).toEqualTypeOf<string>();
    });

    it('using `escapeValue`', () => {
      // -> "no danger <img />" (obviously could be dangerous)
      t('keyEscaped', {
        myVar: '<img />',
        interpolation: { escapeValue: false },
      });
    });

    it('plurals', () => {
      expectTypeOf(t('key', { count: 0 })).toEqualTypeOf<string>(); // -> "items"
      expectTypeOf(t('key', { count: 1 })).toEqualTypeOf<string>(); // -> "item"
      expectTypeOf(t('key', { count: 5 })).toEqualTypeOf<string>(); // -> "items"
      expectTypeOf(t('key', { count: 100 })).toEqualTypeOf<string>(); // -> "items"

      expectTypeOf(t('keyWithCount', { count: 0 })).toEqualTypeOf<string>(); // -> "0 items"
      expectTypeOf(t('keyWithCount', { count: 1 })).toEqualTypeOf<string>(); // -> "1 item"
      expectTypeOf(t('keyWithCount', { count: 5 })).toEqualTypeOf<string>(); // -> "5 items"
      expectTypeOf(t('keyWithCount', { count: 100 })).toEqualTypeOf<string>(); // -> "100 items"
    });

    it('`postProcess`', () => {
      expectTypeOf(
        t('key1_interval', { postProcess: 'interval', count: 1 }),
      ).toEqualTypeOf<string>(); // -> "one item"
      expectTypeOf(
        t('key1_interval', { postProcess: 'interval', count: 4 }),
      ).toEqualTypeOf<string>(); // -> "a few items"
      expectTypeOf(
        t('key1_interval', { postProcess: 'interval', count: 100 }),
      ).toEqualTypeOf<string>(); // -> "a lot of items"

      // not matching into a range it will fallback to
      // the regular plural form
      expectTypeOf(
        t('key2_interval', { postProcess: 'interval', count: 1 }),
      ).toEqualTypeOf<string>(); // -> "one item"
      expectTypeOf(
        t('key2_interval', { postProcess: 'interval', count: 4 }),
      ).toEqualTypeOf<string>(); // -> "a few items"
      expectTypeOf(
        t('key2_interval', { postProcess: 'interval', count: 100 }),
      ).toEqualTypeOf<string>(); // -> "100 items"
    });

    it('`context`', () => {
      expectTypeOf(t('friend', { context: 'male', count: 1 })).toEqualTypeOf<string>();
      // -> "A boyfriend"

      expectTypeOf(t('friend', { context: 'female', count: 100 })).toEqualTypeOf<string>();
      // -> "100 girlfriends"
    });

    it('`returnObjects`', () => {
      expectTypeOf(t('tree', { returnObjects: true, something: 'gold' })).toMatchTypeOf<
        object | Array<string | object>
      >();
      // -> { res: 'added gold' }

      expectTypeOf(t('array', { returnObjects: true })).toMatchTypeOf<
        object | Array<string | object>
      >();
      // -> ['a', 'b', 'c']
    });

    it('`joinArrays`', () => {
      expectTypeOf(t('arrayJoin', { joinArrays: '+' })).toEqualTypeOf<string>();
      // -> "line1+line2+line3"
    });

    it('`joinArrays` + value to interpolate', () => {
      expectTypeOf(
        t('arrayJoinWithInterpolation', { myVar: 'a', joinArrays: ' ' }),
      ).toEqualTypeOf<string>();
      // -> "you can interpolate"
    });

    it('`returnObjects` + `returnDetails`', () => {
      expectTypeOf(t('test', { returnObjects: true, returnDetails: true }))
        .toHaveProperty('res')
        .toMatchTypeOf<object | Array<string | object>>();
    });

    it('should provide information when `returnDetails` is `true`', () => {
      const resultWithDetails = t('key', { returnDetails: true });

      expectTypeOf(resultWithDetails).toHaveProperty('res').toEqualTypeOf<string>();
      expectTypeOf(resultWithDetails).toHaveProperty('usedKey').toEqualTypeOf<string>();
      expectTypeOf(resultWithDetails).toHaveProperty('exactUsedKey').toEqualTypeOf<string>();
      expectTypeOf(resultWithDetails).toHaveProperty('usedNS').toEqualTypeOf<string>();
      expectTypeOf(resultWithDetails).toHaveProperty('usedLng').toEqualTypeOf<string>();
      expectTypeOf(resultWithDetails).toHaveProperty('usedParams').toMatchTypeOf<object>();
    });

    it('should NOT provide information when `returnDetails` is `false`', () => {
      const resultWithDetails = t('key', { returnDetails: false });

      expectTypeOf(resultWithDetails).toEqualTypeOf<string>();
      expectTypeOf(resultWithDetails).not.toHaveProperty('res');
    });

    it('without separator', () => {
      expectTypeOf(t('welcome here :)', { nsSeparator: false })).toEqualTypeOf<string>();
      // -> "welcome here :)"

      expectTypeOf(t('welcome ...', { keySeparator: false })).toEqualTypeOf<string>();
      // -> "welcome ..."
    });
  });
});
