import { describe, it, expectTypeOf } from 'vitest';
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
  });

  describe('namespace as array', () => {
    it('should work with const namespaces', () => {
      const [t] = useTranslation(['alternate', 'custom']);

      expectTypeOf(t('alternate:baz')).toEqualTypeOf<string>();
      expectTypeOf(t('baz', { ns: 'alternate' })).toEqualTypeOf<string>();
      expectTypeOf(t('custom:foo')).toEqualTypeOf<string>();
      expectTypeOf(t('foo', { ns: 'custom' })).toEqualTypeOf<string>();
    });

    it('should work with const namespaces', () => {
      const namespaces = ['alternate', 'custom'] as const;
      const [t] = useTranslation(namespaces);

      expectTypeOf(t('alternate:baz')).toEqualTypeOf<string>();
      expectTypeOf(t('baz', { ns: 'alternate' })).toEqualTypeOf<string>();
      expectTypeOf(t('custom:foo')).toEqualTypeOf<string>();
      expectTypeOf(t('foo', { ns: 'custom' })).toEqualTypeOf<string>();
    });
  });

  describe('with `keyPrefix`', () => {
    it('should provide string keys', () => {
      const [t] = useTranslation('alternate', { keyPrefix: 'foobar' });

      expectTypeOf(t('barfoo')).toEqualTypeOf<string>();
    });

    it('should work with deeper objects', () => {
      const [t] = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      expectTypeOf(t('deeper', { returnObjects: true })).toEqualTypeOf<
        (string | object)[] | object
      >();
      expectTypeOf(t('deeper.deeeeeper')).toEqualTypeOf<string>();
    });
  });

  it('should work with json format v4 plurals', () => {
    const [t] = useTranslation('plurals');

    expectTypeOf(t('foo')).toEqualTypeOf<string>();
    expectTypeOf(t('foo_one')).toEqualTypeOf<string>();
  });
});
