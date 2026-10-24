import { describe, it } from 'vitest';
import transformer from '../codemods/v4/rename-format-stream-part';
import { testTransform } from './test-utils';

describe('rename-format-stream-part', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-format-stream-part');
  });

  it('does not transform from other packages', () => {
    testTransform(transformer, 'rename-format-stream-part-not-ai');
  });
});
