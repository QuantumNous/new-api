import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-on-tool-call-start-to-on-tool-execution-start';
import { testTransform } from './test-utils';

describe('rename-experimental-on-tool-call-start-to-on-tool-execution-start', () => {
  it('transforms correctly', () => {
    testTransform(
      transformer,
      'rename-experimental-on-tool-call-start-to-on-tool-execution-start',
    );
  });
});
