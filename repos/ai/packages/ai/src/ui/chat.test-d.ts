import { z } from 'zod/v4';
import { tool, type ToolSet } from '@ai-sdk/provider-utils';
import type { ChatInit } from './chat';
import type {
  InferUITools,
  UIDataTypes,
  UIMessage,
  UITools,
} from './ui-messages';
import { describe, it, expectTypeOf } from 'vitest';

type ToolCallCallback<TOOLS extends ToolSet | UITools> = NonNullable<
  ChatInit<
    UIMessage<
      never,
      UIDataTypes,
      TOOLS extends ToolSet ? InferUITools<TOOLS> : TOOLS
    >
  >['onToolCall']
>;

type ToolCallArgument<TOOLS extends ToolSet | UITools> = Parameters<
  ToolCallCallback<TOOLS>
>[0]['toolCall'];

describe('onToolCall', () => {
  describe('no helpers', () => {
    it('single tool with output schema', () => {
      type Tools = {
        simple: {
          input: number;
          output: string;
        };
      };

      expectTypeOf<
        ToolCallArgument<Tools> & { dynamic?: false }
      >().toMatchTypeOf<{
        toolName: 'simple';
        input: number;
      }>();
    });

    it('single tool without output schema', () => {
      type Tools = {
        simple: {
          input: number;
          output: undefined;
        };
      };

      expectTypeOf<
        ToolCallArgument<Tools> & { dynamic?: false }
      >().toMatchTypeOf<{
        toolName: 'simple';
        input: number;
      }>();
    });

    it('multiple tools with output schema', () => {
      type Tools = {
        simple: {
          input: number;
          output: string;
        };
        complex: {
          input: {
            title: string;
            description: string;
          };
          output: Array<{
            message: string;
          }>;
        };
      };

      expectTypeOf<
        ToolCallArgument<Tools> & { dynamic?: false }
      >().toMatchTypeOf<
        | {
            toolName: 'simple';
            input: number;
          }
        | {
            toolName: 'complex';
            input: {
              title: string;
              description: string;
            };
          }
      >();
    });

    it('multiple tools without output schema', () => {
      type Tools = {
        simple: {
          input: number;
          output: undefined;
        };
        complex: {
          input: {
            title: string;
            description: string;
          };
          output: undefined;
        };
      };

      expectTypeOf<
        ToolCallArgument<Tools> & { dynamic?: false }
      >().toMatchTypeOf<
        | {
            toolName: 'simple';
            input: number;
          }
        | {
            toolName: 'complex';
            input: {
              title: string;
              description: string;
            };
          }
      >();
    });
  });

  describe('with helpers', () => {
    it('single tool with output schema', () => {
      const simple = tool({
        inputSchema: z.number(),
        outputSchema: z.string(),
      });

      const tools = {
        simple,
      };

      expectTypeOf<
        ToolCallArgument<typeof tools> & { dynamic?: false }
      >().toMatchTypeOf<{
        toolName: 'simple';
        input: number;
      }>();
    });

    it('single tool without output schema', () => {
      const simple = tool({
        inputSchema: z.number(),
      });

      const tools = {
        simple,
      };

      expectTypeOf<
        ToolCallArgument<typeof tools> & { dynamic?: false }
      >().toMatchTypeOf<{
        toolName: 'simple';
        input: number;
      }>();
    });

    it('multiple tools with output schema', () => {
      const simple = tool({
        inputSchema: z.number(),
        outputSchema: z.string(),
      });

      const complex = tool({
        inputSchema: z.object({
          title: z.string(),
          description: z.string(),
        }),
        outputSchema: z.array(
          z.object({
            message: z.string(),
          }),
        ),
      });

      const tools = {
        simple,
        complex,
      };

      expectTypeOf<
        ToolCallArgument<typeof tools> & { dynamic?: false }
      >().toMatchTypeOf<
        | {
            toolName: 'simple';
            input: number;
          }
        | {
            toolName: 'complex';
            input: {
              title: string;
              description: string;
            };
          }
      >();
    });

    it('multiple tools without output schema', () => {
      const simple = tool({
        inputSchema: z.number(),
      });

      const complex = tool({
        inputSchema: z.object({
          title: z.string(),
          description: z.string(),
        }),
      });

      const tools = {
        simple,
        complex,
      };

      expectTypeOf<
        ToolCallArgument<typeof tools> & { dynamic?: false }
      >().toMatchTypeOf<
        | {
            toolName: 'simple';
            input: number;
          }
        | {
            toolName: 'complex';
            input: {
              title: string;
              description: string;
            };
          }
      >();
    });
  });
});
