import { describe, it } from 'vitest';
import transformer from '../codemods/v6/rename-tool-call-options-to-tool-execution-options';
import { testTransform } from './test-utils';

describe('rename-tool-call-options-to-tool-execution-options', () => {
  it('transforms correctly', () => {
    testTransform(
      transformer,
      'rename-tool-call-options-to-tool-execution-options',
    );
  });
});
