import { describe, it } from 'vitest';
import transformer from '../codemods/v4/remove-experimental-message-types';
import { testTransform } from './test-utils';

describe('remove-experimental-message-types', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-experimental-message-types');
  });
});
