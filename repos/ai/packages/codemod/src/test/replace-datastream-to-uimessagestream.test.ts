import { describe, it } from 'vitest';
import transformer from '../codemods/v5/replace-datastream-to-uimessagestream';
import { testTransform } from './test-utils';

describe('replace-datastream-to-uimessagestream', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-datastream-to-uimessagestream');
  });
});
