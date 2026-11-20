import { describe, it } from 'vitest';
import transformer from '../codemods/v7/replace-experimental-output-with-output';
import { testTransform } from './test-utils';

describe('replace-experimental-output-with-output', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-experimental-output-with-output');
  });
});
