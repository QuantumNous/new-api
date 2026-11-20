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

      expectTypeOf(t).toBeCallableWith('foo');
    });

    it('should work with default named namespace', () => {
      const [t] = useTranslation('custom');

      expectTypeOf(t).toBeCallableWith('bar');
    });
  });

  describe('named namespace', () => {
    it('should work with named namespace', () => {
      const [t] = useTranslation('alternate');

      expectTypeOf(t).toBeCallableWith('baz');
    });

    it('should throw error when namespace does not exist', () => {
      // @ts-expect-error
      const [t] = useTranslation('fake');
    });

    it('should throw error when key does not exist inside namespace', () => {
      const [t] = useTranslation('custom');
      // @ts-expect-error
      assertType<string>(t('fake'));
    });
  });

  describe('namespace as array', () => {
    it('should work with const namespaces', () => {
      const [t] = useTranslation(['alternate', 'custom']);

      expectTypeOf(t('alternate:baz')).toEqualTypeOf<'baz'>();
      expectTypeOf(t('baz', { ns: 'alternate' })).toEqualTypeOf<'baz'>();
      expectTypeOf(t('custom:foo')).toEqualTypeOf<'foo'>();
      expectTypeOf(t('foo', { ns: 'custom' })).toEqualTypeOf<'foo'>();
    });

    it('should work with const namespaces', () => {
      const namespaces = ['alternate', 'custom'] as const;
      const [t] = useTranslation(namespaces);

      expectTypeOf(t('alternate:baz')).toEqualTypeOf<'baz'>();
      expectTypeOf(t('baz', { ns: 'alternate' })).toEqualTypeOf<'baz'>();
      expectTypeOf(t('custom:foo')).toEqualTypeOf<'foo'>();
      expectTypeOf(t('foo', { ns: 'custom' })).toEqualTypeOf<'foo'>();
    });

    it('should throw error when using wrong key', () => {
      const [t] = useTranslation(['custom']);
      // @ts-expect-error
      assertType<string>(t('custom:fake'));
      // @ts-expect-error
      assertType<string>(t('fake', { ns: 'custom' }));
    });
  });

  describe('with `keyPrefix`', () => {
    it('should provide string keys', () => {
      const [t] = useTranslation('alternate', { keyPrefix: 'foobar' });

      expectTypeOf(t('barfoo')).toEqualTypeOf<'barfoo'>();
    });

    it('should work with deeper objects', () => {
      const [t] = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      expectTypeOf(t('deeper', { returnObjects: true })).toEqualTypeOf<{
        deeeeeper: 'foobar';
      }>();
      expectTypeOf(t('deeper.deeeeeper')).toEqualTypeOf<'foobar'>();
    });

    it('should throw error with an invalid keyPrefix', () => {
      // @ts-expect-error
      useTranslation('alternate', { keyPrefix: 'abc' });
    });

    it('should throw error with an invalid key', () => {
      const [t] = useTranslation('alternate', { keyPrefix: 'foobar' });
      // @ts-expect-error
      assertType<string>(t('abc'));
    });
  });

  it('should work with json format v4 plurals', () => {
    const [t] = useTranslation('plurals');

    expectTypeOf(t('foo', { count: 0 })).toEqualTypeOf<'foo'>();
    expectTypeOf(t('foo_one')).toEqualTypeOf<'foo'>();
  });
});
