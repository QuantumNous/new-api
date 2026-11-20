import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-on-step-start-to-on-step-start';
import { testTransform } from './test-utils';

describe('rename-experimental-on-step-start-to-on-step-start', () => {
  it('transforms correctly', () => {
    testTransform(
      transformer,
      'rename-experimental-on-step-start-to-on-step-start',
    );
  });
});
