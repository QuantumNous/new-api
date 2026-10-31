import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-call-settings-type';
import { testTransform } from './test-utils';

describe('rename-call-settings-type', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-call-settings-type');
  });
});
