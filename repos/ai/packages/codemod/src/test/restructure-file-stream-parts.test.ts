import { describe, it } from 'vitest';
import transformer from '../codemods/v5/restructure-file-stream-parts';
import { testTransform } from './test-utils';

describe('restructure-file-stream-parts', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'restructure-file-stream-parts');
  });
});
