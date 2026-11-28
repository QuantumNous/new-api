import type { InferSchema, Tool } from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import {
  computer,
  type computerInputSchema,
  type computerOutputSchema,
} from './computer';

describe('computer tool type', () => {
  it('should have Tool type', () => {
    const computerTool = computer();

    expectTypeOf(computerTool).toExtend<
      Tool<
        InferSchema<typeof computerInputSchema>,
        InferSchema<typeof computerOutputSchema>,
        {}
      >
    >();
  });
});
