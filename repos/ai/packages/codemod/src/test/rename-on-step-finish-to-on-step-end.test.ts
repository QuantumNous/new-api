import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-on-step-finish-to-on-step-end';
import { testTransform } from './test-utils';

describe('rename-on-step-finish-to-on-step-end', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-on-step-finish-to-on-step-end');
  });
});
