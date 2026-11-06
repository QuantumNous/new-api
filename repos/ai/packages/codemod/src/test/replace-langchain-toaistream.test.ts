import { describe, it } from 'vitest';
import transformer from '../codemods/v4/replace-langchain-toaistream';
import { testTransform } from './test-utils';

describe('replace-langchain-toaistream', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-langchain-toaistream');
  });
});
