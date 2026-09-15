import { describe, it } from 'vitest';
import transformer from '../codemods/v4/remove-experimental-useassistant';
import { testTransform } from './test-utils';

describe('remove-experimental-useassistant', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-experimental-useassistant');
  });
});
