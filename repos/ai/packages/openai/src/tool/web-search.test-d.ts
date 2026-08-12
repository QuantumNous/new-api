import type { InferSchema, Tool } from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import { webSearch, type webSearchOutputSchema } from './web-search';

describe('web-search tool type', () => {
  it('should have Tool type', () => {
    const webSearchTool = webSearch();

    expectTypeOf(webSearchTool).toExtend<
      Tool<{}, InferSchema<typeof webSearchOutputSchema>, {}>
    >();
  });
});
