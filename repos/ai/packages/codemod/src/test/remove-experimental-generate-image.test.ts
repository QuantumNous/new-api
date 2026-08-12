import { describe, it } from 'vitest';
import transformer from '../codemods/v7/remove-experimental-generate-image';
import { testTransform } from './test-utils';

describe('remove-experimental-generate-image', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-experimental-generate-image');
  });
});
