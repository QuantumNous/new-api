import { describe, it } from 'vitest';
import transformer from '../codemods/v5/require-createIdGenerator-size-argument';
import { testTransform } from './test-utils';

describe('require-createIdGenerator-size-argument', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'require-createIdGenerator-size-argument');
  });
});
