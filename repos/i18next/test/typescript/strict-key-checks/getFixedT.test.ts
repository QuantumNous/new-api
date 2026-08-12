import { describe, it, assertType, expectTypeOf } from 'vitest';
import i18next from 'i18next';

describe('getFixedT with keyPrefix in options (issue #2318)', () => {
  it('should accept keyPrefix in options and scope keys accordingly', () => {
    const t = i18next.getFixedT('en', 'alternate');
    // keyPrefix 'foobar' should scope valid keys to those under 'foobar'
    // At runtime, fixedT prepends keyPrefix to the key: 'foobar' + '.' + 'barfoo' = 'foobar.barfoo'
    expectTypeOf(t('barfoo', { keyPrefix: 'foobar' })).toEqualTypeOf<'barfoo'>();
  });

  it('should accept deeper keyPrefix in options', () => {
    const t = i18next.getFixedT('en', 'alternate');
    expectTypeOf(t('deeeeeper', { keyPrefix: 'foobar.deep.deeper' })).toEqualTypeOf<'foobar'>();
  });

  it('should reject invalid keys under the given keyPrefix', () => {
    const t = i18next.getFixedT('en', 'alternate');
    // @ts-expect-error - 'xxx' is not a valid key under prefix 'foobar'
    assertType(t('xxx', { keyPrefix: 'foobar' }));
  });

  it('should allow overriding getFixedT keyPrefix with per-call keyPrefix', () => {
    const t = i18next.getFixedT('en', 'alternate', 'foobar');
    // Override the getFixedT keyPrefix 'foobar' with 'foobar.deep.deeper'
    expectTypeOf(t('deeeeeper', { keyPrefix: 'foobar.deep.deeper' })).toEqualTypeOf<'foobar'>();
  });

  it('should still work without keyPrefix in options (existing behavior)', () => {
    const t = i18next.getFixedT('en', 'alternate', 'foobar');
    expectTypeOf(t('barfoo')).toEqualTypeOf<'barfoo'>();
  });
});
