import {
  tool,
  type Context,
  type InferToolSetContext,
  type ModelMessage,
} from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type { ToolApprovalConfiguration } from './tool-approval-configuration';
import type { TypedToolCall } from './tool-call';

describe('ToolApprovalConfiguration', () => {
  const tools = {
    weather: tool({
      inputSchema: z.object({
        location: z.string(),
      }),
      contextSchema: z.object({
        weatherApiKey: z.string(),
      }),
    }),
    calculator: tool({
      inputSchema: z.object({
        expression: z.string(),
      }),
    }),
  };

  type Tools = typeof tools;
  type ToolSetContext = InferToolSetContext<Tools>;

  describe('per-tool (object) configuration', () => {
    it('allows string statuses and object statuses with an optional reason', () => {
      const _config: ToolApprovalConfiguration<Tools, Context> = {
        weather: 'not-applicable',
        calculator: { type: 'denied', reason: 'blocked by policy' },
      };
    });

    it('allows mixed per-tool string literals for every status variant', () => {
      const _full: ToolApprovalConfiguration<Tools, Context> = {
        weather: 'approved',
        calculator: 'user-approval',
      };
      const _second: ToolApprovalConfiguration<Tools, Context> = {
        weather: 'denied',
        calculator: 'not-applicable',
      };
    });

    it('allows object-typed statuses without a reason', () => {
      const _config: ToolApprovalConfiguration<Tools, Context> = {
        weather: { type: 'approved' },
        calculator: { type: 'user-approval' },
      };
    });

    it('infers per-tool callback input, toolContext, execution options, and default runtimeContext', () => {
      const _config: ToolApprovalConfiguration<Tools, Context> = {
        weather: (
          input,
          { toolContext, toolCallId, messages, runtimeContext },
        ) => {
          expectTypeOf(input).toEqualTypeOf<{ location: string }>();
          expectTypeOf(toolContext).toEqualTypeOf<{ weatherApiKey: string }>();
          expectTypeOf(toolCallId).toEqualTypeOf<string>();
          expectTypeOf(messages).toEqualTypeOf<ModelMessage[]>();
          expectTypeOf(runtimeContext).toEqualTypeOf<Context>();

          return 'user-approval';
        },
        calculator: 'approved',
      };
    });

    it('infers `toolContext: never` for tools without a context schema', () => {
      const _config: ToolApprovalConfiguration<Tools, Context> = {
        calculator: (input, options) => {
          expectTypeOf(input).toEqualTypeOf<{ expression: string }>();
          expectTypeOf(options.toolContext).toEqualTypeOf<never>();
          expectTypeOf(options.runtimeContext).toEqualTypeOf<Context>();

          return 'denied';
        },
      };
    });

    it('allows async per-tool approval callbacks (MaybePromiseLike)', () => {
      const _config: ToolApprovalConfiguration<Tools, Context> = {
        weather: async (input, { toolContext }) => {
          expectTypeOf(input).toEqualTypeOf<{ location: string }>();
          expectTypeOf(toolContext).toEqualTypeOf<{ weatherApiKey: string }>();
          return Promise.resolve('approved' as const);
        },
      };
    });

    it('allows per-tool callbacks that return undefined (treated as not-applicable at runtime)', () => {
      const _sync: ToolApprovalConfiguration<Tools, Context> = {
        weather: () => undefined,
      };
      const _async: ToolApprovalConfiguration<Tools, Context> = {
        weather: async () => Promise.resolve(undefined),
      };
    });

    it('allows an empty or partial per-tool object', () => {
      const _empty: ToolApprovalConfiguration<Tools, Context> = {};
      const _partial: ToolApprovalConfiguration<Tools, Context> = {
        weather: 'approved',
      };
    });
  });

  describe('generic function configuration', () => {
    it('infers toolCall, tools, toolsContext, messages, and default runtimeContext for the top-level function form', () => {
      const _config: ToolApprovalConfiguration<Tools, Context> = ({
        toolCall,
        tools: toolsArg,
        toolsContext,
        messages,
        runtimeContext,
      }) => {
        expectTypeOf(toolCall).toEqualTypeOf<TypedToolCall<Tools>>();
        expectTypeOf(toolsArg).toEqualTypeOf<Tools | undefined>();
        expectTypeOf(toolsContext).toEqualTypeOf<ToolSetContext>();
        expectTypeOf(messages).toEqualTypeOf<ModelMessage[]>();
        expectTypeOf(runtimeContext).toEqualTypeOf<Context>();

        return 'user-approval';
      };
    });

    it('allows async generic approval functions (MaybePromiseLike)', () => {
      const _config: ToolApprovalConfiguration<
        Tools,
        Context
      > = async options => {
        expectTypeOf(options.toolsContext).toEqualTypeOf<ToolSetContext>();
        expectTypeOf(options.runtimeContext).toEqualTypeOf<Context>();
        return Promise.resolve('not-applicable' as const);
      };
    });

    it('uses the second type parameter for runtimeContext in generic and per-tool approval functions', () => {
      type CustomRuntime = { orgId: string; traceId: string };

      const _generic: ToolApprovalConfiguration<Tools, CustomRuntime> = ({
        runtimeContext,
      }) => {
        expectTypeOf(runtimeContext).toEqualTypeOf<CustomRuntime>();
        return 'user-approval';
      };

      const _perTool: ToolApprovalConfiguration<Tools, CustomRuntime> = {
        weather: (_input, { runtimeContext }) => {
          expectTypeOf(runtimeContext).toEqualTypeOf<CustomRuntime>();
          return 'not-applicable';
        },
      };
    });

    it('allows generic approval functions that return undefined (treated as not-applicable at runtime)', () => {
      const _sync: ToolApprovalConfiguration<Tools, Context> = () => undefined;
      const _async: ToolApprovalConfiguration<Tools, Context> = async () =>
        Promise.resolve(undefined);
    });
  });

  describe('negative cases', () => {
    it('rejects approval configuration for unknown tool keys', () => {
      const _config: ToolApprovalConfiguration<Tools, Context> = {
        // @ts-expect-error tool approval only accepts keys from the provided tool set
        search: 'approved',
      };
    });

    it('rejects per-tool callbacks with the wrong input type for a tool', () => {
      const _config: ToolApprovalConfiguration<Tools, Context> = {
        // @ts-expect-error weather approval callbacks must receive the weather tool input
        weather: (input: { expression: string }) =>
          input.expression.length > 0 ? 'approved' : 'denied',
      };
    });

    it('rejects per-tool callbacks with the wrong return type', () => {
      const _config: ToolApprovalConfiguration<Tools, Context> = {
        // @ts-expect-error approval callbacks must return a valid approval state
        calculator: () => true,
      };
    });

    it('rejects a generic function with the wrong return type', () => {
      // @ts-expect-error approval function must return a valid approval state
      const _invalidGeneric: ToolApprovalConfiguration<Tools> = () => true;
    });
  });
});
