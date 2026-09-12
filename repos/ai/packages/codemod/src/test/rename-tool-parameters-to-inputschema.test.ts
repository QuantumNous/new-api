import { describe, it } from 'vitest';
import transformer from '../codemods/v5/rename-tool-parameters-to-inputschema';
import { testTransform } from './test-utils';

describe('rename-tool-parameters-to-inputschema', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-tool-parameters-to-inputschema');
  });
});
