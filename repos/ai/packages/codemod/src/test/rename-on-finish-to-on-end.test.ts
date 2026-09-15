import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-on-finish-to-on-end';
import { testTransform } from './test-utils';

describe('rename-on-finish-to-on-end', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-on-finish-to-on-end');
  });
});
