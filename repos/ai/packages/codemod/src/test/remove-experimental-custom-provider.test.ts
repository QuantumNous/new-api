import { describe, it } from 'vitest';
import transformer from '../codemods/v7/remove-experimental-custom-provider';
import { testTransform } from './test-utils';

describe('remove-experimental-custom-provider', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-experimental-custom-provider');
  });
});
