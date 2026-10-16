import { describe, it } from 'vitest';
import transformer from '../codemods/v6/wrap-tomodeloutput-parameter';
import { testTransform } from './test-utils';

describe('wrap-tomodeloutput-parameter', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'wrap-tomodeloutput-parameter');
  });
});
