import { describe, it } from 'vitest';
import transformer from '../codemods/v4/replace-continuation-steps';
import { testTransform } from './test-utils';

describe('replace-continuation-steps', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-continuation-steps');
  });
});
