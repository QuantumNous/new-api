import { describe, it } from 'vitest';
import transformer from '../codemods/v5/rename-message-to-ui-message';
import { testTransform } from './test-utils';

describe('rename-message-to-ui-message', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-message-to-ui-message');
  });
});
