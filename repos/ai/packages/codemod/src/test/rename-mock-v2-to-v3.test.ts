import { describe, it } from 'vitest';
import transformer from '../codemods/v6/rename-mock-v2-to-v3';
import { testTransform } from './test-utils';

describe('rename-mock-v2-to-v3', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-mock-v2-to-v3');
  });
});
