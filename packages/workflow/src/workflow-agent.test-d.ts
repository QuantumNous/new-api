import { expectTypeOf, describe, it } from 'vitest';
import { z } from 'zod';
import type { Experimental_SandboxSession as SandboxSession } from 'ai';
import { WorkflowAgent } from './workflow-agent.js';

const model = 'anthropic/claude-sonnet-4-6';

describe('WorkflowAgent types', () => {
  it('infers runtimeContext in prepareStep and onEnd', () => {
    new WorkflowAgent({
      model,
      runtimeContext: { userId: 'user-123' },
      prepareStep: ({ runtimeContext }) => {
        expectTypeOf(runtimeContext).toMatchObjectType<{ userId: string }>();
        return {
          runtimeContext: { userId: runtimeContext.userId },
        };
      },
      onEnd: ({ runtimeContext }) => {
        expectTypeOf(runtimeContext).toMatchObjectType<{ userId: string }>();
      },
    });
  });

  it('exposes experimental_sandbox in prepareStep', () => {
    new WorkflowAgent({
      model,
      prepareStep: ({ experimental_sandbox }) => {
        expectTypeOf(experimental_sandbox).toEqualTypeOf<
          SandboxSession | undefined
        >();
        return { experimental_sandbox };
      },
    });
  });

  it('supports onFinish as a deprecated alias', () => {
    new WorkflowAgent({
      model,
      runtimeContext: { userId: 'user-123' },
      onFinish: ({ runtimeContext }) => {
        expectTypeOf(runtimeContext).toMatchObjectType<{ userId: string }>();
      },
    });
  });

  it('requires toolsContext when a tool declares contextSchema', () => {
    const tools = {
      weather: {
        inputSchema: z.object({ city: z.string() }),
        contextSchema: z.object({ apiKey: z.string() }),
        execute: async () => 'sunny',
      },
    };

    new WorkflowAgent({
      model,
      tools,
      toolsContext: { weather: { apiKey: 'secret' } },
    });

    new WorkflowAgent({
      model,
      tools,
      // @ts-expect-error toolsContext is required for tools with contextSchema
      toolsContext: {},
    });

    // @ts-expect-error toolsContext is required for tools with contextSchema
    new WorkflowAgent({
      model,
      tools,
    });
  });
});
