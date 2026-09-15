import { describe, it } from 'vitest';
import transformer from '../codemods/v6/rename-text-embedding-to-embedding';
import { testTransform } from './test-utils';

describe('rename-text-embedding-to-embedding', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-text-embedding-to-embedding');
  });
});
