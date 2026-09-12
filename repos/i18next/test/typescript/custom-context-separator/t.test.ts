import { describe, it, expectTypeOf } from 'vitest';
import { TFunction } from 'i18next';

describe('t', () => {
  const t = (() => '') as TFunction;

  it('works with simple usage', () => {
    expectTypeOf(t('dessert', { context: 'cake' })).toBeString();
  });

  it('works with context + plural', () => {
    expectTypeOf(t('dessert', { context: 'muffin', count: 3 })).toBeString();
  });

  it('works with and without context', () => {
    expectTypeOf(t('beverage')).toBeString();
    expectTypeOf(t('beverage', { context: 'beer' })).toBeString();
  });
});
