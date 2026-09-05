import { describe, it } from 'vitest';
import transformer from '../codemods/v7/replace-anthropic-cache-creation-input-tokens';
import { testTransform } from './test-utils';

describe('replace-anthropic-cache-creation-input-tokens', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-anthropic-cache-creation-input-tokens');
  });
});
