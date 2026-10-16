import { describe, it } from 'vitest';
import transformer from '../codemods/v4/remove-ai-stream-methods-from-stream-text-result';
import { testTransform } from './test-utils';

describe('remove-ai-stream-methods-from-stream-text-result', () => {
  it('transforms correctly', () => {
    testTransform(
      transformer,
      'remove-ai-stream-methods-from-stream-text-result',
    );
  });
});
