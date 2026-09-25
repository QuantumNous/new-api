import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-on-start-to-on-start';
import { testTransform } from './test-utils';

describe('rename-experimental-on-start-to-on-start', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-experimental-on-start-to-on-start');
  });
});
