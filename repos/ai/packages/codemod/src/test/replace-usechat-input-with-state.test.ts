import { describe, it } from 'vitest';
import transformer from '../codemods/v5/replace-usechat-input-with-state';
import { testTransform } from './test-utils';

describe('replace-usechat-input-with-state', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-usechat-input-with-state');
  });
});
