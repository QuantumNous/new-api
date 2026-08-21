import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-on-embed-finish-to-on-embed-end';
import { testTransform } from './test-utils';

describe('rename-on-embed-finish-to-on-embed-end', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-on-embed-finish-to-on-embed-end');
  });
});
