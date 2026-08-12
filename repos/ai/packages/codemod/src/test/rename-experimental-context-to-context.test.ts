import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-context-to-context';
import { testTransform } from './test-utils';

describe('rename-experimental-context-to-context', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-experimental-context-to-context');
  });
});
