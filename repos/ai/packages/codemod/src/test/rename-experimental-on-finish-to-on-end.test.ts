import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-on-finish-to-on-end';
import { testTransform } from './test-utils';

describe('rename-experimental-on-finish-to-on-end', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-experimental-on-finish-to-on-end');
  });
});
