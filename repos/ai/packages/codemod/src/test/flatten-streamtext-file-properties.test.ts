import { describe, it } from 'vitest';
import transformer from '../codemods/v5/flatten-streamtext-file-properties';
import { testTransform } from './test-utils';

describe('flatten-streamtext-file-properties', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'flatten-streamtext-file-properties');
  });
});
