import { describe, it, assertType, expectTypeOf } from 'vitest';
import i18next from 'i18next';

describe('t', () => {
  const t = i18next.getFixedT('en');

  it('should get standard keys', () => {
    expectTypeOf(t('bar')).toEqualTypeOf<'bar'>();
    expectTypeOf(t('foobar.barfoo', { ns: 'alternate' })).toEqualTypeOf<'barfoo'>();
  });

  it('should throw error when key is not defined in `resources`', () => {
    // @ts-expect-error
    assertType(t('alternate:foobar.barfoo'));
    // @ts-expect-error
    assertType(t('foobar.barfoo'));
  });

  it('should accept fallback keys', () => {
    expectTypeOf(t('fallbackKey')).toBeString();
    expectTypeOf(t('anotherFallbackKey')).toBeString();
  });
});
