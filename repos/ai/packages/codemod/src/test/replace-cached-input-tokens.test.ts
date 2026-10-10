import { describe, it } from 'vitest';
import transformer from '../codemods/v7/replace-cached-input-tokens';
import { testTransform } from './test-utils';

describe('replace-cached-input-tokens', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-cached-input-tokens');
  });
});
