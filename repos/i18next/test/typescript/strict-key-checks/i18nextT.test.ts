import { describe, it, assertType, expectTypeOf } from 'vitest';
import i18next from 'i18next';

describe('i18next.t defaultValue with strictKeyChecks == true', () => {
  it('should resolve to the correct type when `defaultValue` is provided and key exists', () => {
    expectTypeOf(i18next.t('alternate:foobar.barfoo')).toMatchTypeOf<'barfoo'>();
    expectTypeOf(
      i18next.t('alternate:foobar.barfoo', { defaultValue: 'some default value' }),
    ).toMatchTypeOf<'barfoo'>();
    expectTypeOf(
      i18next.t('alternate:foobar.barfoo', 'some default value'),
    ).toMatchTypeOf<'barfoo'>();
    expectTypeOf(
      i18next.t('custom:bar', { defaultValue: 'some default value' }),
    ).toMatchTypeOf<'bar'>();
  });

  it('should throw an error even when `defaultValue` is provided if key is missing', () => {
    expectTypeOf(i18next.t('custom:bar', 'some default value')).toMatchTypeOf<'bar'>();
    expectTypeOf(
      i18next.t('bar', { ns: 'custom', defaultValue: 'some default value' }),
    ).toMatchTypeOf<'bar'>();
    expectTypeOf(i18next.t('bar', { defaultValue: 'some default value' })).toMatchTypeOf<'bar'>();
    expectTypeOf(i18next.t('bar', 'some default value')).toMatchTypeOf<'bar'>();

    // @ts-expect-error
    assertType(i18next.t('unknown-key'));
    // @ts-expect-error
    assertType(i18next.t('unknown-key', 'default value'));
    // @ts-expect-error
    assertType(i18next.t('unknown-key', { ns: 'custom', defaultValue: 'some default value' }));
    // @ts-expect-error
    assertType(i18next.t('unknown-ns:unknown-key', 'default value'));
    // @ts-expect-error
    assertType(i18next.t('unknown-ns:unknown-key', { defaultValue: 'default value' }));
  });
});
