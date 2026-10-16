import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-transcribe';
import { testTransform } from './test-utils';

describe('rename-experimental-transcribe', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-experimental-transcribe');
  });
});
