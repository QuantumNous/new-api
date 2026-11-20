import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-include-to-include';
import { testTransform } from './test-utils';

describe('rename-experimental-include-to-include', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-experimental-include-to-include');
  });
});
