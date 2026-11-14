import { describe, it } from 'vitest';
import transformer from '../codemods/v5/replace-textdelta-with-text';
import { testTransform } from './test-utils';

describe('replace-textdelta-with-text', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-textdelta-with-text');
  });
});
