import { describe, it } from 'vitest';
import transformer from '../codemods/v6/rename-core-message-to-model-message';
import { testTransform } from './test-utils';

describe('rename-core-message-to-model-message', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-core-message-to-model-message');
  });
});
