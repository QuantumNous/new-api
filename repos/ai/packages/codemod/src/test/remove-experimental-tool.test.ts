import { describe, it } from 'vitest';
import transformer from '../codemods/v4/remove-experimental-tool';
import { testTransform } from './test-utils';

describe('remove-experimental-tool', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-experimental-tool');
  });

  it('does not transform from other packages', () => {
    testTransform(transformer, 'remove-experimental-tool-not-ai');
  });
});
