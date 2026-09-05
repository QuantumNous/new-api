import { describe, it } from 'vitest';
import transformer from '../codemods/v7/remove-experimental-active-tools';
import { testTransform } from './test-utils';

describe('remove-experimental-active-tools', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-experimental-active-tools');
  });
});
