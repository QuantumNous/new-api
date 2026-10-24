import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-on-tool-call-finish-to-on-tool-execution-end';
import { testTransform } from './test-utils';

describe('rename-experimental-on-tool-call-finish-to-on-tool-execution-end', () => {
  it('transforms correctly', () => {
    testTransform(
      transformer,
      'rename-experimental-on-tool-call-finish-to-on-tool-execution-end',
    );
  });
});
