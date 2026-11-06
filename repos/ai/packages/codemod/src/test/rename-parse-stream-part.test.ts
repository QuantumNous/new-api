import { describe, it } from 'vitest';
import transformer from '../codemods/v4/rename-parse-stream-part';
import { testTransform } from './test-utils';

describe('rename-parse-stream-part', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-parse-stream-part');
  });

  it('does not transform from other packages', () => {
    testTransform(transformer, 'rename-parse-stream-part-not-ai');
  });
});
