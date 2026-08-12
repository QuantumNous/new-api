import type { JSONValue } from '@ai-sdk/provider';
import {
  tool,
  type Context,
  type ModelMessage,
  type Tool,
} from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { Output, streamText } from '../generate-text';
import type { Instructions } from '../prompt';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import type { UIMessage } from '../ui';
import type {
  UIMessageStreamOnEndCallback,
  UIMessageStreamOnFinishCallback,
} from '../ui-message-stream';
import type { AsyncIterableStream } from '../util';
import type { DeepPartial } from '../util/deep-partial';
import type { GenerateTextEndEvent } from './generate-text-events';
import type { ResponseMessage } from './response-message';
import type { StepResult } from './step-result';

describe('streamText types', () => {
  describe('onEnd', () => {
    it('should expose end event properties', () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        onEnd: event => {
          expectTypeOf(event).toMatchTypeOf<GenerateTextEndEvent>();
          expectTypeOf(event.totalUsage).toEqualTypeOf<
            GenerateTextEndEvent['usage']
          >();
          expectTypeOf(event.reasoning).toEqualTypeOf<
            StepResult<any>['reasoning']
          >();
          expectTypeOf(event.reasoningText).toEqualTypeOf<string | undefined>();
          expectTypeOf(event.request).toEqualTypeOf<
            StepResult<any>['request']
          >();
          expectTypeOf(event.response).toEqualTypeOf<
            StepResult<any>['response']
          >();
          expectTypeOf(event.providerMetadata).toEqualTypeOf<
            StepResult<any>['providerMetadata']
          >();
        },
      });
    });
  });

  describe('onFinish compatibility', () => {
    it('should expose deprecated AI SDK 6 properties', () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        onFinish: event => {
          expectTypeOf(event).toMatchTypeOf<GenerateTextEndEvent>();
          expectTypeOf(event.totalUsage).toEqualTypeOf<
            GenerateTextEndEvent['usage']
          >();
          expectTypeOf(event.reasoning).toEqualTypeOf<
            StepResult<any>['reasoning']
          >();
          expectTypeOf(event.reasoningText).toEqualTypeOf<string | undefined>();
          expectTypeOf(event.request).toEqualTypeOf<
            StepResult<any>['request']
          >();
          expectTypeOf(event.response).toEqualTypeOf<
            StepResult<any>['response']
          >();
          expectTypeOf(event.providerMetadata).toEqualTypeOf<
            StepResult<any>['providerMetadata']
          >();
        },
      });
    });
  });

  describe('toUIMessageStream options', () => {
    it('should support onEnd and deprecated onFinish', () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
      });

      result.toUIMessageStream({
        onEnd: event => {
          expectTypeOf(event).toMatchTypeOf<
            Parameters<UIMessageStreamOnEndCallback<UIMessage>>[0]
          >();
        },
      });

      result.toUIMessageStream({
        onFinish: event => {
          expectTypeOf(event).toMatchTypeOf<
            Parameters<UIMessageStreamOnFinishCallback<UIMessage>>[0]
          >();
        },
      });
    });
  });

  describe('output', () => {
    it('should infer text output type (default)', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
      });

      expectTypeOf<typeof result.output>().toEqualTypeOf<PromiseLike<string>>();
    });

    it('should infer text output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.text(),
      });

      expectTypeOf<typeof result.output>().toEqualTypeOf<PromiseLike<string>>();
    });

    it('should infer object output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.object({ schema: z.object({ value: z.string() }) }),
      });

      expectTypeOf<typeof result.output>().toEqualTypeOf<
        PromiseLike<{ value: string }>
      >();
    });

    it('should infer array output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.array({ element: z.string() }),
      });

      expectTypeOf<typeof result.output>().toEqualTypeOf<
        PromiseLike<string[]>
      >();
    });

    it('should infer choice output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.choice({ options: ['a', 'b', 'c'] as const }),
      });

      expectTypeOf<typeof result.output>().toEqualTypeOf<
        PromiseLike<'a' | 'b' | 'c'>
      >();
    });

    it('should infer json output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.json(),
      });

      expectTypeOf<typeof result.output>().toEqualTypeOf<
        PromiseLike<JSONValue>
      >();
    });
  });

  describe('partialOutputStream', () => {
    it('should infer text partial output type (default)', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
      });

      expectTypeOf<typeof result.partialOutputStream>().toEqualTypeOf<
        AsyncIterableStream<string>
      >();
    });

    it('should infer text partial output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.text(),
      });

      expectTypeOf<typeof result.partialOutputStream>().toEqualTypeOf<
        AsyncIterableStream<string>
      >();
    });

    it('should infer object partial output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.object({ schema: z.object({ value: z.string() }) }),
      });

      expectTypeOf<typeof result.partialOutputStream>().toEqualTypeOf<
        AsyncIterableStream<DeepPartial<{ value: string }>>
      >();
    });

    it('should infer array partial output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.array({ element: z.string() }),
      });

      expectTypeOf<typeof result.partialOutputStream>().toEqualTypeOf<
        AsyncIterableStream<string[]>
      >();
    });

    it('should infer choice partial output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.choice({ options: ['a', 'b', 'c'] as const }),
      });

      expectTypeOf<typeof result.partialOutputStream>().toEqualTypeOf<
        AsyncIterableStream<'a' | 'b' | 'c'>
      >();
    });

    it('should infer json partial output type', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.json(),
      });

      expectTypeOf<typeof result.partialOutputStream>().toEqualTypeOf<
        AsyncIterableStream<JSONValue>
      >();
    });
  });

  describe('stream', () => {
    it('should infer stream part type', () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
      });

      const stream: AsyncIterableStream<unknown> = result.stream;

      expectTypeOf<typeof stream>().toEqualTypeOf<
        AsyncIterableStream<unknown>
      >();
    });
  });

  describe('elementStream', () => {
    it('should infer element type for array output', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.array({ element: z.object({ value: z.string() }) }),
      });

      expectTypeOf<typeof result.elementStream>().toEqualTypeOf<
        AsyncIterableStream<{ value: string }>
      >();
    });

    it('should infer never for text output', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.text(),
      });

      expectTypeOf<typeof result.elementStream>().toEqualTypeOf<
        AsyncIterableStream<never>
      >();
    });

    it('should infer never for object output', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
        output: Output.object({ schema: z.object({ value: z.string() }) }),
      });

      expectTypeOf<typeof result.elementStream>().toEqualTypeOf<
        AsyncIterableStream<never>
      >();
    });

    it('should infer never for default output', async () => {
      const result = streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello, world!',
      });

      expectTypeOf<typeof result.elementStream>().toEqualTypeOf<
        AsyncIterableStream<never>
      >();
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

  type ToolWithFullyOptionalContext = {
    weather: Tool<{ location: string }, never, { weatherApiKey?: string }>;
  };

  type ToolWithOptionalContextObject = {
    weather: Tool<
      { location: string },
      never,
      { weatherApiKey: string } | undefined
    >;
  };

  const toolWithFullyOptionalContext = {} as ToolWithFullyOptionalContext;
  const toolWithOptionalContextObject = {} as ToolWithOptionalContextObject;

  describe('experimental_refineToolInput', () => {
    it('should infer input and return types for each tool', async () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        tools: mixedTools,
        toolsContext: { weather: { weatherApiKey: 'key' } },
        experimental_refineToolInput: {
          weather: input => {
            expectTypeOf(input).toEqualTypeOf<{ location: string }>();
            return { location: input.location.trim() };
          },
          calculator: input => {
            expectTypeOf(input).toEqualTypeOf<{ expression: string }>();
            return { expression: input.expression.trim() };
          },
        },
      });
    });

    it('should reject refinements that return a different shape', async () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        tools: mixedTools,
        toolsContext: { weather: { weatherApiKey: 'key' } },
        experimental_refineToolInput: {
          // @ts-expect-error refinement must return the same tool input type
          weather: _input => ({
            location: 123,
          }),
        },
      });
    });

    it('should reject refinements for unknown tools', async () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        tools: mixedTools,
        toolsContext: { weather: { weatherApiKey: 'key' } },
        experimental_refineToolInput: {
          // @ts-expect-error unknown tool names are not accepted
          unknown: input => input,
        },
      });
    });
  });

  describe('runtimeContext', () => {
    it('should accept no runtimeContext', async () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
      });
    });

    it('should allow empty runtimeContext', async () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        runtimeContext: {},
      });
    });

    it('should accept user runtimeContext', async () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        runtimeContext: { telemetryId: '123' },
      });
    });

    it('should accept includeRuntimeContext for runtimeContext keys', async () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
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
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
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
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
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

    it('should expose original runtimeContext in callbacks', async () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        runtimeContext: { userId: 'user-123', requestId: 'request-123' },
        telemetry: {
          includeRuntimeContext: { userId: true },
        },
        onStart: ({ runtimeContext }) => {
          expectTypeOf(runtimeContext).toEqualTypeOf<{
            userId: string;
            requestId: string;
          }>();
        },
        onStepStart: ({ runtimeContext }) => {
          expectTypeOf(runtimeContext).toEqualTypeOf<{
            userId: string;
            requestId: string;
          }>();
        },
        onStepEnd: ({ runtimeContext }) => {
          expectTypeOf(runtimeContext).toEqualTypeOf<{
            userId: string;
            requestId: string;
          }>();
        },
        onFinish: ({ runtimeContext }) => {
          expectTypeOf(runtimeContext).toEqualTypeOf<{
            userId: string;
            requestId: string;
          }>();
        },
      });
    });

    it('should reject unknown includeRuntimeContext keys', async () => {
      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
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
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          prepareStep: ({
            instructions,
            initialInstructions,
            initialMessages,
            responseMessages,
            runtimeContext,
            toolsContext,
          }) => {
            expectTypeOf(instructions).toEqualTypeOf<
              Instructions | undefined
            >();
            expectTypeOf(initialInstructions).toEqualTypeOf<
              Instructions | undefined
            >();
            expectTypeOf(initialMessages).toEqualTypeOf<Array<ModelMessage>>();
            expectTypeOf(responseMessages).toEqualTypeOf<
              Array<ResponseMessage>
            >();
            expectTypeOf(runtimeContext).toEqualTypeOf<Context>();
            expectTypeOf(toolsContext).toEqualTypeOf<{}>();

            return {};
          },
        });
      });

      it('should accept empty runtimeContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          runtimeContext: {},
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toEqualTypeOf<{}>();
            expectTypeOf(toolsContext).toEqualTypeOf<{}>();

            return {};
          },
        });
      });

      it('should accept arbitrary runtimeContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
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
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          runtimeContext: { telemetryId: '123' },
          prepareStep: ({ runtimeContext, toolsContext }) => {
            expectTypeOf(runtimeContext).toMatchObjectType<{
              telemetryId: string;
            }>();
            expectTypeOf(toolsContext).toEqualTypeOf<{}>();

            return {};
          },
        });
      });

      it('should accept sandbox overrides', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          prepareStep: () => ({
            experimental_sandbox: {
              description: 'test sandbox',
              run: async () => ({
                exitCode: 0,
                stdout: 'ok',
                stderr: '',
              }),
              readFile: async () => null,
              readBinaryFile: async () => null,
              readTextFile: async () => null,
              writeFile: async () => {},
              writeBinaryFile: async () => {},
              writeTextFile: async () => {},
              spawn: async () => ({
                stdout: new ReadableStream<Uint8Array>({
                  start: c => c.close(),
                }),
                stderr: new ReadableStream<Uint8Array>({
                  start: c => c.close(),
                }),
                wait: async () => ({ exitCode: 0 }),
                kill: async () => {},
              }),
            },
          }),
        });
      });
    });

    it('should pass the runtimeContext type into toolApproval callbacks', async () => {
      type RC = { tenantId: string };

      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        tools: mixedTools,
        toolsContext: { weather: { weatherApiKey: 'k' } },
        runtimeContext: { tenantId: 'acme' } as RC,
        toolApproval: ({ runtimeContext }) => {
          expectTypeOf(runtimeContext).toEqualTypeOf<RC>();
          return 'not-applicable';
        },
      });

      streamText({
        model: new MockLanguageModelV4(),
        prompt: 'Hello',
        tools: mixedTools,
        toolsContext: { weather: { weatherApiKey: 'k' } },
        runtimeContext: { tenantId: 'acme' } as RC,
        toolApproval: {
          weather: (_input, { runtimeContext }) => {
            expectTypeOf(runtimeContext).toEqualTypeOf<RC>();
            return 'not-applicable';
          },
        },
      });
    });
  });

  describe('toolsContext', () => {
    describe('no tools', () => {
      it('should reject toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          // @ts-expect-error toolsContext is not accepted when no tools are provided
          toolsContext: {},
        });
      });
    });

    describe('single tool without contextSchema', () => {
      it('should reject toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: toolWithoutContext,
          // @ts-expect-error toolsContext is not accepted when no tools require it
          toolsContext: {},
        });
      });
    });

    describe('single tool with fully optional contextSchema', () => {
      it('should reject no toolsContext', async () => {
        // @ts-expect-error toolsContext is required when a tool has contextSchema
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: toolWithFullyOptionalContext,
        });
      });

      it('should accept empty toolsContext entry', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: toolWithFullyOptionalContext,
          toolsContext: { weather: {} },
        });
      });
    });

    describe('single tool with optional context object', () => {
      it('should accept no toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: toolWithOptionalContextObject,
        });
      });

      it('should accept empty toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: toolWithOptionalContextObject,
          toolsContext: {},
        });
      });

      it('should accept undefined toolsContext entry', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: toolWithOptionalContextObject,
          toolsContext: { weather: undefined },
        });
      });

      it('should accept defined toolsContext entry', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: toolWithOptionalContextObject,
          toolsContext: { weather: { weatherApiKey: 'key' } },
        });
      });

      it('should reject missing required fields when context object is provided', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: toolWithOptionalContextObject,
          // @ts-expect-error missing required weather.weatherApiKey
          toolsContext: { weather: {} },
        });
      });
    });

    describe('two tools with contextSchema', () => {
      it('should reject no toolsContext', async () => {
        // @ts-expect-error toolsContext is required when tools have contextSchema
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: twoToolsWithContext,
        });
      });

      it('should reject empty toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: twoToolsWithContext,
          // @ts-expect-error missing required weather and db tool contexts
          toolsContext: {},
        });
      });

      it('should reject wrong toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: twoToolsWithContext,
          // @ts-expect-error missing required weather and db tool contexts
          toolsContext: { wrong: 'value' },
        });
      });

      it('should accept valid toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
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
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: mixedTools,
        });
      });

      it('should reject empty toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: mixedTools,
          // @ts-expect-error missing required weather tool context
          toolsContext: {},
        });
      });

      it('should reject wrong toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: mixedTools,
          // @ts-expect-error missing required weather tool context
          toolsContext: { wrong: 'value' },
        });
      });

      it('should accept valid toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
          tools: mixedTools,
          toolsContext: { weather: { weatherApiKey: 'key' } },
        });
      });
    });

    describe('prepareStep', () => {
      it('should expose toolsContext separately in prepareStep', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
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
      });

      it('should reject empty toolsContext', async () => {
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
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
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
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
        streamText({
          model: new MockLanguageModelV4(),
          prompt: 'Hello',
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
