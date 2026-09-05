import { describe, it } from 'vitest';
import transformer from '../codemods/v4/replace-baseurl';
import { testTransform } from './test-utils';

describe('replace-baseurl', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-baseurl');
  });
});
