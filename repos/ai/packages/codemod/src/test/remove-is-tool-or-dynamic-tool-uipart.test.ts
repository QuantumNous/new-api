import { describe, it } from 'vitest';
import transformer from '../codemods/v7/remove-is-tool-or-dynamic-tool-uipart';
import { testTransform } from './test-utils';

describe('remove-is-tool-or-dynamic-tool-uipart', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-is-tool-or-dynamic-tool-uipart');
  });
});
