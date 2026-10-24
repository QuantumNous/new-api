import { describe, it } from 'vitest';
import transformer from '../codemods/v7/remove-tool-call-options-type';
import { testTransform } from './test-utils';

describe('remove-tool-call-options-type', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-tool-call-options-type');
  });
});
