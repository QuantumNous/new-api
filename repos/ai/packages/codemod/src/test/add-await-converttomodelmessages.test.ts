import { describe, it } from 'vitest';
import transformer from '../codemods/v6/add-await-converttomodelmessages';
import { testTransform } from './test-utils';

describe('add-await-converttomodelmessages', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'add-await-converttomodelmessages');
  });

  it('transforms correctly with aliasing', () => {
    testTransform(transformer, 'add-await-converttomodelmessages-alias');
  });

  it('does not transform when imported from other package', () => {
    testTransform(transformer, 'add-await-converttomodelmessages-not-ai');
  });
});
