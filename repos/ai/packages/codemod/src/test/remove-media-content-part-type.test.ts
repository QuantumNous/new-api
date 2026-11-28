import { describe, it } from 'vitest';
import transformer from '../codemods/v7/remove-media-content-part-type';
import { testTransform } from './test-utils';

describe('remove-media-content-part-type', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-media-content-part-type');
  });
});
