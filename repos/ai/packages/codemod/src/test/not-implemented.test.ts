import { describe, it } from 'vitest';
import transformer from '../codemods/v5/not-implemented/pattern';
import { testTransform } from './test-utils';

describe('not-implemented', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'not-implemented');
  });

  it('handles alias imports correctly', () => {
    testTransform(transformer, 'not-implemented-alias');
  });
});
