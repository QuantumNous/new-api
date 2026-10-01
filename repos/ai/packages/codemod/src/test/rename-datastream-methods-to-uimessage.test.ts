import { describe, it } from 'vitest';
import transformer from '../codemods/v5/rename-datastream-methods-to-uimessage';
import { testTransform } from './test-utils';

describe('rename-datastream-methods-to-uimessage', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-datastream-methods-to-uimessage');
  });
});
