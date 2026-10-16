import { describe, it } from 'vitest';
import transformer from '../codemods/v5/import-LanguageModelV2-from-provider-package';
import { testTransform } from './test-utils';

describe('import-LanguageModelV2-from-provider-package', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'import-LanguageModelV2-from-provider-package');
  });
});
