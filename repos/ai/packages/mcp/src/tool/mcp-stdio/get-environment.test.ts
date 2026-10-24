import { describe, it, expect } from 'vitest';
import { getEnvironment } from './get-environment';

describe('getEnvironment', () => {
  it('should not mutate the original custom environment object', () => {
    const customEnv = { CUSTOM_VAR: 'custom_value' };

    const result = getEnvironment(customEnv);

    expect(customEnv).toStrictEqual({ CUSTOM_VAR: 'custom_value' });
    expect(result).not.toBe(customEnv);
  });
});
