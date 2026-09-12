import { describe, it } from 'vitest';
import transformer from '../codemods/v5/rename-addtoolresult-to-addtooloutput';
import { testTransform } from './test-utils';

describe('rename-addtoolresult-to-addtooloutput', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-addtoolresult-to-addtooloutput');
  });

  it('does not transform from other packages', () => {
    testTransform(transformer, 'rename-addtoolresult-to-addtooloutput-not-ai');
  });
});
