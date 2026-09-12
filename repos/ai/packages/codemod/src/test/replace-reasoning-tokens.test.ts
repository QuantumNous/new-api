import { describe, it } from 'vitest';
import transformer from '../codemods/v7/replace-reasoning-tokens';
import { testTransform } from './test-utils';

describe('replace-reasoning-tokens', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-reasoning-tokens');
  });
});
