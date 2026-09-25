import { tool, type Context } from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import {
  Output,
  type GenerateTextOnEndCallback,
  type ToolApprovalConfiguration,
  type ToolInputRefinement,
} from '../generate-text';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import type { AsyncIterableStream } from '../util/async-iterable-stream';
import type { DeepPartial } from '../util/deep-partial';
import type { AgentCallParameters, AgentStreamParameters } from './agent';
import { ToolLoopAgent } from './tool-loop-agent';

describe('ToolLoopAgent', () => {
  describe('onFinish callback type compatibility', () => {
    it('should allow StreamTextOnFinishCallback where ToolLoopAgentOnFinishCallback is expected', () => {
      const streamTextCallback: GenerateTextOnEndCallback<
        {},
        {}
      > = async event => {
        const runtimeContext: unknown = event.runtimeContext;
        runtimeContext;
      };

      expectTypeOf(streamTextCallback).toMatchTypeOf<
        GenerateTextOnEndCallback<{}>
      >();
    });

    it('should allow ToolLoopAgentOnFinishCallback where GenerateTextOnEndCallback is expected', () => {
      const agentCallback: GenerateTextOnEndCallback<{}> = async event => {
        const runtimeContext: unknown = event.runtimeContext;
        runtimeContext;
      };

      expectTypeOf(agentCallback).toMatchTypeOf<
        GenerateTextOnEndCallback<{}, {}>
      >();
    });
  });

  describe('generate', () => {
    it('should accept include', async () => {
      new ToolLoopAgent({
        model: new MockLanguageModelV4(),
        include: { requestMessages: true },
      });
    });

    it('should not allow system prompt', async () => {
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
      });

      await agent.generate({
        // @ts-expect-error - system prompt is not allowed
        system: '123',
        prompt: 'Hello, world!',
      });
    });

    it('should require options when call options are provided', async () => {
      const agent = new ToolLoopAgent<{ callOption: string }>({
        model: new MockLanguageModelV4(),
      });

      expectTypeOf<Parameters<typeof agent.generate>[0]>().toEqualTypeOf<
        AgentCallParameters<{ callOption: string }>
      >();
    });

    it('should not require options when call options are not provided', async () => {
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
      });

      expectTypeOf<Parameters<typeof agent.generate>[0]>().toEqualTypeOf<
        AgentCallParameters<never>
      >();
    });

    it('should infer output type', async () => {
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
        output: Output.object({
          schema: z.object({ value: z.string() }),
        }),
      });

      const generateResult = await agent.generate({
        prompt: 'Hello, world!',
      });

      const output = generateResult.output;

      expectTypeOf<typeof output>().toEqualTypeOf<{ value: string }>();
    });

    it('should type toolApproval in settings and prepareCall', () => {
      const tools = {
        testTool: tool({
          inputSchema: z.object({ value: z.string() }),
        }),
      };

      new ToolLoopAgent({
        model: new MockLanguageModelV4(),
        tools,
        toolApproval: {
          testTool: (input, options) => {
            expectTypeOf(input).toEqualTypeOf<{ value: string }>();
            expectTypeOf(options.toolCallId).toEqualTypeOf<string>();
            expectTypeOf(options.messages).toMatchTypeOf<Array<any>>();
            expectTypeOf(options.runtimeContext).toEqualTypeOf<Context>();

            return 'user-approval';
          },
        },
        experimental_refineToolInput: {
          testTool: input => {
            expectTypeOf(input).toEqualTypeOf<{ value: string }>();
            return { value: input.value.trim() };
          },
        },
        prepareCall: options => {
          expectTypeOf(options.toolApproval).toEqualTypeOf<
            ToolApprovalConfiguration<typeof tools, Context> | undefined
          >();
          expectTypeOf(options.experimental_refineToolInput).toEqualTypeOf<
            ToolInputRefinement<typeof tools> | undefined
          >();

          return {
            ...options,
            prompt: 'Hello, world!',
          };
        },
      });
    });

    it('should support stable start callbacks', async () => {
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
        onStart: event => {
          expectTypeOf(event.runtimeContext).toEqualTypeOf<Context>();
        },
        onStepStart: event => {
          expectTypeOf(event.runtimeContext).toEqualTypeOf<Context>();
        },
      });

      await agent.generate({
        prompt: 'Hello, world!',
        onStart: event => {
          expectTypeOf(event.runtimeContext).toEqualTypeOf<Context>();
        },
        onStepStart: event => {
          expectTypeOf(event.runtimeContext).toEqualTypeOf<Context>();
        },
      });
    });

    it('should support deprecated tool call callbacks', async () => {
      const tools = {
        calculator: tool({
          inputSchema: z.object({ expression: z.string() }),
          execute: async () => 'result',
        }),
      };
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
        tools,
      });

      await agent.generate({
        prompt: 'Hello, world!',
        experimental_onToolCallStart: event => {
          expectTypeOf(event.callId).toEqualTypeOf<string>();
        },
        experimental_onToolCallFinish: event => {
          expectTypeOf(event.callId).toEqualTypeOf<string>();
        },
      });
    });
  });

  describe('stream', () => {
    it('should not allow system prompt', () => {
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
      });

      agent.stream({
        // @ts-expect-error - system prompt is not allowed
        system: '123',
        prompt: 'Hello, world!',
      });
    });

    it('should require options when call options are provided', async () => {
      const agent = new ToolLoopAgent<{ callOption: string }>({
        model: new MockLanguageModelV4(),
      });

      expectTypeOf<Parameters<typeof agent.stream>[0]>().toEqualTypeOf<
        AgentStreamParameters<{ callOption: string }, {}>
      >();
    });

    it('should not require options when call options are not provided', async () => {
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
      });

      expectTypeOf<Parameters<typeof agent.stream>[0]>().toEqualTypeOf<
        AgentStreamParameters<never, {}>
      >();
    });

    it('should infer output type', async () => {
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
        output: Output.object({
          schema: z.object({ value: z.string() }),
        }),
      });

      const streamResult = await agent.stream({
        prompt: 'Hello, world!',
      });

      const partialOutputStream = streamResult.partialOutputStream;

      expectTypeOf<typeof partialOutputStream>().toEqualTypeOf<
        AsyncIterableStream<DeepPartial<{ value: string }>>
      >();
    });

    it('should support stable start callbacks', async () => {
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
      });

      await agent.stream({
        prompt: 'Hello, world!',
        onStart: event => {
          expectTypeOf(event.runtimeContext).toEqualTypeOf<Context>();
        },
        onStepStart: event => {
          expectTypeOf(event.runtimeContext).toEqualTypeOf<Context>();
        },
      });
    });

    it('should support deprecated tool call callbacks', async () => {
      const tools = {
        calculator: tool({
          inputSchema: z.object({ expression: z.string() }),
          execute: async () => 'result',
        }),
      };
      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4(),
        tools,
      });

      await agent.stream({
        prompt: 'Hello, world!',
        experimental_onToolCallStart: event => {
          expectTypeOf(event.callId).toEqualTypeOf<string>();
        },
        experimental_onToolCallFinish: event => {
          expectTypeOf(event.callId).toEqualTypeOf<string>();
        },
      });
    });
  });

  const toolWithoutContext = {
    calculator: tool({
      inputSchema: z.object({ expression: z.string() }),
      execute: async () => 'result',
    }),
  };

  const twoToolsWithContext = {
    weather: tool({
      inputSchema: z.object({ location: z.string() }),
      contextSchema: z.object({ weatherApiKey: z.string() }),
      execute: async ({ location }, { context: { weatherApiKey } }) => {
        return { location, weatherApiKey };
      },
    }),
    db: tool({
      inputSchema: z.object({ query: z.string() }),
      contextSchema: z.object({ dbUrl: z.string() }),
      execute: async ({ query }, { context: { dbUrl } }) => {
        return { query, dbUrl };
      },
    }),
  };

  const mixedTools = {
    weather: tool({
      inputSchema: z.object({ location: z.string() }),
      contextSchema: z.object({ weatherApiKey: z.string() }),
      execute: async ({ location }, { context: { weatherApiKey } }) => {
        return { location, weatherApiKey };
      },
    }),
    calculator: tool({
      inputSchema: z.object({ expression: z.string() }),
      execute: async () => 'result',
    }),
  };

  describe('runtimeContext', () => {
    it('should accept no runtimeContext', async () => {
      new ToolLoopAgent({
        model: new MockLanguageModelV4(),
      });
    });

    it('should allow empty runtimeContext', async () => {
      new ToolLoopAgent({
        model: new MockLanguageModelV4(),
        runtimeContext: {},
      });
    });

    it('should accept user runtimeContext', async () => {
      new ToolLoopAgent<never, {}, { telemetryId: string }>({
        model: new MockLanguageModelV4(),
        runtimeContext: { telemetryId: '123' },
      });
    });

    it('should accept includeRuntimeContext for runtimeContext keys', async () => {
      new ToolLoopAgent<never, {}, { userId: string; requestId: string }>({
        model: new MockLanguageModelV4(),
        runtimeContext: { userId: 'user-123', requestId: 'request-123' },
        telemetry: {
          includeRuntimeContext: {
            userId: true,
            requestId: false,
          },
        },
      });
    });

    it('should accept includeToolsContext for toolsContext keys', async () => {
      new ToolLoopAgent<never, typeof twoToolsWithContext>({
        model: new MockLanguageModelV4(),
        tools: twoToolsWithContext,
        toolsContext: {
          weather: { weatherApiKey: 'key' },
          db: { dbUrl: 'url' },
        },
        telemetry: {
          includeToolsContext: {
            weather: { weatherApiKey: true },
            db: { dbUrl: false },
          },
        },
      });
    });

    it('should reject unknown includeToolsContext keys', async () => {
      new ToolLoopAgent<never, typeof twoToolsWithContext>({
        model: new MockLanguageModelV4(),
        tools: twoToolsWithContext,
        toolsContext: {
          weather: { weatherApiKey: 'key' },
          db: { dbUrl: 'url' },
        },
        telemetry: {
          includeToolsContext: {
            weather: {
              // @ts-expect-error includeToolsContext only supports tool context properties
              unknown: true,
            },
          },
        },
      });
    });

    it('should reject unknown includeRuntimeContext keys', async () => {
      new ToolLoopAgent<never, {}, { userId: string }>({
        model: new MockLanguageModelV4(),
        runtimeContext: { userId: 'user-123' },
        telemetry: {
          includeRuntimeContext: {
            // @ts-expect-error includeRuntimeContext only supports runtimeContext properties
            unknown: true,
          },
        },
      });
    });

    describe('prepareStep', () => {
      it('should expose default runtimeContext type', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toEqualTypeOf<Context>();
            expectTypeOf(toolsContext).toEqualTypeOf<{}>();

            return {};
          },
        });
      });

      it('should accept empty runtimeContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          runtimeContext: {},
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toEqualTypeOf<{}>();
            expectTypeOf(toolsContext).toEqualTypeOf<{}>();

            return {};
          },
        });
      });

      it('should accept arbitrary runtimeContext', async () => {
        new ToolLoopAgent<never, {}, { someValue: string }>({
          model: new MockLanguageModelV4(),
          runtimeContext: { someValue: 'value' },
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toMatchObjectType<{
              someValue: string;
            }>();
            expectTypeOf(toolsContext).toEqualTypeOf<{}>();

            return {};
          },
        });
      });

      it('should accept user runtimeContext', async () => {
        const agent = new ToolLoopAgent<never, {}, { telemetryId: string }>({
          model: new MockLanguageModelV4(),
          runtimeContext: { telemetryId: '123' },
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toMatchObjectType<{
              telemetryId: string;
            }>();
            expectTypeOf(toolsContext).toEqualTypeOf<{}>();

            return {};
          },
        });

        await agent.stream({
          prompt: 'Hello',
          onFinish: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toMatchObjectType<{
              telemetryId: string;
            }>();
            expectTypeOf(toolsContext).toEqualTypeOf<{}>();
          },
        });
      });
    });

    describe('prepareCall', () => {
      it('should expose includeRuntimeContext type', async () => {
        new ToolLoopAgent<never, {}, { userId: string; requestId: string }>({
          model: new MockLanguageModelV4(),
          runtimeContext: { userId: 'user-123', requestId: 'request-123' },
          telemetry: {
            includeRuntimeContext: { userId: true },
          },
          prepareCall: options => {
            expectTypeOf(
              options.telemetry?.includeRuntimeContext,
            ).toEqualTypeOf<
              | {
                  userId?: boolean | undefined;
                  requestId?: boolean | undefined;
                }
              | undefined
            >();

            return {
              ...options,
              prompt: 'Hello, world!',
            };
          },
        });
      });
    });
  });

  describe('toolsContext', () => {
    describe('no tools', () => {
      it('should reject toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          // @ts-expect-error toolsContext is not accepted when no tools are provided
          toolsContext: {},
        });
      });
    });

    describe('single tool without contextSchema', () => {
      it('should reject toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: toolWithoutContext,
          // @ts-expect-error toolsContext is not accepted when no tools require it
          toolsContext: {},
        });
      });
    });

    describe('two tools with contextSchema', () => {
      it('should reject no toolsContext', async () => {
        // @ts-expect-error toolsContext is required when tools have contextSchema
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: twoToolsWithContext,
        });
      });

      it('should reject empty toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: twoToolsWithContext,
          // @ts-expect-error missing required weather and db tool contexts
          toolsContext: {},
        });
      });

      it('should reject wrong toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: twoToolsWithContext,
          // @ts-expect-error missing required weather and db tool contexts
          toolsContext: { wrong: 'value' },
        });
      });

      it('should accept valid toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: twoToolsWithContext,
          toolsContext: {
            weather: { weatherApiKey: 'key' },
            db: { dbUrl: 'url' },
          },
        });
      });
    });

    describe('mixed tools', () => {
      it('should reject no toolsContext', async () => {
        // @ts-expect-error toolsContext is required when at least one tool has contextSchema
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: mixedTools,
        });
      });

      it('should reject empty toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: mixedTools,
          // @ts-expect-error missing required weather tool context
          toolsContext: {},
        });
      });

      it('should reject wrong toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: mixedTools,
          // @ts-expect-error missing required weather tool context
          toolsContext: { wrong: 'value' },
        });
      });

      it('should accept valid toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: mixedTools,
          toolsContext: { weather: { weatherApiKey: 'key' } },
        });
      });
    });

    describe('prepareStep', () => {
      it('should expose toolsContext separately in prepareStep', async () => {
        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: mixedTools,
          toolsContext: { weather: { weatherApiKey: 'key' } },
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toEqualTypeOf<Context>();
            expectTypeOf(toolsContext).toEqualTypeOf<{
              weather: {
                weatherApiKey: string;
              };
            }>();

            return {};
          },
        });

        await agent.generate({
          prompt: 'Hello',
          onFinish: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toEqualTypeOf<Context>();
            expectTypeOf(toolsContext).toEqualTypeOf<{
              weather: {
                weatherApiKey: string;
              };
            }>();
          },
        });
      });

      it('should reject empty toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: mixedTools,
          // @ts-expect-error missing required weather tool context
          toolsContext: {},
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toEqualTypeOf<Context>();
            expectTypeOf(toolsContext).toEqualTypeOf<{
              weather: {
                weatherApiKey: string;
              };
            }>();

            return {};
          },
        });
      });

      it('should reject wrong toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          tools: mixedTools,
          // @ts-expect-error missing required weather.weatherApiKey
          toolsContext: { weather: { wrong: 'value' } },
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toEqualTypeOf<Context>();
            expectTypeOf(toolsContext).toEqualTypeOf<{
              weather: {
                weatherApiKey: string;
              };
            }>();

            return {};
          },
        });
      });
    });

    describe('no tools with prepareStep', () => {
      it('should reject toolsContext', async () => {
        new ToolLoopAgent({
          model: new MockLanguageModelV4(),
          // @ts-expect-error toolsContext is not accepted when no tools are provided
          toolsContext: {},
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toEqualTypeOf<Context>();
            expectTypeOf(toolsContext).toEqualTypeOf<{}>();

            return {};
          },
        });
      });
    });
  });
});
