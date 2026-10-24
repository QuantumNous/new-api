import { describe, it } from 'vitest';
import transformer from '../codemods/v7/replace-image-message-part-with-file';
import { testTransform } from './test-utils';

describe('replace-image-message-part-with-file', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-image-message-part-with-file');
  });
});
