import { describe, it, assertType } from 'vitest';
import { t, ParseKeys } from 'i18next';

describe('ParseKeys', () => {
  it('`t` should accept result of a function returning a list of keys', () => {
    const getKey: () => ParseKeys<['generic']> = () => 'ahTLUS';
    // Test all possible function signatures
    const result = t(getKey());
    const result2 = t(getKey(), 'default value');
    const result3 = t(getKey(), { defaultValue: 'default value' });

    assertType<string>(result);
    assertType<string>(result2);
    assertType<string>(result3);
  });
});
