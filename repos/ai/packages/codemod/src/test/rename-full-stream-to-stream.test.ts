import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-full-stream-to-stream';
import { testTransform } from './test-utils';

describe('rename-full-stream-to-stream', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-full-stream-to-stream');
  });
});
