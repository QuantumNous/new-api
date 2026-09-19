import { describe, it, expectTypeOf } from 'vitest';
import i18next from 'i18next';

// This test verifies that t() return type is string (not never) when using a key from fallbackNS

describe('t() return type for fallbackNS keys', () => {
  const t = i18next.getFixedT('en');

  it('should return string for fallbackNS key', () => {
    // fallbackNS: ['fallback', 'fallback2']
    expectTypeOf(t('fallbackKey')).toEqualTypeOf<'fallback'>();
    expectTypeOf(t('anotherFallbackKey')).toEqualTypeOf<'fallback2'>();
  });

  it('should return string for defaultNS key', () => {
    expectTypeOf(t('bar')).toEqualTypeOf<'bar'>();
  });

  it('should return string for alternate ns key', () => {
    expectTypeOf(t('foobar.barfoo', { ns: 'alternate' })).toEqualTypeOf<'barfoo'>();
  });
});
