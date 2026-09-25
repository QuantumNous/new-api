import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-system-to-instructions';
import { testTransform } from './test-utils';

describe('rename-system-to-instructions', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-system-to-instructions');
  });
});
