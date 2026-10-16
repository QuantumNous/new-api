import { describe, it } from 'vitest';
import transformer from '../codemods/v7/move-include-raw-chunks-to-include';
import { testTransform } from './test-utils';

describe('move-include-raw-chunks-to-include', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'move-include-raw-chunks-to-include');
  });
});
