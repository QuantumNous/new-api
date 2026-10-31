import { describe, it } from 'vitest';
import transformer from '../codemods/v4/remove-experimental-ai-fn-exports';
import { testTransform } from './test-utils';

describe('remove-experimental-ai-fn-exports', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-experimental-ai-fn-exports');
  });
});
