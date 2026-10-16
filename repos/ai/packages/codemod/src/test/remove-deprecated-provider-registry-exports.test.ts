import { describe, it } from 'vitest';
import transformer from '../codemods/v4/remove-deprecated-provider-registry-exports';
import { testTransform } from './test-utils';

describe('remove-deprecated-provider-registry-exports', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-deprecated-provider-registry-exports');
  });
});
