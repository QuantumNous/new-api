import { describe, it } from 'vitest';
import transformer from '../codemods/v4/remove-openai-facade';
import { testTransform } from './test-utils';

describe('remove-openai-facade', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-openai-facade');
  });

  it('does not transform openai corporate', () => {
    testTransform(transformer, 'remove-openai-facade-corp');
  });

  it('does transform openai import with as', () => {
    testTransform(transformer, 'remove-openai-facade-as');
  });
});
