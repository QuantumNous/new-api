import type { InferSchema, Tool } from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import {
  localShell,
  type localShellInputSchema,
  type localShellOutputSchema,
} from './local-shell';

describe('local-shell tool type', () => {
  it('should have Tool type', () => {
    const localShellTool = localShell({});

    expectTypeOf(localShellTool).toExtend<
      Tool<
        InferSchema<typeof localShellInputSchema>,
        InferSchema<typeof localShellOutputSchema>,
        {}
      >
    >();
  });
});
