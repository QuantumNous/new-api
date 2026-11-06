import { describe, it } from 'vitest';
import transformer from '../codemods/v4/remove-await-streamtext';
import { testTransform } from './test-utils';

describe('remove-await-fn', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'remove-await-fn');
  });

  it('transforms correctly with aliasing', () => {
    testTransform(transformer, 'remove-await-fn-alias');
  });

  it('does not transform when imported from other package', () => {
    testTransform(transformer, 'remove-await-fn-other');
  });

  it('does not transform on other function', () => {
    testTransform(transformer, 'remove-await-fn-other-fn');
  });
});
