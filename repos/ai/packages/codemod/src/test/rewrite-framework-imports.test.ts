import { describe, it } from 'vitest';
import transformer from '../codemods/v4/rewrite-framework-imports';
import { testTransform } from './test-utils';

describe('rewrite-framework-imports', () => {
  for (const framework of ['solid', 'vue', 'svelte'] as const) {
    it(`transforms ${framework} correctly`, () => {
      testTransform(transformer, `rewrite-framework-imports-${framework}`);
    });
  }
});
