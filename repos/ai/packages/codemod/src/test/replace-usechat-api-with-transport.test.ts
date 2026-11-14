import { describe, it } from 'vitest';
import transformer from '../codemods/v5/replace-usechat-api-with-transport';
import { testTransform } from './test-utils';

describe('replace-usechat-api-with-transport', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'replace-usechat-api-with-transport');
  });
});
