import { describe, it } from 'vitest';
import transformer from '../codemods/v5/not-implemented/move-tool-invocations-to-parts';
import { testTransform } from './test-utils';

describe('move-tool-invocations-to-parts', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'move-tool-invocations-to-parts');
  });
});
