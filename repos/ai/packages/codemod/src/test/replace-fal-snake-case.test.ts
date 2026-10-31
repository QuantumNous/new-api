import { describe, it } from 'vitest';
import transformer from '../codemods/v5/replace-fal-snake-case';
import { testTransform } from './test-utils';

describe('replace-fal-snake-case', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-fal-snake-case');
  });
});
