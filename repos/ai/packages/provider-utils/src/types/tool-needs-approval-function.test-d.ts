import { describe, expectTypeOf, it } from 'vitest';
import type { ModelMessage } from './model-message';
import type { ToolNeedsApprovalFunction } from './tool-needs-approval-function';

describe('tool needs approval function type', () => {
  it('should type the input, approval metadata, and context', () => {
    expectTypeOf<
      ToolNeedsApprovalFunction<{ city: string }, { requestId: string }>
    >().toEqualTypeOf<
      (
        input: { city: string },
        options: {
          toolCallId: string;
          messages: ModelMessage[];
          context: { requestId: string };
        },
      ) => boolean | PromiseLike<boolean>
    >();
  });
});
