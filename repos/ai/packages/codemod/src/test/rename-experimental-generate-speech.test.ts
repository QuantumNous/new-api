import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-generate-speech';
import { testTransform } from './test-utils';

describe('rename-experimental-generate-speech', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-experimental-generate-speech');
  });
});
