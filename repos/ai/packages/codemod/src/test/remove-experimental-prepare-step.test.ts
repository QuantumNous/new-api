import { describe, it } from 'vitest';
import transformer from '../codemods/v7/remove-experimental-prepare-step';
import { testTransform } from './test-utils';

describe('remove-experimental-prepare-step', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-experimental-prepare-step');
  });
});
