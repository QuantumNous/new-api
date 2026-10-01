import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import {
  tool,
  type Experimental_SandboxSession as SandboxSession,
} from '@ai-sdk/provider-utils';
import {
  convertArrayToReadableStream,
  mockId,
} from '@ai-sdk/provider-utils/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSandboxSessionFileStubs } from '../test/mock-sandbox';
import { z } from 'zod/v4';
import type {
  GenerateTextOnEndCallback,
  GenerateTextOnStartCallback,
  GenerateTextOnStepStartCallback,
} from '../generate-text/generate-text-events';
import type {
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
} from '../generate-text/tool-execution-events';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { now } from '../util/now';
import { ToolLoopAgent } from './tool-loop-agent';

// mock now function
vi.mock('../util/now', () => ({
  now: vi.fn(),
}));

const mockNow = vi.mocked(now);

const testSettings = {
  _internal: {
    generateId: mockId({ prefix: 'id' }),
    generateCallId: mockId({ prefix: 'call' }),
  },
};

describe('ToolLoopAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNow.mockReturnValue(0);
  });

  describe('generate', () => {
    let doGenerateOptions: LanguageModelV4CallOptions | undefined;
    let mockModel: MockLanguageModelV4;

    beforeEach(() => {
      doGenerateOptions = undefined;
      mockModel = new MockLanguageModelV4({
        doGenerate: async options => {
          doGenerateOptions = options;
          return {
            content: [{ type: 'text', text: 'reply' }],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              cachedInputTokens: undefined,
              inputTokens: {
                total: 3,
                noCache: 3,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: {
                total: 10,
                text: 10,
                reasoning: undefined,
              },
            },
            warnings: [],
          };
        },
      });
    });

    it('should use prepareCall', async () => {
      const agent = new ToolLoopAgent<{ value: string }>({
        model: mockModel,
        prepareCall: ({ options, ...rest }) => {
          return {
            ...rest,
            providerOptions: {
              test: { value: options.value },
            },
          };
        },
      });

      await agent.generate({
        prompt: 'Hello, world!',
        options: { value: 'test' },
      });

      expect(doGenerateOptions?.providerOptions).toMatchInlineSnapshot(`
        {
          "test": {
            "value": "test",
          },
        }
      `);
    });

    it('should tag the user-agent with the agent identifier', async () => {
      const agent = new ToolLoopAgent({ model: mockModel });

      await agent.generate({ prompt: 'Hello, world!' });

      expect(doGenerateOptions?.headers?.['user-agent']).toContain(
        'ai-sdk-agent/tool-loop',
      );
    });

    it('should preserve a caller-provided user-agent', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        headers: { 'user-agent': 'my-app/1.0' },
      });

      await agent.generate({ prompt: 'Hello, world!' });

      const ua = doGenerateOptions?.headers?.['user-agent'] ?? '';
      expect(ua).toContain('my-app/1.0');
      expect(ua).toContain('ai-sdk-agent/tool-loop');
    });

    it('should forward toolOrder to generateText', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        tools: {
          zebra: tool({
            inputSchema: z.object({}),
          }),
          alpha: tool({
            inputSchema: z.object({}),
          }),
          middle: tool({
            inputSchema: z.object({}),
          }),
        },
        toolOrder: ['middle'],
      });

      await agent.generate({ prompt: 'Hello, world!' });

      expect(doGenerateOptions?.tools?.map(tool => tool.name)).toEqual([
        'middle',
        'alpha',
        'zebra',
      ]);
    });

    it('should pass sandbox to prepareCall', async () => {
      const sandbox = {
        description: 'test sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      let recordedSandbox: SandboxSession | undefined;

      const agent = new ToolLoopAgent({
        model: mockModel,
        prepareCall: options => {
          recordedSandbox = options.experimental_sandbox;

          return options;
        },
      });

      await agent.generate({
        prompt: 'Hello, world!',
        experimental_sandbox: sandbox,
      });

      expect(recordedSandbox).toBe(sandbox);
    });

    it('should pass abortSignal to generateText', async () => {
      const abortController = new AbortController();

      const agent = new ToolLoopAgent({ model: mockModel });

      await agent.generate({
        prompt: 'Hello, world!',
        abortSignal: abortController.signal,
      });

      expect(doGenerateOptions?.abortSignal).toBe(abortController.signal);
    });

    it('should allow system messages when allowSystemInMessages is true', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        allowSystemInMessages: true,
      });

      await agent.generate({
        messages: [{ role: 'system', content: 'SYSTEM INSTRUCTIONS' }],
      });

      expect(doGenerateOptions?.prompt).toEqual([
        { role: 'system', content: 'SYSTEM INSTRUCTIONS' },
      ]);
    });

    it('should allow prepareCall to return allowSystemInMessages', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        prepareCall: ({ ...rest }) => ({
          ...rest,
          allowSystemInMessages: true,
        }),
      });

      await agent.generate({
        messages: [{ role: 'system', content: 'SYSTEM INSTRUCTIONS' }],
      });

      expect(doGenerateOptions?.prompt).toEqual([
        { role: 'system', content: 'SYSTEM INSTRUCTIONS' },
      ]);
    });

    it('should reject system messages when allowSystemInMessages is not set', async () => {
      const agent = new ToolLoopAgent({ model: mockModel });

      await expect(
        agent.generate({
          messages: [{ role: 'system', content: 'SYSTEM INSTRUCTIONS' }],
        }),
      ).rejects.toThrow(/system messages are not allowed/i);
    });

    it('should pass timeout to generateText', async () => {
      const agent = new ToolLoopAgent({ model: mockModel });

      await agent.generate({
        prompt: 'Hello, world!',
        timeout: 5000,
      });

      // timeout is merged into abortSignal, so we check that an abort signal was created
      expect(doGenerateOptions?.abortSignal).toBeDefined();
    });

    it('should pass sandbox to tool execution', async () => {
      const sandbox = {
        description: 'test sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      let recordedSandbox: SandboxSession | undefined;
      let modelCallCount = 0;

      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            modelCallCount++;

            if (modelCallCount === 1) {
              return {
                content: [
                  {
                    type: 'tool-call' as const,
                    toolCallType: 'function' as const,
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{ "value": "test" }',
                  },
                ],
                finishReason: {
                  unified: 'tool-calls' as const,
                  raw: undefined,
                },
                usage: {
                  cachedInputTokens: undefined,
                  inputTokens: {
                    total: 3,
                    noCache: 3,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 10,
                    text: 10,
                    reasoning: undefined,
                  },
                },
                warnings: [],
              };
            }

            return {
              content: [{ type: 'text' as const, text: 'done' }],
              finishReason: { unified: 'stop' as const, raw: 'stop' },
              usage: {
                cachedInputTokens: undefined,
                inputTokens: {
                  total: 3,
                  noCache: 3,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 10,
                  text: 10,
                  reasoning: undefined,
                },
              },
              warnings: [],
            };
          },
        }),
        tools: {
          testTool: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }, { experimental_sandbox: sandbox }) => {
              recordedSandbox = sandbox;
              return value;
            },
          }),
        },
      });

      await agent.generate({
        prompt: 'test',
        experimental_sandbox: sandbox,
      });

      expect(recordedSandbox).toBe(sandbox);
    });

    it('should pass experimental_download to generateText', async () => {
      const downloadFunction = vi
        .fn()
        .mockResolvedValue([
          { data: new Uint8Array([1, 2, 3]), mediaType: 'image/png' },
        ]);

      const agent = new ToolLoopAgent({
        model: mockModel,
        experimental_download: downloadFunction,
      });

      await agent.generate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: new URL('https://example.com/image.png'),
              },
            ],
          },
        ],
      });

      expect(downloadFunction).toHaveBeenCalledWith([
        {
          url: new URL('https://example.com/image.png'),
          isUrlSupportedByModel: false,
        },
      ]);
    });

    describe('instructions', () => {
      it('should pass string instructions', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          instructions: 'INSTRUCTIONS',
        });

        await agent.generate({
          prompt: 'Hello, world!',
        });

        expect(doGenerateOptions?.prompt).toMatchInlineSnapshot(`
          [
            {
              "content": "INSTRUCTIONS",
              "role": "system",
            },
            {
              "content": [
                {
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "providerOptions": undefined,
              "role": "user",
            },
          ]
        `);
      });

      it('should pass system message instructions', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          instructions: {
            role: 'system',
            content: 'INSTRUCTIONS',
            providerOptions: { test: { value: 'test' } },
          },
        });

        await agent.generate({
          prompt: 'Hello, world!',
        });

        expect(doGenerateOptions?.prompt).toMatchInlineSnapshot(`
        [
          {
            "content": "INSTRUCTIONS",
            "providerOptions": {
              "test": {
                "value": "test",
              },
            },
            "role": "system",
          },
          {
            "content": [
              {
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "providerOptions": undefined,
            "role": "user",
          },
        ]
      `);
      });

      it('should pass array of system message instructions', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          instructions: [
            {
              role: 'system',
              content: 'INSTRUCTIONS',
              providerOptions: { test: { value: 'test' } },
            },
            {
              role: 'system',
              content: 'INSTRUCTIONS 2',
              providerOptions: { test: { value: 'test 2' } },
            },
          ],
        });

        await agent.generate({
          prompt: 'Hello, world!',
        });

        expect(doGenerateOptions?.prompt).toMatchInlineSnapshot(`
          [
            {
              "content": "INSTRUCTIONS",
              "providerOptions": {
                "test": {
                  "value": "test",
                },
              },
              "role": "system",
            },
            {
              "content": "INSTRUCTIONS 2",
              "providerOptions": {
                "test": {
                  "value": "test 2",
                },
              },
              "role": "system",
            },
            {
              "content": [
                {
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "providerOptions": undefined,
              "role": "user",
            },
          ]
        `);
      });
    });

    describe('LanguageModelCallOptions forwarding', () => {
      it('should forward temperature to generateText', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          temperature: 0.5,
        });

        await agent.generate({ prompt: 'test' });

        expect(doGenerateOptions?.temperature).toBe(0.5);
      });

      it('should forward maxOutputTokens to generateText', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          maxOutputTokens: 256,
        });

        await agent.generate({ prompt: 'test' });

        expect(doGenerateOptions?.maxOutputTokens).toBe(256);
      });

      it('should forward topP to generateText', async () => {
        const agent = new ToolLoopAgent({ model: mockModel, topP: 0.9 });

        await agent.generate({ prompt: 'test' });

        expect(doGenerateOptions?.topP).toBe(0.9);
      });

      it('should forward topK to generateText', async () => {
        const agent = new ToolLoopAgent({ model: mockModel, topK: 40 });

        await agent.generate({ prompt: 'test' });

        expect(doGenerateOptions?.topK).toBe(40);
      });

      it('should forward presencePenalty to generateText', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          presencePenalty: 0.1,
        });

        await agent.generate({ prompt: 'test' });

        expect(doGenerateOptions?.presencePenalty).toBe(0.1);
      });

      it('should forward frequencyPenalty to generateText', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          frequencyPenalty: 0.2,
        });

        await agent.generate({ prompt: 'test' });

        expect(doGenerateOptions?.frequencyPenalty).toBe(0.2);
      });

      it('should forward stopSequences to generateText', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          stopSequences: ['STOP', 'END'],
        });

        await agent.generate({ prompt: 'test' });

        expect(doGenerateOptions?.stopSequences).toEqual(['STOP', 'END']);
      });

      it('should forward seed to generateText', async () => {
        const agent = new ToolLoopAgent({ model: mockModel, seed: 42 });

        await agent.generate({ prompt: 'test' });

        expect(doGenerateOptions?.seed).toBe(42);
      });
    });

    describe('RequestOptions forwarding', () => {
      it('should forward headers to generateText', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          headers: { 'x-custom': 'value' },
        });

        await agent.generate({ prompt: 'test' });

        expect(doGenerateOptions?.headers).toMatchObject({
          'x-custom': 'value',
        });
      });

      it('should forward include to generateText', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
          include: { requestMessages: true },
        });

        const result = await agent.generate({ prompt: 'test' });

        expect(result.request.messages).toStrictEqual([
          { role: 'user', content: 'test' },
        ]);
      });

      it('should honor toolApproval in generate', async () => {
        let modelCallCount = 0;
        const execute = vi.fn(async () => 'tool-result');

        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doGenerate: async () => {
              modelCallCount++;

              if (modelCallCount === 1) {
                return {
                  content: [
                    {
                      type: 'tool-call' as const,
                      toolCallType: 'function' as const,
                      toolCallId: 'call-1',
                      toolName: 'testTool',
                      input: '{ "value": "test" }',
                    },
                  ],
                  finishReason: {
                    unified: 'tool-calls' as const,
                    raw: undefined,
                  },
                  usage: {
                    cachedInputTokens: undefined,
                    inputTokens: {
                      total: 3,
                      noCache: 3,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 10,
                      text: 10,
                      reasoning: undefined,
                    },
                  },
                  warnings: [],
                };
              }

              return {
                content: [{ type: 'text' as const, text: 'done' }],
                finishReason: { unified: 'stop' as const, raw: 'stop' },
                usage: {
                  cachedInputTokens: undefined,
                  inputTokens: {
                    total: 3,
                    noCache: 3,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 10,
                    text: 10,
                    reasoning: undefined,
                  },
                },
                warnings: [],
              };
            },
          }),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute,
            }),
          },
          toolApproval: {
            testTool: 'user-approval',
          },
        });

        const result = await agent.generate({ prompt: 'test' });

        expect(modelCallCount).toBe(1);
        expect(execute).not.toHaveBeenCalled();
        expect(result.response.messages).toMatchObject([
          {
            role: 'assistant',
            content: [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'testTool' },
              { type: 'tool-approval-request', toolCallId: 'call-1' },
            ],
          },
        ]);
      });
    });
  });

  describe('stream', () => {
    let doStreamOptions: LanguageModelV4CallOptions | undefined;
    let mockModel: MockLanguageModelV4;

    beforeEach(() => {
      doStreamOptions = undefined;
      mockModel = new MockLanguageModelV4({
        doStream: async options => {
          doStreamOptions = options;
          return {
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-delta', id: '1', delta: ', ' },
              { type: 'text-delta', id: '1', delta: `world!` },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: {
                    total: 3,
                    noCache: 3,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 10,
                    text: 10,
                    reasoning: undefined,
                  },
                },
                providerMetadata: {
                  testProvider: { testKey: 'testValue' },
                },
              },
            ]),
          };
        },
      });
    });

    it('should use prepareCall', async () => {
      const agent = new ToolLoopAgent<{ value: string }>({
        model: mockModel,
        prepareCall: ({ options, ...rest }) => {
          return {
            ...rest,
            providerOptions: {
              test: { value: options.value },
            },
          };
        },
      });

      const result = await agent.stream({
        prompt: 'Hello, world!',
        options: { value: 'test' },
      });

      await result.consumeStream();

      expect(doStreamOptions?.providerOptions).toMatchInlineSnapshot(
        `
        {
          "test": {
            "value": "test",
          },
        }
      `,
      );
    });

    it('should forward toolOrder to streamText', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        tools: {
          zebra: tool({
            inputSchema: z.object({}),
          }),
          alpha: tool({
            inputSchema: z.object({}),
          }),
          middle: tool({
            inputSchema: z.object({}),
          }),
        },
        toolOrder: ['middle'],
      });

      const result = await agent.stream({ prompt: 'Hello, world!' });
      await result.consumeStream();

      expect(doStreamOptions?.tools?.map(tool => tool.name)).toEqual([
        'middle',
        'alpha',
        'zebra',
      ]);
    });

    it('should pass sandbox to prepareCall', async () => {
      const sandbox = {
        description: 'test sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      let recordedSandbox: SandboxSession | undefined;

      const agent = new ToolLoopAgent({
        model: mockModel,
        prepareCall: options => {
          recordedSandbox = options.experimental_sandbox;

          return options;
        },
      });

      const result = await agent.stream({
        prompt: 'Hello, world!',
        experimental_sandbox: sandbox,
      });
      await result.consumeStream();

      expect(recordedSandbox).toBe(sandbox);
    });

    it('should pass abortSignal to streamText', async () => {
      const abortController = new AbortController();

      const agent = new ToolLoopAgent({
        model: mockModel,
      });

      const result = await agent.stream({
        prompt: 'Hello, world!',
        abortSignal: abortController.signal,
      });

      await result.consumeStream();

      expect(doStreamOptions?.abortSignal).toBe(abortController.signal);
    });

    it('should pass timeout to streamText', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
      });

      const result = await agent.stream({
        prompt: 'Hello, world!',
        timeout: 5000,
      });

      await result.consumeStream();

      // timeout is merged into abortSignal, so we check that an abort signal was created
      expect(doStreamOptions?.abortSignal).toBeDefined();
    });

    it('should allow system messages when allowSystemInMessages is true', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        allowSystemInMessages: true,
      });

      const result = await agent.stream({
        messages: [{ role: 'system', content: 'SYSTEM INSTRUCTIONS' }],
      });

      await result.consumeStream();

      expect(doStreamOptions?.prompt).toEqual([
        { role: 'system', content: 'SYSTEM INSTRUCTIONS' },
      ]);
    });

    it('should allow prepareCall to return allowSystemInMessages', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        prepareCall: ({ ...rest }) => ({
          ...rest,
          allowSystemInMessages: true,
        }),
      });

      const result = await agent.stream({
        messages: [{ role: 'system', content: 'SYSTEM INSTRUCTIONS' }],
      });

      await result.consumeStream();

      expect(doStreamOptions?.prompt).toEqual([
        { role: 'system', content: 'SYSTEM INSTRUCTIONS' },
      ]);
    });

    it('should pass sandbox to tool execution', async () => {
      const sandbox = {
        description: 'test sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      let recordedSandbox: SandboxSession | undefined;
      let modelCallCount = 0;

      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4({
          doStream: async () => {
            modelCallCount++;

            if (modelCallCount === 1) {
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{ "value": "test" }',
                  },
                  {
                    type: 'finish',
                    finishReason: {
                      unified: 'tool-calls' as const,
                      raw: undefined,
                    },
                    usage: {
                      inputTokens: {
                        total: 3,
                        noCache: 3,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 10,
                        text: 10,
                        reasoning: undefined,
                      },
                    },
                    providerMetadata: {},
                  },
                ]),
              };
            }

            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'done' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop' as const, raw: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 3,
                      noCache: 3,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 10,
                      text: 10,
                      reasoning: undefined,
                    },
                  },
                  providerMetadata: {},
                },
              ]),
            };
          },
        }),
        tools: {
          testTool: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }, { experimental_sandbox: sandbox }) => {
              recordedSandbox = sandbox;
              return value;
            },
          }),
        },
      });

      const result = await agent.stream({
        prompt: 'test',
        experimental_sandbox: sandbox,
      });
      await result.consumeStream();

      expect(recordedSandbox).toBe(sandbox);
    });

    it('should forward include to streamText', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        include: { rawChunks: true },
      });

      const result = await agent.stream({
        prompt: 'Hello, world!',
      });

      await result.consumeStream();

      expect(doStreamOptions?.includeRawChunks).toBe(true);
    });

    it('should pass string instructions', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        instructions: 'INSTRUCTIONS',
      });

      const result = await agent.stream({
        prompt: 'Hello, world!',
      });

      await result.consumeStream();

      expect(doStreamOptions?.prompt).toMatchInlineSnapshot(`
        [
          {
            "content": "INSTRUCTIONS",
            "role": "system",
          },
          {
            "content": [
              {
                "text": "Hello, world!",
                "type": "text",
              },
            ],
            "providerOptions": undefined,
            "role": "user",
          },
        ]
      `);
    });

    it('should pass system message instructions', async () => {
      const agent = new ToolLoopAgent({
        model: mockModel,
        instructions: {
          role: 'system',
          content: 'INSTRUCTIONS',
          providerOptions: { test: { value: 'test' } },
        },
      });

      const result = await agent.stream({
        prompt: 'Hello, world!',
      });

      await result.consumeStream();

      expect(doStreamOptions?.prompt).toMatchInlineSnapshot(`
      [
        {
          "content": "INSTRUCTIONS",
          "providerOptions": {
            "test": {
              "value": "test",
            },
          },
          "role": "system",
        },
        {
          "content": [
            {
              "text": "Hello, world!",
              "type": "text",
            },
          ],
          "providerOptions": undefined,
          "role": "user",
        },
      ]
    `);
    });

    it('should honor toolApproval in stream', async () => {
      let modelCallCount = 0;
      const execute = vi.fn(async () => 'tool-result');

      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4({
          doStream: async () => {
            modelCallCount++;

            if (modelCallCount === 1) {
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{ "value": "test" }',
                  },
                  {
                    type: 'finish',
                    finishReason: {
                      unified: 'tool-calls' as const,
                      raw: undefined,
                    },
                    usage: {
                      inputTokens: {
                        total: 3,
                        noCache: 3,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 10,
                        text: 10,
                        reasoning: undefined,
                      },
                    },
                    providerMetadata: {},
                  },
                ]),
              };
            }

            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'done' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop' as const, raw: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 3,
                      noCache: 3,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 10,
                      text: 10,
                      reasoning: undefined,
                    },
                  },
                  providerMetadata: {},
                },
              ]),
            };
          },
        }),
        tools: {
          testTool: tool({
            inputSchema: z.object({ value: z.string() }),
            execute,
          }),
        },
        toolApproval: {
          testTool: 'user-approval',
        },
      });

      const result = await agent.stream({ prompt: 'test' });
      await result.consumeStream();

      expect(modelCallCount).toBe(1);
      expect(execute).not.toHaveBeenCalled();
      expect((await result.response).messages).toMatchObject([
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'testTool' },
            { type: 'tool-approval-request', toolCallId: 'call-1' },
          ],
        },
      ]);
    });
  });

  describe('onStart', () => {
    describe('generate', () => {
      let doGenerateOptions: LanguageModelV4CallOptions | undefined;
      let mockModel: MockLanguageModelV4;

      beforeEach(() => {
        doGenerateOptions = undefined;
        mockModel = new MockLanguageModelV4({
          doGenerate: async options => {
            doGenerateOptions = options;
            return {
              content: [{ type: 'text', text: 'reply' }],
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                cachedInputTokens: undefined,
                inputTokens: {
                  total: 3,
                  noCache: 3,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 10,
                  text: 10,
                  reasoning: undefined,
                },
              },
              warnings: [],
            };
          },
        });
      });

      it('should call onStart from constructor', async () => {
        const onStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStart: async () => {
            onStartCalls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'Hello, world!',
        });

        expect(onStartCalls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onStart from generate method', async () => {
        const onStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStart: async () => {
            onStartCalls.push('method');
          },
        });

        expect(onStartCalls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method onStart in correct order', async () => {
        const onStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStart: async () => {
            onStartCalls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStart: async () => {
            onStartCalls.push('method');
          },
        });

        expect(onStartCalls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should be called before doGenerate', async () => {
        const callOrder: string[] = [];

        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doGenerate: async () => {
              callOrder.push('doGenerate');
              return {
                content: [{ type: 'text', text: 'reply' }],
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  cachedInputTokens: undefined,
                  inputTokens: {
                    total: 3,
                    noCache: 3,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 10,
                    text: 10,
                    reasoning: undefined,
                  },
                },
                warnings: [],
              };
            },
          }),
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStart: async () => {
            callOrder.push('onStart');
          },
        });

        expect(callOrder).toMatchInlineSnapshot(`
          [
            "onStart",
            "doGenerate",
          ]
        `);
      });

      it('should not break generation when callback throws', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        const result = await agent.generate({
          prompt: 'Hello, world!',
          onStart: async () => {
            throw new Error('callback error');
          },
        });

        expect(result.text).toBe('reply');
      });

      it('should pass correct event information', async () => {
        let startEvent!: Parameters<
          GenerateTextOnStartCallback<{}, { userId: string }>
        >[0];

        const agent = new ToolLoopAgent({
          model: mockModel,
          instructions: 'You are a helpful assistant',
          temperature: 0.7,
          maxOutputTokens: 500,
          runtimeContext: { userId: 'test-user' },
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStart: async event => {
            startEvent = event;
          },
        });

        expect({
          provider: startEvent.provider,
          modelId: startEvent.modelId,
          instructions: startEvent.instructions,
          messages: startEvent.messages,
          temperature: startEvent.temperature,
          maxOutputTokens: startEvent.maxOutputTokens,
          runtimeContext: startEvent.runtimeContext,
        }).toMatchInlineSnapshot(`
          {
            "instructions": "You are a helpful assistant",
            "maxOutputTokens": 500,
            "messages": [
              {
                "content": "Hello, world!",
                "role": "user",
              },
            ],
            "modelId": "mock-model-id",
            "provider": "mock-provider",
            "runtimeContext": {
              "userId": "test-user",
            },
            "temperature": 0.7,
          }
        `);
      });

      it('should pass messages when using messages option', async () => {
        let startEvent!: Parameters<GenerateTextOnStartCallback<{}>>[0];

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        await agent.generate({
          messages: [{ role: 'user', content: 'test-message' }],
          onStart: async event => {
            startEvent = event;
          },
        });

        expect(startEvent.messages).toMatchInlineSnapshot(`
          [
            {
              "content": "test-message",
              "role": "user",
            },
          ]
        `);
      });
    });

    describe('stream', () => {
      let mockModel: MockLanguageModelV4;

      beforeEach(() => {
        mockModel = new MockLanguageModelV4({
          doStream: async () => {
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 3,
                      noCache: 3,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 10,
                      text: 10,
                      reasoning: undefined,
                    },
                  },
                  providerMetadata: {
                    testProvider: { testKey: 'testValue' },
                  },
                },
              ]),
            };
          },
        });
      });

      it('should call onStart from constructor', async () => {
        const onStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStart: async () => {
            onStartCalls.push('constructor');
          },
        });

        const result = await agent.stream({ prompt: 'Hello, world!' });
        await result.consumeStream();

        expect(onStartCalls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onStart from stream method', async () => {
        const onStartCalls: string[] = [];

        const agent = new ToolLoopAgent({ model: mockModel });

        const result = await agent.stream({
          prompt: 'Hello, world!',
          onStart: async () => {
            onStartCalls.push('method');
          },
        });

        await result.consumeStream();

        expect(onStartCalls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method onStart in correct order', async () => {
        const onStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStart: async () => {
            onStartCalls.push('constructor');
          },
        });

        const result = await agent.stream({
          prompt: 'Hello, world!',
          onStart: async () => {
            onStartCalls.push('method');
          },
        });

        await result.consumeStream();

        expect(onStartCalls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass correct event information', async () => {
        let startEvent!: Parameters<
          GenerateTextOnStartCallback<{}, { userId: string }>
        >[0];

        const agent = new ToolLoopAgent({
          model: mockModel,
          instructions: 'You are a helpful assistant',
          temperature: 0.7,
          maxOutputTokens: 500,
          runtimeContext: { userId: 'test-user' },
        });

        const result = await agent.stream({
          prompt: 'Hello, world!',
          onStart: async event => {
            startEvent = event;
          },
        });

        await result.consumeStream();

        expect({
          provider: startEvent.provider,
          modelId: startEvent.modelId,
          instructions: startEvent.instructions,
          messages: startEvent.messages,
          temperature: startEvent.temperature,
          maxOutputTokens: startEvent.maxOutputTokens,
          runtimeContext: startEvent.runtimeContext,
        }).toMatchInlineSnapshot(`
          {
            "instructions": "You are a helpful assistant",
            "maxOutputTokens": 500,
            "messages": [
              {
                "content": "Hello, world!",
                "role": "user",
              },
            ],
            "modelId": "mock-model-id",
            "provider": "mock-provider",
            "runtimeContext": {
              "userId": "test-user",
            },
            "temperature": 0.7,
          }
        `);
      });
    });
  });

  describe('onStepStart', () => {
    describe('generate', () => {
      let mockModel: MockLanguageModelV4;

      beforeEach(() => {
        mockModel = new MockLanguageModelV4({
          doGenerate: async () => {
            return {
              content: [{ type: 'text', text: 'reply' }],
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                cachedInputTokens: undefined,
                inputTokens: {
                  total: 3,
                  noCache: 3,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 10,
                  text: 10,
                  reasoning: undefined,
                },
              },
              warnings: [],
            };
          },
        });
      });

      it('should call onStepStart from constructor', async () => {
        const onStepStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepStart: async () => {
            onStepStartCalls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'Hello, world!',
        });

        expect(onStepStartCalls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onStepStart from generate method', async () => {
        const onStepStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStepStart: async () => {
            onStepStartCalls.push('method');
          },
        });

        expect(onStepStartCalls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method onStepStart in correct order', async () => {
        const onStepStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepStart: async () => {
            onStepStartCalls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStepStart: async () => {
            onStepStartCalls.push('method');
          },
        });

        expect(onStepStartCalls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should be called before doGenerate', async () => {
        const callOrder: string[] = [];

        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doGenerate: async () => {
              callOrder.push('doGenerate');
              return {
                content: [{ type: 'text', text: 'reply' }],
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  cachedInputTokens: undefined,
                  inputTokens: {
                    total: 3,
                    noCache: 3,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 10,
                    text: 10,
                    reasoning: undefined,
                  },
                },
                warnings: [],
              };
            },
          }),
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStepStart: async () => {
            callOrder.push('onStepStart');
          },
        });

        expect(callOrder).toMatchInlineSnapshot(`
          [
            "onStepStart",
            "doGenerate",
          ]
        `);
      });

      it('should not break generation when callback throws', async () => {
        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        const result = await agent.generate({
          prompt: 'Hello, world!',
          onStepStart: async () => {
            throw new Error('callback error');
          },
        });

        expect(result.text).toBe('reply');
      });

      it('should pass correct event information', async () => {
        let stepStartEvent!: Parameters<
          GenerateTextOnStepStartCallback<{}, { userId: string }>
        >[0];

        const agent = new ToolLoopAgent({
          model: mockModel,
          instructions: 'You are a helpful assistant',
          runtimeContext: { userId: 'test-user' },
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStepStart: async event => {
            stepStartEvent = event;
          },
        });

        expect({
          stepNumber: stepStartEvent.steps.length,
          provider: stepStartEvent.provider,
          modelId: stepStartEvent.modelId,
          instructions: stepStartEvent.instructions,
          messagesLength: stepStartEvent.messages.length,
          steps: stepStartEvent.steps,
          runtimeContext: stepStartEvent.runtimeContext,
        }).toMatchInlineSnapshot(`
          {
            "instructions": "You are a helpful assistant",
            "messagesLength": 1,
            "modelId": "mock-model-id",
            "provider": "mock-provider",
            "runtimeContext": {
              "userId": "test-user",
            },
            "stepNumber": 0,
            "steps": [],
          }
        `);
      });
    });

    describe('stream', () => {
      let mockModel: MockLanguageModelV4;

      beforeEach(() => {
        mockModel = new MockLanguageModelV4({
          doStream: async () => {
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 3,
                      noCache: 3,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 10,
                      text: 10,
                      reasoning: undefined,
                    },
                  },
                  providerMetadata: {
                    testProvider: { testKey: 'testValue' },
                  },
                },
              ]),
            };
          },
        });
      });

      it('should call onStepStart from constructor', async () => {
        const onStepStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepStart: async () => {
            onStepStartCalls.push('constructor');
          },
        });

        const result = await agent.stream({ prompt: 'Hello, world!' });
        await result.consumeStream();

        expect(onStepStartCalls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onStepStart from stream method', async () => {
        const onStepStartCalls: string[] = [];

        const agent = new ToolLoopAgent({ model: mockModel });

        const result = await agent.stream({
          prompt: 'Hello, world!',
          onStepStart: async () => {
            onStepStartCalls.push('method');
          },
        });

        await result.consumeStream();

        expect(onStepStartCalls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method onStepStart in correct order', async () => {
        const onStepStartCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepStart: async () => {
            onStepStartCalls.push('constructor');
          },
        });

        const result = await agent.stream({
          prompt: 'Hello, world!',
          onStepStart: async () => {
            onStepStartCalls.push('method');
          },
        });

        await result.consumeStream();

        expect(onStepStartCalls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass correct event information', async () => {
        let stepStartEvent!: Parameters<
          GenerateTextOnStepStartCallback<{}, { userId: string }>
        >[0];

        const agent = new ToolLoopAgent({
          model: mockModel,
          instructions: 'You are a helpful assistant',
          runtimeContext: { userId: 'test-user' },
        });

        const result = await agent.stream({
          prompt: 'Hello, world!',
          onStepStart: async event => {
            stepStartEvent = event;
          },
        });

        await result.consumeStream();

        expect({
          stepNumber: stepStartEvent.steps.length,
          provider: stepStartEvent.provider,
          modelId: stepStartEvent.modelId,
          instructions: stepStartEvent.instructions,
          messagesLength: stepStartEvent.messages.length,
          steps: stepStartEvent.steps,
          runtimeContext: stepStartEvent.runtimeContext,
        }).toMatchInlineSnapshot(`
          {
            "instructions": "You are a helpful assistant",
            "messagesLength": 1,
            "modelId": "mock-model-id",
            "provider": "mock-provider",
            "runtimeContext": {
              "userId": "test-user",
            },
            "stepNumber": 0,
            "steps": [],
          }
        `);
      });
    });
  });

  describe('onStepFinish', () => {
    describe('generate', () => {
      let mockModel: MockLanguageModelV4;

      beforeEach(() => {
        mockModel = new MockLanguageModelV4({
          doGenerate: async () => {
            return {
              content: [{ type: 'text', text: 'reply' }],
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                cachedInputTokens: undefined,
                inputTokens: {
                  total: 3,
                  noCache: 3,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 10,
                  text: 10,
                  reasoning: undefined,
                },
              },
              warnings: [],
            };
          },
        });
      });

      it('should call onStepEnd from constructor and generate method in order', async () => {
        const onStepEndCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepEnd: async () => {
            onStepEndCalls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStepEnd: async () => {
            onStepEndCalls.push('method');
          },
        });

        expect(onStepEndCalls).toEqual(['constructor', 'method']);
      });

      it('should prefer onStepEnd over deprecated onStepFinish', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepEnd: async () => {
            calls.push('constructor-onStepEnd');
          },
          onStepFinish: async () => {
            calls.push('constructor-onStepFinish');
          },
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStepEnd: async () => {
            calls.push('method-onStepEnd');
          },
          onStepFinish: async () => {
            calls.push('method-onStepFinish');
          },
        });

        expect(calls).toEqual(['constructor-onStepEnd', 'method-onStepEnd']);
      });

      it('should call onStepFinish from constructor', async () => {
        const onStepFinishCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepFinish: async () => {
            onStepFinishCalls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'Hello, world!',
        });

        expect(onStepFinishCalls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onStepFinish from generate method', async () => {
        const onStepFinishCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStepFinish: async () => {
            onStepFinishCalls.push('method');
          },
        });

        expect(onStepFinishCalls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method onStepFinish in correct order', async () => {
        const onStepFinishCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepFinish: async () => {
            onStepFinishCalls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStepFinish: async () => {
            onStepFinishCalls.push('method');
          },
        });

        expect(onStepFinishCalls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass stepResult to onStepFinish callback', async () => {
        let capturedStepResult: any;

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        await agent.generate({
          prompt: 'Hello, world!',
          onStepFinish: async stepResult => {
            capturedStepResult = stepResult;
          },
        });

        expect({
          finishReason: capturedStepResult.finishReason,
          stepNumber: capturedStepResult.stepNumber,
          text: capturedStepResult.text,
          inputTokens: capturedStepResult.usage.inputTokens,
          outputTokens: capturedStepResult.usage.outputTokens,
        }).toMatchInlineSnapshot(`
          {
            "finishReason": "stop",
            "inputTokens": 3,
            "outputTokens": 10,
            "stepNumber": 0,
            "text": "reply",
          }
        `);
      });
    });

    describe('stream', () => {
      let mockModel: MockLanguageModelV4;

      beforeEach(() => {
        mockModel = new MockLanguageModelV4({
          doStream: async () => {
            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: `world!` },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 3,
                      noCache: 3,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 10,
                      text: 10,
                      reasoning: undefined,
                    },
                  },
                  providerMetadata: {
                    testProvider: { testKey: 'testValue' },
                  },
                },
              ]),
            };
          },
        });
      });

      it('should call onStepFinish from constructor', async () => {
        const onStepFinishCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepFinish: async () => {
            onStepFinishCalls.push('constructor');
          },
        });

        const result = await agent.stream({
          prompt: 'Hello, world!',
        });

        await result.consumeStream();

        expect(onStepFinishCalls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onStepFinish from stream method', async () => {
        const onStepFinishCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        const result = await agent.stream({
          prompt: 'Hello, world!',
          onStepFinish: async () => {
            onStepFinishCalls.push('method');
          },
        });

        await result.consumeStream();

        expect(onStepFinishCalls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method onStepFinish in correct order', async () => {
        const onStepFinishCalls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onStepFinish: async () => {
            onStepFinishCalls.push('constructor');
          },
        });

        const result = await agent.stream({
          prompt: 'Hello, world!',
          onStepFinish: async () => {
            onStepFinishCalls.push('method');
          },
        });

        await result.consumeStream();

        expect(onStepFinishCalls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass stepResult to onStepFinish callback', async () => {
        let capturedStepResult: any;

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        const result = await agent.stream({
          prompt: 'Hello, world!',
          onStepFinish: async stepResult => {
            capturedStepResult = stepResult;
          },
        });

        await result.consumeStream();

        expect({
          finishReason: capturedStepResult.finishReason,
          stepNumber: capturedStepResult.stepNumber,
          text: capturedStepResult.text,
          inputTokens: capturedStepResult.usage.inputTokens,
          outputTokens: capturedStepResult.usage.outputTokens,
          providerMetadata: capturedStepResult.providerMetadata,
        }).toMatchInlineSnapshot(`
          {
            "finishReason": "stop",
            "inputTokens": 3,
            "outputTokens": 10,
            "providerMetadata": {
              "testProvider": {
                "testKey": "testValue",
              },
            },
            "stepNumber": 0,
            "text": "Hello, world!",
          }
        `);
      });
    });
  });

  describe('onToolExecutionStart', () => {
    describe('generate', () => {
      const dummyResponseValues = {
        usage: {
          cachedInputTokens: undefined,
          inputTokens: {
            total: 3,
            noCache: 3,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 10,
            text: 10,
            reasoning: undefined,
          },
        },
        warnings: [],
      };

      function createToolCallMockModel() {
        let callCount = 0;
        return new MockLanguageModelV4({
          doGenerate: async () => {
            if (callCount++ === 0) {
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'tool-call' as const,
                    toolCallType: 'function' as const,
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{ "value": "test" }',
                  },
                ],
                finishReason: {
                  unified: 'tool-calls' as const,
                  raw: undefined,
                },
              };
            }
            return {
              ...dummyResponseValues,
              content: [{ type: 'text' as const, text: 'done' }],
              finishReason: { unified: 'stop' as const, raw: 'stop' },
            };
          },
        });
      }

      it('should call onToolExecutionStart from constructor', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          onToolExecutionStart: async () => {
            calls.push('constructor');
          },
        });

        await agent.generate({ prompt: 'test' });

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onToolExecutionStart from generate method', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
        });

        await agent.generate({
          prompt: 'test',
          onToolExecutionStart: async () => {
            calls.push('method');
          },
        });

        expect(calls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method in correct order', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          onToolExecutionStart: async () => {
            calls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'test',
          onToolExecutionStart: async () => {
            calls.push('method');
          },
        });

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass correct event information', async () => {
        let event!: ToolExecutionStartEvent<any>;

        const agent = new ToolLoopAgent({
          model: createToolCallMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          ...testSettings,
        });

        await agent.generate({
          prompt: 'test',
          onToolExecutionStart: async e => {
            event = e;
          },
        });

        expect(event).toMatchInlineSnapshot(`
          {
            "callId": "call-0",
            "messages": [
              {
                "content": "test",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "test",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
          }
        `);
      });
    });

    describe('stream', () => {
      const dummyStreamFinish = {
        type: 'finish' as const,
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: {
            total: 3,
            noCache: 3,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 10,
            text: 10,
            reasoning: undefined,
          },
        },
        providerMetadata: {},
      };

      function createToolCallStreamMockModel() {
        let callCount = 0;
        return new MockLanguageModelV4({
          doStream: async () => {
            if (callCount++ === 0) {
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{ "value": "test" }',
                  },
                  {
                    ...dummyStreamFinish,
                    finishReason: {
                      unified: 'tool-calls' as const,
                      raw: undefined,
                    },
                  },
                ]),
              };
            }
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'done' },
                { type: 'text-end', id: '1' },
                dummyStreamFinish,
              ]),
            };
          },
        });
      }

      it('should call onToolExecutionStart from constructor', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallStreamMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          onToolExecutionStart: async () => {
            calls.push('constructor');
          },
        });

        const result = await agent.stream({ prompt: 'test' });
        await result.consumeStream();

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onToolExecutionStart from stream method', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallStreamMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
        });

        const result = await agent.stream({
          prompt: 'test',
          onToolExecutionStart: async () => {
            calls.push('method');
          },
        });

        await result.consumeStream();

        expect(calls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method in correct order', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallStreamMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          onToolExecutionStart: async () => {
            calls.push('constructor');
          },
        });

        const result = await agent.stream({
          prompt: 'test',
          onToolExecutionStart: async () => {
            calls.push('method');
          },
        });

        await result.consumeStream();

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass correct event information', async () => {
        let event!: ToolExecutionStartEvent<any>;

        const agent = new ToolLoopAgent({
          model: createToolCallStreamMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          ...testSettings,
        });

        const result = await agent.stream({
          prompt: 'test',
          onToolExecutionStart: async e => {
            event = e;
          },
        });

        await result.consumeStream();

        expect(event).toMatchInlineSnapshot(`
          {
            "callId": "call-1",
            "messages": [
              {
                "content": "test",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "test",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
          }
        `);
      });
    });
  });

  describe('onToolExecutionEnd', () => {
    describe('generate', () => {
      const dummyResponseValues = {
        usage: {
          cachedInputTokens: undefined,
          inputTokens: {
            total: 3,
            noCache: 3,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 10,
            text: 10,
            reasoning: undefined,
          },
        },
        warnings: [],
      };

      function createToolCallMockModel() {
        let callCount = 0;
        return new MockLanguageModelV4({
          doGenerate: async () => {
            if (callCount++ === 0) {
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'tool-call' as const,
                    toolCallType: 'function' as const,
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{ "value": "test" }',
                  },
                ],
                finishReason: {
                  unified: 'tool-calls' as const,
                  raw: undefined,
                },
              };
            }
            return {
              ...dummyResponseValues,
              content: [{ type: 'text' as const, text: 'done' }],
              finishReason: { unified: 'stop' as const, raw: 'stop' },
            };
          },
        });
      }

      function createToolCallMockModelWithInput(input: string) {
        let callCount = 0;
        return new MockLanguageModelV4({
          doGenerate: async () => {
            if (callCount++ === 0) {
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'tool-call' as const,
                    toolCallType: 'function' as const,
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input,
                  },
                ],
                finishReason: {
                  unified: 'tool-calls' as const,
                  raw: undefined,
                },
              };
            }
            return {
              ...dummyResponseValues,
              content: [{ type: 'text' as const, text: 'done' }],
              finishReason: { unified: 'stop' as const, raw: 'stop' },
            };
          },
        });
      }

      it('should call onToolExecutionEnd from constructor', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          onToolExecutionEnd: async () => {
            calls.push('constructor');
          },
        });

        await agent.generate({ prompt: 'test' });

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onToolExecutionEnd from generate method', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
        });

        await agent.generate({
          prompt: 'test',
          onToolExecutionEnd: async () => {
            calls.push('method');
          },
        });

        expect(calls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method in correct order', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          onToolExecutionEnd: async () => {
            calls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'test',
          onToolExecutionEnd: async () => {
            calls.push('method');
          },
        });

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass correct event information on success', async () => {
        let event!: ToolExecutionEndEvent<any>;

        const agent = new ToolLoopAgent({
          model: createToolCallMockModelWithInput('{ "value": "hello" }'),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          ...testSettings,
        });

        await agent.generate({
          prompt: 'test',
          onToolExecutionEnd: async e => {
            event = e;
          },
        });

        expect(event).toMatchInlineSnapshot(`
          {
            "callId": "call-2",
            "messages": [
              {
                "content": "test",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "hello",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "hello",
              },
              "output": "hello-result",
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-result",
            },
          }
        `);
      });
    });

    describe('stream', () => {
      const dummyStreamFinish = {
        type: 'finish' as const,
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: {
            total: 3,
            noCache: 3,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 10,
            text: 10,
            reasoning: undefined,
          },
        },
        providerMetadata: {},
      };

      function createToolCallStreamMockModel() {
        let callCount = 0;
        return new MockLanguageModelV4({
          doStream: async () => {
            if (callCount++ === 0) {
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{ "value": "hello" }',
                  },
                  {
                    ...dummyStreamFinish,
                    finishReason: {
                      unified: 'tool-calls' as const,
                      raw: undefined,
                    },
                  },
                ]),
              };
            }
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'done' },
                { type: 'text-end', id: '1' },
                dummyStreamFinish,
              ]),
            };
          },
        });
      }

      it('should call onToolExecutionEnd from constructor', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallStreamMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          onToolExecutionEnd: async () => {
            calls.push('constructor');
          },
        });

        const result = await agent.stream({ prompt: 'test' });
        await result.consumeStream();

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onToolExecutionEnd from stream method', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallStreamMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
        });

        const result = await agent.stream({
          prompt: 'test',
          onToolExecutionEnd: async () => {
            calls.push('method');
          },
        });

        await result.consumeStream();

        expect(calls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method in correct order', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallStreamMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          onToolExecutionEnd: async () => {
            calls.push('constructor');
          },
        });

        const result = await agent.stream({
          prompt: 'test',
          onToolExecutionEnd: async () => {
            calls.push('method');
          },
        });

        await result.consumeStream();

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass correct event information on success', async () => {
        let event!: ToolExecutionEndEvent<any>;

        const agent = new ToolLoopAgent({
          model: createToolCallStreamMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          ...testSettings,
        });

        const result = await agent.stream({
          prompt: 'test',
          onToolExecutionEnd: async e => {
            event = e;
          },
        });

        await result.consumeStream();

        expect(event).toMatchInlineSnapshot(`
          {
            "callId": "call-3",
            "messages": [
              {
                "content": "test",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "hello",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "hello",
              },
              "output": "hello-result",
              "toolCallId": "call-1",
              "toolName": "testTool",
              "type": "tool-result",
            },
          }
        `);
      });
    });
  });

  describe('onEnd', () => {
    describe('generate', () => {
      let mockModel: MockLanguageModelV4;

      beforeEach(() => {
        mockModel = new MockLanguageModelV4({
          doGenerate: async () => {
            return {
              content: [{ type: 'text', text: 'reply' }],
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                cachedInputTokens: undefined,
                inputTokens: {
                  total: 3,
                  noCache: 3,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 10,
                  text: 10,
                  reasoning: undefined,
                },
              },
              warnings: [],
            };
          },
        });
      });

      it('should call onFinish from constructor', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onFinish: async () => {
            calls.push('constructor');
          },
        });

        await agent.generate({ prompt: 'test' });

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onFinish from generate method', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        await agent.generate({
          prompt: 'test',
          onFinish: async () => {
            calls.push('method');
          },
        });

        expect(calls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method in correct order', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onFinish: async () => {
            calls.push('constructor');
          },
        });

        await agent.generate({
          prompt: 'test',
          onFinish: async () => {
            calls.push('method');
          },
        });

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass correct event information', async () => {
        let event!: Parameters<GenerateTextOnEndCallback<{}>>[0];

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        await agent.generate({
          prompt: 'test',
          onFinish: async e => {
            event = e;
          },
        });

        expect({
          text: event.text,
          finishReason: event.finishReason,
          stepsLength: event.steps.length,
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
        }).toMatchInlineSnapshot(`
          {
            "finishReason": "stop",
            "inputTokens": 3,
            "outputTokens": 10,
            "stepsLength": 1,
            "text": "reply",
          }
        `);
      });
    });

    describe('stream', () => {
      let mockModel: MockLanguageModelV4;

      beforeEach(() => {
        mockModel = new MockLanguageModelV4({
          doStream: async () => {
            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'world!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 3,
                      noCache: 3,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 10,
                      text: 10,
                      reasoning: undefined,
                    },
                  },
                  providerMetadata: {
                    testProvider: { testKey: 'testValue' },
                  },
                },
              ]),
            };
          },
        });
      });

      it('should call onFinish from constructor', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onFinish: async () => {
            calls.push('constructor');
          },
        });

        const result = await agent.stream({ prompt: 'test' });
        await result.consumeStream();

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
          ]
        `);
      });

      it('should call onFinish from stream method', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        const result = await agent.stream({
          prompt: 'test',
          onFinish: async () => {
            calls.push('method');
          },
        });

        await result.consumeStream();

        expect(calls).toMatchInlineSnapshot(`
          [
            "method",
          ]
        `);
      });

      it('should call both constructor and method in correct order', async () => {
        const calls: string[] = [];

        const agent = new ToolLoopAgent({
          model: mockModel,
          onFinish: async () => {
            calls.push('constructor');
          },
        });

        const result = await agent.stream({
          prompt: 'test',
          onFinish: async () => {
            calls.push('method');
          },
        });

        await result.consumeStream();

        expect(calls).toMatchInlineSnapshot(`
          [
            "constructor",
            "method",
          ]
        `);
      });

      it('should pass correct event information', async () => {
        let event!: Parameters<GenerateTextOnEndCallback<{}>>[0];

        const agent = new ToolLoopAgent({
          model: mockModel,
        });

        const result = await agent.stream({
          prompt: 'test',
          onFinish: async e => {
            event = e;
          },
        });

        await result.consumeStream();

        expect({
          text: event.text,
          finishReason: event.finishReason,
          stepsLength: event.steps.length,
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
        }).toMatchInlineSnapshot(`
          {
            "finishReason": "stop",
            "inputTokens": 3,
            "outputTokens": 10,
            "stepsLength": 1,
            "text": "Hello, world!",
          }
        `);
      });
    });
  });

  describe('telemetry integrations', () => {
    afterEach(() => {
      globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = undefined;
    });

    describe('generate', () => {
      const dummyResponseValues = {
        usage: {
          cachedInputTokens: undefined,
          inputTokens: {
            total: 3,
            noCache: 3,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 10,
            text: 10,
            reasoning: undefined,
          },
        },
        warnings: [],
      };

      function createToolCallMockModel() {
        let callCount = 0;
        return new MockLanguageModelV4({
          doGenerate: async () => {
            if (callCount++ === 0) {
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'tool-call' as const,
                    toolCallType: 'function' as const,
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{ "value": "test" }',
                  },
                ],
                finishReason: {
                  unified: 'tool-calls' as const,
                  raw: undefined,
                },
              };
            }
            return {
              ...dummyResponseValues,
              content: [{ type: 'text' as const, text: 'done' }],
              finishReason: { unified: 'stop' as const, raw: 'stop' },
            };
          },
        });
      }

      it('should call per-call integration listeners for all lifecycle events', async () => {
        const events: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          telemetry: {
            integrations: {
              onStart: async () => {
                events.push('onStart');
              },
              onStepStart: async () => {
                events.push('onStepStart');
              },
              onToolExecutionStart: async () => {
                events.push('onToolExecutionStart');
              },
              onToolExecutionEnd: async () => {
                events.push('onToolExecutionEnd');
              },
              onStepEnd: async () => {
                events.push('onStepEnd');
              },
              onEnd: async () => {
                events.push('onEnd');
              },
            },
          },
        });

        await agent.generate({ prompt: 'test' });

        expect(events).toEqual([
          'onStart',
          'onStepStart',
          'onToolExecutionStart',
          'onToolExecutionEnd',
          'onStepEnd',
          'onStepStart',
          'onStepEnd',
          'onEnd',
        ]);
      });

      it('should call globally registered integration listeners', async () => {
        const events: string[] = [];

        globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = [
          {
            onStart: async () => {
              events.push('global-onStart');
            },
            onStepEnd: async () => {
              events.push('global-onStepEnd');
            },
            onEnd: async () => {
              events.push('global-onEnd');
            },
          },
        ];

        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              content: [{ type: 'text' as const, text: 'Hello!' }],
              ...dummyResponseValues,
              finishReason: { unified: 'stop' as const, raw: 'stop' },
            }),
          }),
        });

        await agent.generate({ prompt: 'test' });

        expect(events).toEqual([
          'global-onStart',
          'global-onStepEnd',
          'global-onEnd',
        ]);
      });

      it('should include configured runtimeContext properties in telemetry', async () => {
        const callbackContexts: unknown[] = [];
        const telemetryContexts: unknown[] = [];

        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              content: [{ type: 'text' as const, text: 'Hello!' }],
              ...dummyResponseValues,
              finishReason: { unified: 'stop' as const, raw: 'stop' },
            }),
          }),
          runtimeContext: {
            userId: 'user-123',
            requestId: 'request-123',
          },
          onStart: async ({ runtimeContext }) => {
            callbackContexts.push(runtimeContext);
          },
          onStepFinish: async ({ runtimeContext }) => {
            callbackContexts.push(runtimeContext);
          },
          onFinish: async ({ runtimeContext }) => {
            callbackContexts.push(runtimeContext);
          },
          telemetry: {
            includeRuntimeContext: {
              requestId: true,
            },
            integrations: {
              onStart: async event => {
                telemetryContexts.push(
                  (event as { runtimeContext: unknown }).runtimeContext,
                );
              },
              onStepEnd: async ({ runtimeContext }) => {
                telemetryContexts.push(runtimeContext);
              },
              onEnd: async event => {
                telemetryContexts.push(
                  (event as { runtimeContext: unknown }).runtimeContext,
                );
              },
            },
          },
        });

        await agent.generate({ prompt: 'test' });

        expect(callbackContexts).toEqual([
          { userId: 'user-123', requestId: 'request-123' },
          { userId: 'user-123', requestId: 'request-123' },
          { userId: 'user-123', requestId: 'request-123' },
        ]);
        expect(telemetryContexts).toEqual([
          { requestId: 'request-123' },
          { requestId: 'request-123' },
          { requestId: 'request-123' },
        ]);
      });

      it('should call integration listeners alongside agent callbacks', async () => {
        const events: string[] = [];

        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              content: [{ type: 'text' as const, text: 'Hello!' }],
              ...dummyResponseValues,
              finishReason: { unified: 'stop' as const, raw: 'stop' },
            }),
          }),
          onStart: async () => {
            events.push('agent-onStart');
          },
          onStepFinish: async () => {
            events.push('agent-onStepFinish');
          },
          onFinish: async () => {
            events.push('agent-onFinish');
          },
          telemetry: {
            integrations: {
              onStart: async () => {
                events.push('integration-onStart');
              },
              onStepEnd: async () => {
                events.push('integration-onStepEnd');
              },
              onEnd: async () => {
                events.push('integration-onEnd');
              },
            },
          },
        });

        await agent.generate({ prompt: 'test' });

        expect(events).toEqual([
          'agent-onStart',
          'integration-onStart',
          'agent-onStepFinish',
          'integration-onStepEnd',
          'agent-onFinish',
          'integration-onEnd',
        ]);
      });

      it('should not break generation when an integration listener throws', async () => {
        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              content: [{ type: 'text' as const, text: 'Hello!' }],
              ...dummyResponseValues,
              finishReason: { unified: 'stop' as const, raw: 'stop' },
            }),
          }),
          telemetry: {
            integrations: {
              onStart: async () => {
                throw new Error('integration error');
              },
              onStepEnd: async () => {
                throw new Error('integration error');
              },
              onEnd: async () => {
                throw new Error('integration error');
              },
            },
          },
        });

        const result = await agent.generate({ prompt: 'test' });

        expect(result.text).toBe('Hello!');
      });
    });

    describe('stream', () => {
      const dummyStreamFinish = {
        type: 'finish' as const,
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: {
            total: 3,
            noCache: 3,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 10,
            text: 10,
            reasoning: undefined,
          },
        },
        providerMetadata: {},
      };

      function createToolCallStreamMockModel() {
        let callCount = 0;
        return new MockLanguageModelV4({
          doStream: async () => {
            if (callCount++ === 0) {
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{ "value": "test" }',
                  },
                  {
                    ...dummyStreamFinish,
                    finishReason: {
                      unified: 'tool-calls' as const,
                      raw: undefined,
                    },
                  },
                ]),
              };
            }
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'done' },
                { type: 'text-end', id: '1' },
                dummyStreamFinish,
              ]),
            };
          },
        });
      }

      it('should call per-call integration listeners for all lifecycle events', async () => {
        const events: string[] = [];

        const agent = new ToolLoopAgent({
          model: createToolCallStreamMockModel(),
          tools: {
            testTool: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async ({ value }: { value: string }) =>
                `${value}-result`,
            }),
          },
          telemetry: {
            integrations: {
              onStart: async () => {
                events.push('onStart');
              },
              onStepStart: async () => {
                events.push('onStepStart');
              },
              onToolExecutionStart: async () => {
                events.push('onToolExecutionStart');
              },
              onToolExecutionEnd: async () => {
                events.push('onToolExecutionEnd');
              },
              onStepEnd: async () => {
                events.push('onStepEnd');
              },
              onEnd: async () => {
                events.push('onEnd');
              },
            },
          },
        });

        const result = await agent.stream({ prompt: 'test' });
        await result.consumeStream();

        expect(events).toEqual([
          'onStart',
          'onStepStart',
          'onToolExecutionStart',
          'onToolExecutionEnd',
          'onStepEnd',
          'onStepStart',
          'onStepEnd',
          'onEnd',
        ]);
      });

      it('should call globally registered integration listeners', async () => {
        const events: string[] = [];

        globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = [
          {
            onStart: async () => {
              events.push('global-onStart');
            },
            onStepEnd: async () => {
              events.push('global-onStepEnd');
            },
            onEnd: async () => {
              events.push('global-onEnd');
            },
          },
        ];

        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello!' },
                { type: 'text-end', id: '1' },
                dummyStreamFinish,
              ]),
            }),
          }),
        });

        const result = await agent.stream({ prompt: 'test' });
        await result.consumeStream();

        expect(events).toEqual([
          'global-onStart',
          'global-onStepEnd',
          'global-onEnd',
        ]);
      });

      it('should include configured runtimeContext properties in telemetry', async () => {
        const callbackContexts: unknown[] = [];
        const telemetryContexts: unknown[] = [];

        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello!' },
                { type: 'text-end', id: '1' },
                dummyStreamFinish,
              ]),
            }),
          }),
          runtimeContext: {
            userId: 'user-123',
            requestId: 'request-123',
          },
          onStart: async ({ runtimeContext }) => {
            callbackContexts.push(runtimeContext);
          },
          onStepFinish: async ({ runtimeContext }) => {
            callbackContexts.push(runtimeContext);
          },
          onFinish: async ({ runtimeContext }) => {
            callbackContexts.push(runtimeContext);
          },
          telemetry: {
            includeRuntimeContext: {
              requestId: true,
            },
            integrations: {
              onStart: async event => {
                telemetryContexts.push(
                  (event as { runtimeContext: unknown }).runtimeContext,
                );
              },
              onStepEnd: async ({ runtimeContext }) => {
                telemetryContexts.push(runtimeContext);
              },
              onEnd: async event => {
                telemetryContexts.push(
                  (event as { runtimeContext: unknown }).runtimeContext,
                );
              },
            },
          },
        });

        const result = await agent.stream({ prompt: 'test' });
        await result.consumeStream();

        expect(callbackContexts).toEqual([
          { userId: 'user-123', requestId: 'request-123' },
          { userId: 'user-123', requestId: 'request-123' },
          { userId: 'user-123', requestId: 'request-123' },
        ]);
        expect(telemetryContexts).toEqual([
          { requestId: 'request-123' },
          { requestId: 'request-123' },
          { requestId: 'request-123' },
        ]);
      });

      it('should call integration listeners alongside agent callbacks', async () => {
        const events: string[] = [];

        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello!' },
                { type: 'text-end', id: '1' },
                dummyStreamFinish,
              ]),
            }),
          }),
          onStart: async () => {
            events.push('agent-onStart');
          },
          onStepFinish: async () => {
            events.push('agent-onStepFinish');
          },
          onFinish: async () => {
            events.push('agent-onFinish');
          },
          telemetry: {
            integrations: {
              onStart: async () => {
                events.push('integration-onStart');
              },
              onStepEnd: async () => {
                events.push('integration-onStepEnd');
              },
              onEnd: async () => {
                events.push('integration-onEnd');
              },
            },
          },
        });

        const result = await agent.stream({ prompt: 'test' });
        await result.consumeStream();

        expect(events).toEqual([
          'agent-onStart',
          'integration-onStart',
          'agent-onStepFinish',
          'integration-onStepEnd',
          'agent-onFinish',
          'integration-onEnd',
        ]);
      });

      it('should not break streaming when an integration listener throws', async () => {
        const agent = new ToolLoopAgent({
          model: new MockLanguageModelV4({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello!' },
                { type: 'text-end', id: '1' },
                dummyStreamFinish,
              ]),
            }),
          }),
          telemetry: {
            integrations: {
              onStart: async () => {
                throw new Error('integration error');
              },
              onStepEnd: async () => {
                throw new Error('integration error');
              },
              onEnd: async () => {
                throw new Error('integration error');
              },
            },
          },
        });

        const result = await agent.stream({ prompt: 'test' });
        await result.consumeStream();

        expect(await result.text).toBe('Hello!');
      });
    });
  });

  describe('callOptionsSchema', () => {
    it('should reject options that fail callOptionsSchema validation before invoking the model', async () => {
      let modelCalled = false;
      const agent = new ToolLoopAgent<{ topic: 'legal' | 'medical' }>({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            modelCalled = true;
            return {
              content: [{ type: 'text', text: 'reply' }],
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                cachedInputTokens: undefined,
                inputTokens: {
                  total: 1,
                  noCache: 1,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 1,
                  text: 1,
                  reasoning: undefined,
                },
              },
              warnings: [],
            };
          },
        }),
        callOptionsSchema: z.object({
          topic: z.enum(['legal', 'medical']),
        }),
      });

      await expect(
        agent.generate({
          prompt: 'hi',
          // intentionally outside the enum to exercise schema enforcement
          options: { topic: 'evil' as 'legal' },
        }),
      ).rejects.toThrow(/Type validation failed for options/);

      expect(modelCalled).toBe(false);
    });

    it('should pass through options that satisfy callOptionsSchema', async () => {
      const agent = new ToolLoopAgent<{ topic: 'legal' | 'medical' }>({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            return {
              content: [{ type: 'text', text: 'reply' }],
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                cachedInputTokens: undefined,
                inputTokens: {
                  total: 1,
                  noCache: 1,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 1,
                  text: 1,
                  reasoning: undefined,
                },
              },
              warnings: [],
            };
          },
        }),
        callOptionsSchema: z.object({
          topic: z.enum(['legal', 'medical']),
        }),
      });

      const result = await agent.generate({
        prompt: 'hi',
        options: { topic: 'legal' },
      });

      expect(result.text).toBe('reply');
    });
  });
});
