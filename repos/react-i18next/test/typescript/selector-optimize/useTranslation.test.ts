import { describe, it, expectTypeOf, assertType } from 'vitest';
import { useTranslation } from 'react-i18next';
import { TFunction, i18n } from 'i18next';

describe('useTranslation', () => {
  it('should provide result with both object and array', () => {
    const result = useTranslation();

    expectTypeOf(result).toMatchTypeOf<[TFunction, i18n, boolean]>();
    expectTypeOf(result).toHaveProperty('ready').toBeBoolean();
    expectTypeOf(result).toHaveProperty('t').toBeFunction();
    expectTypeOf(result).toHaveProperty('i18n').toBeObject();
  });

  describe('default namespace', () => {
    it('should work with default namespace', () => {
      const [t] = useTranslation();

      expectTypeOf(t(($) => $.foo)).toEqualTypeOf<'foo'>();
    });

    it('should work with default named namespace', () => {
      const [t] = useTranslation('custom');

      expectTypeOf(t(($) => $.bar)).toEqualTypeOf<'bar'>();
    });
  });

  describe('named namespace', () => {
    it('should work with named namespace', () => {
      const [t] = useTranslation('alternate');

      expectTypeOf(t(($) => $.baz)).toEqualTypeOf<'baz'>();
    });

    it(`raises a TypeError given a namespace that doesn't exist`, () => {
      // @ts-expect-error
      useTranslation('fake');
    });

    it(`raises a TypeError given a key that's not in the namespace`, () => {
      const [t] = useTranslation('custom');
      // @ts-expect-error
      assertType<string>(t(($) => $.fake));
    });
  });

  describe('namespace as array', () => {
    it('should work with const namespaces', () => {
      const [t] = useTranslation(['alternate', 'custom']);

      expectTypeOf(t(($) => $.baz)).toEqualTypeOf<'baz'>();
      expectTypeOf(t(($) => $.baz, { ns: 'alternate' })).toEqualTypeOf<'baz'>();
      expectTypeOf(t(($) => $.custom.foo)).toEqualTypeOf<'foo'>();
      expectTypeOf(t(($) => $.foo, { ns: 'custom' })).toEqualTypeOf<'foo'>();
    });

    it('should work with const namespaces', () => {
      const namespaces = ['alternate', 'custom'] as const;
      const [t] = useTranslation(namespaces);

      expectTypeOf(t(($) => $.baz)).toEqualTypeOf<'baz'>();
      expectTypeOf(t(($) => $.baz, { ns: 'alternate' })).toEqualTypeOf<'baz'>();
      expectTypeOf(t(($) => $.custom.foo)).toEqualTypeOf<'foo'>();
      expectTypeOf(t(($) => $.foo, { ns: 'custom' })).toEqualTypeOf<'foo'>();
    });

    it('raises a TypeError given an incorrect key', () => {
      const [t] = useTranslation(['custom']);
      // @ts-expect-error
      assertType<string>(t(($) => $.custom.fake));
      // @ts-expect-error
      assertType<string>(t(($) => $.fake, { ns: 'custom' }));
    });
  });

  describe('with `keyPrefix`', () => {
    it('should provide top-level string keys', () => {
      const [t] = useTranslation('alternate', { keyPrefix: 'foobar' });

      expectTypeOf(t(($) => $.barfoo)).toEqualTypeOf<'barfoo'>();
    });

    it('should work with deeper objects', () => {
      const [t] = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      expectTypeOf(t(($) => $.deeper, { returnObjects: true })).toEqualTypeOf<{
        deeeeeper: 'foobar';
      }>();
      expectTypeOf(t(($) => $.deeper.deeeeeper)).toEqualTypeOf<'foobar'>();
    });

    it('raises a TypeError given an invalid key', () => {
      const [t] = useTranslation('alternate', { keyPrefix: 'foobar' });
      // @ts-expect-error
      assertType<string>(t(($) => $.abc));
      t(($) => $.barfoo);
    });
  });
});
