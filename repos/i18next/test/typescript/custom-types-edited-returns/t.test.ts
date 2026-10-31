import { describe, it, expectTypeOf } from 'vitest';
import i18next from 'i18next';

describe('main', () => {
  it('should accept null translations with returnNull set to true in config', () => {
    expectTypeOf(i18next.t('nullKey')).toBeNull();
  });

  it('should fallback for empty string translations with returnEmpty set to false in config', () => {
    expectTypeOf(
      i18next.t('empty string with {{val}}'),
    ).toEqualTypeOf<'empty string with {{val}}'>();
  });
});
