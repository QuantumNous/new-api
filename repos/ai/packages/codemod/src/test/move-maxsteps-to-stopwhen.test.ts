import { describe, it } from 'vitest';
import transformer from '../codemods/v5/move-maxsteps-to-stopwhen';
import { testTransform } from './test-utils';
describe('move-maxsteps-to-stopwhen', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'move-maxsteps-to-stopwhen');
  });

  it('transforms alias correctly', () => {
    testTransform(transformer, 'move-maxsteps-to-stopwhen-alias');
  });
});
