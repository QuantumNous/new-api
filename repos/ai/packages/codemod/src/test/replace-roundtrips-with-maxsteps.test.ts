import { describe, it } from 'vitest';
import transformer from '../codemods/v4/replace-roundtrips-with-maxsteps';
import { testTransform } from './test-utils';

describe('replace-roundtrips-with-maxsteps', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-roundtrips-with-maxsteps');
  });
});
