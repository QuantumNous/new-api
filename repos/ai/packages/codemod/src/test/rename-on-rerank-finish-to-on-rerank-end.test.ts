import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-on-rerank-finish-to-on-rerank-end';
import { testTransform } from './test-utils';

describe('rename-on-rerank-finish-to-on-rerank-end', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-on-rerank-finish-to-on-rerank-end');
  });
});
