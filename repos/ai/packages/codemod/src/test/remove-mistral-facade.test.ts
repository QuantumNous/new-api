import { describe, it } from 'vitest';
import transformer from '../codemods/v4/remove-mistral-facade';
import { testTransform } from './test-utils';

describe('remove-mistral-facade', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-mistral-facade');
  });
});
