import { describe, it, expectTypeOf } from 'vitest';
import type { TFunction } from 'i18next';

describe('interpolation types (zero-config, derived from format specifiers)', () => {
  const t: TFunction<'custom'> = (() => '') as never;

  it('should type unformatted values as string | number', () => {
    // {{name}} has no format specifier → string | number
    // (i18next stringifies values at runtime, so numbers are also accepted.)
    t('greeting', { name: 'World' });
    t('greeting', { name: 42 });

    // @ts-expect-error boolean should not be assignable to string | number
    t('greeting', { name: true });
    // @ts-expect-error object should not be assignable to string | number
    t('greeting', { name: { id: 1 } });
  });

  it('should type "number" format as number', () => {
    // {{count, number}} → number
    t('count_message', { count: 42 });

    // @ts-expect-error string should not be assignable to number
    t('count_message', { count: 'five' });
  });

  it('should type "datetime" format as Date', () => {
    // {{date, datetime}} → Date
    t('event_date', { date: new Date() });

    // @ts-expect-error string should not be assignable to Date
    t('event_date', { date: 'yesterday' });
  });

  it('should type "currency" format as number', () => {
    // {{amount, currency}} → number
    t('price', { amount: 9.99 });

    // @ts-expect-error string should not be assignable to number
    t('price', { amount: 'ten' });
  });

  it('should work with nested key paths', () => {
    // nested value without format → string
    t('nested', { deep: { val: 'hello' } });
  });

  it('should not affect keys without interpolation', () => {
    expectTypeOf(t('no_interpolation')).toEqualTypeOf<'Just a plain string'>();
  });

  it('should handle mixed formats in a single translation', () => {
    // label → string (no format), amount → number, when → Date
    t('mixed', { label: 'Total', amount: 100, when: new Date() });

    // @ts-expect-error amount should be number, not string
    t('mixed', { label: 'Total', amount: 'hundred', when: new Date() });
  });

  it('should strip inline formatting options like currency(EUR)', () => {
    // {{price, currency(EUR)}} → currency → number
    t('price_eur', { price: 42 });

    // @ts-expect-error string should not be assignable to number
    t('price_eur', { price: 'forty-two' });
  });

  it('should strip inline formatting options for relativetime', () => {
    // {{when, relativetime(quarter)}} → relativetime → number
    t('event_relative', { when: -1 });

    // @ts-expect-error string should not be assignable to number
    t('event_relative', { when: 'last quarter' });
  });
});
