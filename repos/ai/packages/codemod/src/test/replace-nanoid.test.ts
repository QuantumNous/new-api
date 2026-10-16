import { describe, it } from 'vitest';
import transformer from '../codemods/v4/replace-nanoid';
import { testTransform } from './test-utils';

describe('replace-nanoid', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-nanoid');
  });

  it('does not transform when imported from other packages', () => {
    testTransform(transformer, 'replace-nanoid-not-ai');
  });
});
