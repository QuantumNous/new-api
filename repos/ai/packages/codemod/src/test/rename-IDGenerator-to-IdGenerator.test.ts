import { describe, it } from 'vitest';
import transformer from '../codemods/v5/rename-IDGenerator-to-IdGenerator';
import { testTransform } from './test-utils';

describe('rename-IDGenerator-to-IdGenerator', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-IDGenerator-to-IdGenerator');
  });
});
