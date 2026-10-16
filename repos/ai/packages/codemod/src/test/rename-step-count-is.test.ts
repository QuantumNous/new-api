import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-step-count-is';
import { testTransform } from './test-utils';

describe('rename-step-count-is', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-step-count-is');
  });
});
