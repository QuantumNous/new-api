import {
  InvalidPromptError,
  type LanguageModelV4CallOptions,
  type LanguageModelV4FunctionTool,
  type LanguageModelV4Prompt,
  type LanguageModelV4ProviderTool,
  type LanguageModelV4Usage,
} from '@ai-sdk/provider';
import {
  DelayedPromise,
  dynamicTool,
  jsonSchema,
  tool,
  type ModelMessage,
  type Experimental_SandboxSession as SandboxSession,
  type ToolExecuteFunction,
  type ToolResultOutput,
} from '@ai-sdk/provider-utils';
import { mockId } from '@ai-sdk/provider-utils/test';
import {
  afterEach,
  assert,
  assertType,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  vitest,
} from 'vitest';
import { mockSandboxSessionFileStubs } from '../test/mock-sandbox';
import { signToolApproval } from './tool-approval-signature';
import { z } from 'zod/v4';
import * as logWarningsModule from '../logger/log-warnings';
import type { Instructions } from '../prompt';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { mockValues } from '../test/mock-values';
import { generateText } from './generate-text';
import type {
  GenerateTextOnEndCallback,
  GenerateTextOnStartCallback,
  GenerateTextOnStepEndCallback,
  GenerateTextOnStepFinishCallback,
  GenerateTextOnStepStartCallback,
} from './generate-text-events';
import type { GenerateTextResult } from './generate-text-result';
import * as Output from './output';
import type { StepResult } from './step-result';
import { isLoopFinished, isStepCount } from './stop-condition';
import type {
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
} from './tool-execution-events';
import type {
  LanguageModelCallEndEvent,
  LanguageModelCallStartEvent,
} from './language-model-events';

vi.mock('../version', () => {
  return {
    VERSION: '0.0.0-test',
  };
});

const testUsage: LanguageModelV4Usage = {
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
};

const dummyResponseValues = {
  finishReason: { unified: 'stop', raw: 'stop' } as const,
  usage: testUsage,
  warnings: [],
};

const modelWithSources = new MockLanguageModelV4({
  doGenerate: {
    ...dummyResponseValues,
    content: [
      { type: 'text', text: 'Hello, world!' },
      {
        type: 'source',
        sourceType: 'url',
        id: '123',
        url: 'https://example.com',
        title: 'Example',
        providerMetadata: { provider: { custom: 'value' } },
      },
      {
        type: 'source',
        sourceType: 'url',
        id: '456',
        url: 'https://example.com/2',
        title: 'Example 2',
        providerMetadata: { provider: { custom: 'value2' } },
      },
    ],
  },
});

const modelWithFiles = new MockLanguageModelV4({
  doGenerate: {
    ...dummyResponseValues,
    content: [
      { type: 'text', text: 'Hello, world!' },
      {
        type: 'file',
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'image/png',
      },
      {
        type: 'file',
        data: { type: 'data', data: 'QkFVRw==' },
        mediaType: 'image/jpeg',
      },
    ],
  },
});

const modelWithReasoning = new MockLanguageModelV4({
  doGenerate: {
    ...dummyResponseValues,
    content: [
      {
        type: 'reasoning',
        text: 'I will open the conversation with witty banter.',
        providerMetadata: {
          testProvider: {
            signature: 'signature',
          },
        },
      },
      {
        type: 'reasoning',
        text: '',
        providerMetadata: {
          testProvider: {
            redactedData: 'redacted-reasoning-data',
          },
        },
      },
      { type: 'text', text: 'Hello, world!' },
    ],
  },
});

const defaultSettings = () =>
  ({
    prompt: 'prompt',
    experimental_generateMessageId: mockId({ prefix: 'msg' }),
    _internal: {
      generateId: mockId({ prefix: 'id' }),
      generateCallId: () => 'test-telemetry-call-id',
    },
    onError: () => {},
  }) as const;

describe('generateText', () => {
  let logWarningsSpy: ReturnType<typeof vitest.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    logWarningsSpy = vitest
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    logWarningsSpy.mockRestore();
  });

  describe('telemetry model-call context', () => {
    it('should execute doGenerate inside executeLanguageModelCall context', async () => {
      let activeContext: string | undefined;
      let capturedContext: string | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            capturedContext = activeContext;

            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'done' }],
            };
          },
        }),
        telemetry: {
          isEnabled: true,
          integrations: {
            executeLanguageModelCall: async ({ callId, execute }) => {
              activeContext = callId;
              try {
                return await execute();
              } finally {
                activeContext = undefined;
              }
            },
          },
        },
        ...defaultSettings(),
      });

      expect(capturedContext).toBe('test-telemetry-call-id');
    });
  });

  describe('result.content', () => {
    it('should generate content', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: {
            ...dummyResponseValues,
            content: [
              { type: 'text', text: 'Hello, world!' },
              {
                type: 'source',
                sourceType: 'url',
                id: '123',
                url: 'https://example.com',
                title: 'Example',
                providerMetadata: { provider: { custom: 'value' } },
              },
              {
                type: 'file',
                data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
                mediaType: 'image/png',
              },
              {
                type: 'reasoning',
                text: 'I will open the conversation with witty banter.',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
              { type: 'text', text: 'More text' },
            ],
          },
        }),
        prompt: 'prompt',
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async args => {
              expect(args).toStrictEqual({ value: 'value' });
              return 'result1';
            },
          },
        },
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Hello, world!",
            "type": "text",
          },
          {
            "id": "123",
            "providerMetadata": {
              "provider": {
                "custom": "value",
              },
            },
            "sourceType": "url",
            "title": "Example",
            "type": "source",
            "url": "https://example.com",
          },
          {
            "file": DefaultGeneratedFile {
              "base64Data": "AQID",
              "mediaType": "image/png",
              "uint8ArrayData": Uint8Array [
                1,
                2,
                3,
              ],
            },
            "type": "file",
          },
          {
            "text": "I will open the conversation with witty banter.",
            "type": "reasoning",
          },
          {
            "input": {
              "value": "value",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-call",
          },
          {
            "text": "More text",
            "type": "text",
          },
          {
            "dynamic": false,
            "input": {
              "value": "value",
            },
            "output": "result1",
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-result",
          },
        ]
      `);
    });

    it('should include custom parts in content', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: {
            ...dummyResponseValues,
            content: [
              { type: 'text', text: 'Hello' },
              {
                type: 'custom',
                kind: 'openai.compaction',
                providerMetadata: {
                  openai: { itemId: 'cmp_123' },
                },
              },
              {
                type: 'custom',
                kind: 'openai.other',
              },
            ],
          },
        }),
        prompt: 'prompt',
      });

      expect(result.content).toStrictEqual([
        { type: 'text', text: 'Hello' },
        {
          type: 'custom',
          kind: 'openai.compaction',
          providerMetadata: {
            openai: { itemId: 'cmp_123' },
          },
        },
        {
          type: 'custom',
          kind: 'openai.other',
        },
      ]);
    });

    it('should include reasoning-file in content and exclude from files', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: {
            ...dummyResponseValues,
            content: [
              { type: 'text', text: 'Here is a thought image:' },
              {
                type: 'reasoning-file',
                data: { type: 'data', data: new Uint8Array([10, 20, 30]) },
                mediaType: 'image/png',
                providerMetadata: {
                  google: { thoughtSignature: 'sig123' },
                },
              },
              {
                type: 'file',
                data: { type: 'data', data: new Uint8Array([40, 50, 60]) },
                mediaType: 'image/jpeg',
              },
            ],
          },
        }),
        prompt: 'prompt',
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Here is a thought image:",
            "type": "text",
          },
          {
            "file": DefaultGeneratedFile {
              "base64Data": "ChQe",
              "mediaType": "image/png",
              "uint8ArrayData": Uint8Array [
                10,
                20,
                30,
              ],
            },
            "providerMetadata": {
              "google": {
                "thoughtSignature": "sig123",
              },
            },
            "type": "reasoning-file",
          },
          {
            "file": DefaultGeneratedFile {
              "base64Data": "KDI8",
              "mediaType": "image/jpeg",
              "uint8ArrayData": Uint8Array [
                40,
                50,
                60,
              ],
            },
            "type": "file",
          },
        ]
      `);

      expect(result.files).toMatchInlineSnapshot(`
        [
          DefaultGeneratedFile {
            "base64Data": "KDI8",
            "mediaType": "image/jpeg",
            "uint8ArrayData": Uint8Array [
              40,
              50,
              60,
            ],
          },
        ]
      `);
    });
  });

  describe('result.text', () => {
    it('should generate text', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: {
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
          },
        }),
        prompt: 'prompt',
      });

      expect(modelWithSources.doGenerateCalls).toMatchSnapshot();
      expect(result.text).toStrictEqual('Hello, world!');
    });
  });

  describe('result.reasoningText', () => {
    it('should contain reasoning string from model response', async () => {
      const result = await generateText({
        model: modelWithReasoning,
        prompt: 'prompt',
      });

      expect(result.reasoningText).toStrictEqual(
        'I will open the conversation with witty banter.',
      );
    });
  });

  describe('result.warnings', () => {
    it('should contain warnings from all steps', async () => {
      let responseCount = 0;
      const warning0 = { type: 'other' as const, message: 'step 0 warning' };
      const warning1 = { type: 'other' as const, message: 'step 1 warning' };

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                  warnings: [warning0],
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                  warnings: [warning1],
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        prompt: 'prompt',
        stopWhen: isStepCount(3),
      });

      expect(result.warnings).toEqual([warning0, warning1]);
      expect(result.finalStep.warnings).toEqual([warning1]);
    });

    it('should send warnings from all steps to onFinish', async () => {
      let responseCount = 0;
      let onFinishResult!: Parameters<GenerateTextOnEndCallback<any, any>>[0];
      const warning0 = { type: 'other' as const, message: 'step 0 warning' };
      const warning1 = { type: 'other' as const, message: 'step 1 warning' };

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                  warnings: [warning0],
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                  warnings: [warning1],
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        prompt: 'prompt',
        stopWhen: isStepCount(3),
        onFinish: async event => {
          onFinishResult = event;
        },
      });

      expect(onFinishResult.warnings).toEqual([warning0, warning1]);
      expect(onFinishResult.steps.at(-1)!.warnings).toEqual([warning1]);
    });
  });

  describe('result.sources', () => {
    it('should contain sources', async () => {
      const result = await generateText({
        model: modelWithSources,
        prompt: 'prompt',
      });

      expect(result.sources).toMatchSnapshot();
    });

    it('should contain sources from all steps', async () => {
      let responseCount = 0;

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'source',
                      sourceType: 'url',
                      id: 'source-0',
                      url: 'https://example.com/0',
                      title: 'Source 0',
                    },
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'source',
                      sourceType: 'url',
                      id: 'source-1',
                      url: 'https://example.com/1',
                      title: 'Source 1',
                    },
                  ],
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        prompt: 'prompt',
        stopWhen: isStepCount(3),
      });

      expect(result.sources).toEqual([
        {
          type: 'source',
          sourceType: 'url',
          id: 'source-0',
          url: 'https://example.com/0',
          title: 'Source 0',
        },
        {
          type: 'source',
          sourceType: 'url',
          id: 'source-1',
          url: 'https://example.com/1',
          title: 'Source 1',
        },
      ]);

      expect(result.finalStep.sources).toEqual([
        {
          type: 'source',
          sourceType: 'url',
          id: 'source-1',
          url: 'https://example.com/1',
          title: 'Source 1',
        },
      ]);
    });
  });

  describe('result.files', () => {
    it('should contain files', async () => {
      const result = await generateText({
        model: modelWithFiles,
        prompt: 'prompt',
      });

      expect(result.files).toMatchSnapshot();
    });

    it('should contain files from all steps', async () => {
      let responseCount = 0;

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0w' },
                      mediaType: 'text/plain',
                    },
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0x' },
                      mediaType: 'text/plain',
                    },
                  ],
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        prompt: 'prompt',
        stopWhen: isStepCount(3),
      });

      expect(
        result.files.map(file => ({
          base64: file.base64,
          mediaType: file.mediaType,
        })),
      ).toEqual([
        { base64: 'c3RlcC0w', mediaType: 'text/plain' },
        { base64: 'c3RlcC0x', mediaType: 'text/plain' },
      ]);

      expect(
        result.finalStep.files.map(file => ({
          base64: file.base64,
          mediaType: file.mediaType,
        })),
      ).toEqual([{ base64: 'c3RlcC0x', mediaType: 'text/plain' }]);
    });

    it('should send files from all steps to onFinish', async () => {
      let responseCount = 0;
      let onFinishResult!: Parameters<GenerateTextOnEndCallback<any, any>>[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0w' },
                      mediaType: 'text/plain',
                    },
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0x' },
                      mediaType: 'text/plain',
                    },
                  ],
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        prompt: 'prompt',
        stopWhen: isStepCount(3),
        onFinish: async event => {
          onFinishResult = event;
        },
      });

      expect(
        onFinishResult.files.map(file => ({
          base64: file.base64,
          mediaType: file.mediaType,
        })),
      ).toEqual([
        { base64: 'c3RlcC0w', mediaType: 'text/plain' },
        { base64: 'c3RlcC0x', mediaType: 'text/plain' },
      ]);

      expect(
        onFinishResult.steps.at(-1)!.files.map(file => ({
          base64: file.base64,
          mediaType: file.mediaType,
        })),
      ).toEqual([{ base64: 'c3RlcC0x', mediaType: 'text/plain' }]);
    });

    it('should contain file content parts from all steps in result.content', async () => {
      let responseCount = 0;

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0w' },
                      mediaType: 'text/plain',
                    },
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{}',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'file',
                      data: { type: 'data', data: 'c3RlcC0x' },
                      mediaType: 'text/plain',
                    },
                  ],
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({}),
            execute: async () => 'result1',
          }),
        },
        prompt: 'prompt',
        stopWhen: isStepCount(3),
      });

      const fileParts = result.content.filter(part => part.type === 'file');

      expect(
        fileParts.map(part => ({
          base64: part.file.base64,
          mediaType: part.file.mediaType,
        })),
      ).toEqual([
        { base64: 'c3RlcC0w', mediaType: 'text/plain' },
        { base64: 'c3RlcC0x', mediaType: 'text/plain' },
      ]);

      expect(
        result.finalStep.content.filter(part => part.type === 'file'),
      ).toHaveLength(1);
    });
  });

  describe('result.steps', () => {
    it('should add the reasoning from the model response to the step result', async () => {
      const result = await generateText({
        model: modelWithReasoning,
        prompt: 'prompt',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      expect(result.steps).toMatchSnapshot();
    });

    it('should contain sources', async () => {
      const result = await generateText({
        model: modelWithSources,
        prompt: 'prompt',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      expect(result.steps).toMatchSnapshot();
    });

    it('should contain files', async () => {
      const result = await generateText({
        model: modelWithFiles,
        prompt: 'prompt',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      expect(result.steps).toMatchSnapshot();
    });

    it('should expose the final step', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello!' }],
          }),
        }),
        prompt: 'test-input',
      });

      expect(result.finalStep).toBe(result.steps.at(-1));
    });

    it('should include step performance', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello!' }],
          }),
        }),
        prompt: 'test-input',
        _internal: {
          now: mockValues(1000, 1500),
        },
      });

      expect(result.finalStep.performance).toStrictEqual({
        effectiveOutputTokensPerSecond: 20,
        outputTokensPerSecond: undefined,
        inputTokensPerSecond: undefined,
        effectiveTotalTokensPerSecond: 26,
        stepTimeMs: 500,
        responseTimeMs: 500,
        toolExecutionMs: {},
        timeToFirstOutputMs: undefined,
      });
    });

    it('should calculate throughput from response time and track tool execution time', async () => {
      const originalPerformance = globalThis.performance;
      vi.stubGlobal('performance', {
        ...originalPerformance,
        now: mockValues(1500, 1800),
      });

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result1',
          }),
        },
        prompt: 'test-input',
        _internal: {
          now: mockValues(1000, 1500, 2000),
        },
      });

      expect(result.finalStep.performance).toStrictEqual({
        effectiveOutputTokensPerSecond: 20,
        outputTokensPerSecond: undefined,
        inputTokensPerSecond: undefined,
        effectiveTotalTokensPerSecond: 26,
        stepTimeMs: 1000,
        responseTimeMs: 500,
        toolExecutionMs: {
          'call-1': 300,
        },
        timeToFirstOutputMs: undefined,
      });
    });
  });

  describe('result.toolCalls', () => {
    it('should contain tool calls', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ prompt, tools, toolChoice }) => {
            expect(tools).toStrictEqual([
              {
                type: 'function',
                name: 'tool1',
                inputSchema: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  additionalProperties: false,
                  properties: { value: { type: 'string' } },
                  required: ['value'],
                  type: 'object',
                },
              },
              {
                type: 'function',
                name: 'tool2',
                inputSchema: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  additionalProperties: false,
                  properties: { somethingElse: { type: 'string' } },
                  required: ['somethingElse'],
                  type: 'object',
                },
              },
            ]);

            expect(toolChoice).toStrictEqual({ type: 'required' });

            expect(prompt).toStrictEqual([
              {
                role: 'user',
                content: [{ type: 'text', text: 'test-input' }],
                providerOptions: undefined,
              },
            ]);

            return {
              ...dummyResponseValues,
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: `{ "value": "value" }`,
                },
              ],
            };
          },
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
          },
          // 2nd tool to show typing:
          tool2: {
            inputSchema: z.object({ somethingElse: z.string() }),
          },
        },
        toolChoice: 'required',
        prompt: 'test-input',
      });

      // test type inference
      if (
        result.toolCalls[0].toolName === 'tool1' &&
        !result.toolCalls[0].dynamic
      ) {
        assertType<string>(result.toolCalls[0].input.value);
      }

      expect(result.toolCalls).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "value",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-call",
          },
        ]
      `);
    });

    it('should refine tool input before tool execution, outputs, and callbacks', async () => {
      const modelCallEndEvents: LanguageModelCallEndEvent<any>[] = [];
      const toolExecutionStartEvents: ToolExecutionStartEvent<any>[] = [];

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": " raw " }`,
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async input => {
              expect(input).toStrictEqual({ value: 'raw' });
              return `result:${input.value}`;
            },
          }),
        },
        experimental_refineToolInput: {
          tool1: input => ({ value: input.value.trim() }),
        },
        onLanguageModelCallEnd: event => {
          modelCallEndEvents.push(event);
        },
        onToolExecutionStart: event => {
          toolExecutionStartEvents.push(event);
        },
        prompt: 'test-input',
      });

      expect(result.toolCalls[0].input).toStrictEqual({ value: 'raw' });
      expect(result.toolResults[0].input).toStrictEqual({ value: 'raw' });
      expect(modelCallEndEvents[0].content[0]).toMatchObject({
        type: 'tool-call',
        input: { value: 'raw' },
      });
      expect(toolExecutionStartEvents[0].toolCall.input).toStrictEqual({
        value: 'raw',
      });
    });
  });

  describe('result.toolResults', () => {
    it('should contain tool results', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ prompt, tools, toolChoice }) => {
            expect(tools).toStrictEqual([
              {
                type: 'function',
                name: 'tool1',
                inputSchema: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  additionalProperties: false,
                  properties: { value: { type: 'string' } },
                  required: ['value'],
                  type: 'object',
                },
              },
            ]);

            expect(toolChoice).toStrictEqual({ type: 'auto' });

            expect(prompt).toStrictEqual([
              {
                role: 'user',
                content: [{ type: 'text', text: 'test-input' }],
                providerOptions: undefined,
              },
            ]);

            return {
              ...dummyResponseValues,
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: `{ "value": "value" }`,
                },
              ],
            };
          },
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async args => {
              expect(args).toStrictEqual({ value: 'value' });
              return 'result1';
            },
          },
        },
        prompt: 'test-input',
      });

      // test type inference
      if (
        result.toolResults[0].toolName === 'tool1' &&
        !result.toolResults[0].dynamic
      ) {
        assertType<string>(result.toolResults[0].output);
      }

      expect(result.toolResults).toMatchInlineSnapshot(`
        [
          {
            "dynamic": false,
            "input": {
              "value": "value",
            },
            "output": "result1",
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-result",
          },
        ]
      `);
    });
  });

  describe('class-based tool `this` binding', () => {
    // A class-based tool whose `execute` and `toModelOutput` both rely on `this`.
    // This guards against re-introducing a "this-binding guard" that would
    // destructure these methods off the tool before calling them and thereby
    // break the binding.
    // See https://github.com/vercel/ai/pull/15917#discussion_r3376474765
    it('should preserve `this` for execute and toModelOutput', async () => {
      class CalculatorTool {
        readonly inputSchema = z.object({ a: z.number(), b: z.number() });
        private readonly prefix = 'calc';

        async execute(input: { a: number; b: number }) {
          // accesses `this.prefix`, requiring `this` to be bound to the
          // tool instance when `execute` is invoked.
          return { id: this.prefix, sum: input.a + input.b };
        }

        toModelOutput({ output }: { output: unknown }): ToolResultOutput {
          // accesses `this.prefix`, requiring `this` to be bound to the
          // tool instance when `toModelOutput` is invoked.
          const { sum } = output as { sum: number };
          return { type: 'text', value: `${this.prefix}:${sum}` };
        }
      }

      let step1Prompt: LanguageModelV4Prompt | undefined;
      let responseCount = 0;

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ prompt }) => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'calculator',
                      input: `{ "a": 1, "b": 2 }`,
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                step1Prompt = prompt;
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: { calculator: new CalculatorTool() },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
      });

      // `execute` ran with `this` bound to the tool instance:
      expect(result.toolResults[0].output).toStrictEqual({
        id: 'calc',
        sum: 3,
      });

      // `toModelOutput` ran with `this` bound and its value was sent to the model:
      expect(step1Prompt).toContainEqual({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'calculator',
            output: { type: 'text', value: 'calc:3' },
          },
        ],
        providerOptions: undefined,
      });
    });
  });

  describe('result.providerMetadata', () => {
    it('should contain provider metadata', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [],
            providerMetadata: {
              exampleProvider: {
                a: 10,
                b: 20,
              },
            },
          }),
        }),
        prompt: 'test-input',
      });

      expect(result.providerMetadata).toStrictEqual({
        exampleProvider: {
          a: 10,
          b: 20,
        },
      });
    });
  });

  describe('result.responseMessages', () => {
    it('should contain assistant response message when there are no tool calls', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
          }),
        }),
        prompt: 'test-input',
      });

      expect(result.responseMessages).toMatchSnapshot();
    });

    it('should contain assistant response message and tool message when there are tool calls with results', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              { type: 'text', text: 'Hello, world!' },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
            ],
          }),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async (args, options) => {
              expect(args).toStrictEqual({ value: 'value' });
              expect(options.messages).toStrictEqual([
                { role: 'user', content: 'test-input' },
              ]);
              return 'result1';
            },
          },
        },
        prompt: 'test-input',
      });

      expect(result.responseMessages).toMatchSnapshot();
    });

    it('should contain reasoning', async () => {
      const result = await generateText({
        model: modelWithReasoning,
        prompt: 'test-input',
      });

      expect(result.responseMessages).toMatchSnapshot();
    });
  });

  describe('result.request', () => {
    it('should exclude request body and request messages by default', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({}) => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            request: {
              body: 'test body',
            },
          }),
        }),
        prompt: 'prompt',
      });

      expect(result.request).toStrictEqual({
        body: undefined,
        messages: undefined,
      });
    });

    it('should include request body when retention.requestBody is true', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({}) => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            request: {
              body: 'test body',
            },
          }),
        }),
        prompt: 'prompt',
        include: { requestBody: true },
      });

      expect(result.request).toStrictEqual({
        body: 'test body',
        messages: undefined,
      });
    });

    it('should accept deprecated experimental_include as an alias for include', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({}) => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            request: {
              body: 'test body',
            },
          }),
        }),
        prompt: 'prompt',
        experimental_include: { requestBody: true },
      });

      expect(result.request).toStrictEqual({
        body: 'test body',
        messages: undefined,
      });
    });

    it('should prefer include over deprecated experimental_include', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({}) => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            request: {
              body: 'test body',
            },
          }),
        }),
        prompt: 'prompt',
        include: { requestBody: false },
        experimental_include: { requestBody: true },
      });

      expect(result.request).toStrictEqual({
        body: undefined,
        messages: undefined,
      });
    });

    it('should include request messages when retention.requestMessages is true', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({}) => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            request: {
              body: 'test body',
            },
          }),
        }),
        prompt: 'prompt',
        include: { requestBody: true, requestMessages: true },
      });

      expect(result.request).toStrictEqual({
        body: 'test body',
        messages: [{ role: 'user', content: 'prompt' }],
      });
      expect(result.steps[0].request.messages).toStrictEqual([
        { role: 'user', content: 'prompt' },
      ]);
    });

    it('should contain messages from after prepareStep', async () => {
      const preparedMessages: Array<ModelMessage> = [
        { role: 'user', content: 'prepared prompt' },
      ];

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({}) => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
          }),
        }),
        prompt: 'prompt',
        prepareStep: async () => ({
          messages: preparedMessages,
        }),
        include: { requestMessages: true },
      });

      expect(result.request.messages).toStrictEqual(preparedMessages);
      expect(result.steps[0].request.messages).toStrictEqual(preparedMessages);
    });

    it('should carry messages from prepareStep forward to the next step', async () => {
      const preparedMessages: Array<ModelMessage> = [
        { role: 'user', content: 'prepared prompt' },
      ];
      const prepareStepMessages: Array<Array<ModelMessage>> = [];
      let responseCount = 0;

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "test" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'prompt',
        stopWhen: isStepCount(3),
        prepareStep: async ({ messages, stepNumber }) => {
          prepareStepMessages.push([...messages]);

          if (stepNumber === 0) {
            return { messages: preparedMessages };
          }
        },
        include: { requestMessages: true },
      });

      expect(prepareStepMessages[1]).toEqual([
        ...preparedMessages,
        ...result.steps[0].response.messages,
      ]);
      expect(result.steps[1].request.messages).toEqual([
        ...preparedMessages,
        ...result.steps[0].response.messages,
      ]);
    });
  });

  describe('result.response', () => {
    it('should contain response body and headers', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({}) => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            response: {
              id: 'test-id-from-model',
              timestamp: new Date(10000),
              modelId: 'test-response-model-id',
              headers: {
                'custom-response-header': 'response-header-value',
              },
              body: 'test body',
            },
          }),
        }),
        prompt: 'prompt',
        include: { responseBody: true },
      });

      expect(result.steps[0].response).toMatchSnapshot();
      expect(result.response).toMatchSnapshot();
    });
  });

  describe('options.onStart', () => {
    it('should send correct information with text prompt', async () => {
      let startEvent!: Parameters<
        GenerateTextOnStartCallback<any, any, any>
      >[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello, World!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        telemetry: {
          functionId: 'test-function',
        },
        _internal: {
          generateId: () => 'test-call-id',
          generateCallId: () => 'test-telemetry-call-id',
        },
        onStart: async event => {
          startEvent = event;
        },
      });

      expect(startEvent).toMatchSnapshot();
    });

    it('should pass runtimeContext', async () => {
      let startEvent!: Parameters<
        GenerateTextOnStartCallback<any, any, any>
      >[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        runtimeContext: { userId: 'test-user', sessionId: '123' },
        onStart: async event => {
          startEvent = event;
        },
      });

      expect(startEvent.runtimeContext).toEqual({
        userId: 'test-user',
        sessionId: '123',
      });
    });

    it('should accept deprecated experimental_telemetry as an alias for telemetry', async () => {
      let startEvent!: Parameters<
        GenerateTextOnStartCallback<any, any, any>
      >[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'deprecated-fn',
        },
        onStart: async event => {
          startEvent = event;
        },
      });

      expect(startEvent).not.toHaveProperty('isEnabled');
      expect(startEvent).not.toHaveProperty('functionId');
    });

    it('should send correct information with system and messages', async () => {
      let startEvent!: Parameters<
        GenerateTextOnStartCallback<any, any, any>
      >[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        instructions: 'you are a helpful assistant',
        messages: [{ role: 'user', content: 'test-message' }],
        maxOutputTokens: 100,
        temperature: 0.5,
        onStart: async event => {
          startEvent = event;
        },
      });

      expect(startEvent.provider).toBe('mock-provider');
      expect(startEvent.modelId).toBe('mock-model-id');
      expect(startEvent.instructions).toBe('you are a helpful assistant');
      expect(startEvent.messages).toEqual([
        { role: 'user', content: 'test-message' },
      ]);
      expect(startEvent.maxOutputTokens).toBe(100);
      expect(startEvent.temperature).toBe(0.5);
      expect(startEvent.maxRetries).toBe(2);
    });

    it('should reject system messages in messages by default', async () => {
      await expect(async () => {
        await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              content: [{ type: 'text', text: 'Hello!' }],
              ...dummyResponseValues,
            }),
          }),
          messages: [{ role: 'system', content: 'INSTRUCTIONS' }],
        });
      }).rejects.toThrow(InvalidPromptError);
    });

    it('should allow system messages in messages when allowSystemInMessages is true', async () => {
      const model = new MockLanguageModelV4({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Hello!' }],
          ...dummyResponseValues,
        }),
      });

      await generateText({
        model,
        allowSystemInMessages: true,
        messages: [{ role: 'system', content: 'INSTRUCTIONS' }],
      });

      expect(model.doGenerateCalls[0].prompt).toEqual([
        { role: 'system', content: 'INSTRUCTIONS' },
      ]);
    });

    it('should be called before doGenerate', async () => {
      const callOrder: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            callOrder.push('doGenerate');
            return {
              content: [{ type: 'text', text: 'Hello!' }],
              ...dummyResponseValues,
            };
          },
        }),
        prompt: 'test-input',
        onStart: async () => {
          callOrder.push('onStart');
        },
      });

      expect(callOrder).toEqual(['onStart', 'doGenerate']);
    });

    it('should not break generation when callback throws', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello, World!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        onStart: async () => {
          throw new Error('callback error');
        },
      });

      expect(result.text).toBe('Hello, World!');
    });
  });

  describe('options.onStepStart', () => {
    it('should be called with correct data for a single step', async () => {
      let stepStartEvent!: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        onStepStart: async event => {
          stepStartEvent = event;
        },
      });

      expect(stepStartEvent.stepNumber).toBe(0);
      expect(stepStartEvent.steps.length).toBe(0);
      expect(stepStartEvent.provider).toBe('mock-provider');
      expect(stepStartEvent.modelId).toBe('mock-model-id');
      expect(stepStartEvent.messages).toEqual([
        {
          role: 'user',
          content: 'test-input',
        },
      ]);
      expect(stepStartEvent.steps).toEqual([]);
    });

    it('should be called once per step in a multi-step tool loop', async () => {
      const stepStartEvents: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0][] = [];
      let responseCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "test" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Final answer.' }],
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
        onStepStart: async event => {
          stepStartEvents.push(event);
        },
      });

      expect(stepStartEvents.length).toBe(2);
      expect(stepStartEvents[0].stepNumber).toBe(0);
      expect(stepStartEvents[0].steps.length).toBe(0);
      expect(stepStartEvents[1].stepNumber).toBe(1);
      expect(stepStartEvents[1].steps.length).toBe(1);
    });

    it('should be called before doGenerate on each step', async () => {
      const callOrder: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            callOrder.push('doGenerate');
            return {
              content: [{ type: 'text', text: 'Hello!' }],
              ...dummyResponseValues,
            };
          },
        }),
        prompt: 'test-input',
        onStepStart: async () => {
          callOrder.push('onStepStart');
        },
      });

      expect(callOrder).toEqual(['onStepStart', 'doGenerate']);
    });

    it('should not break generation when callback throws', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello, World!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        onStepStart: async () => {
          throw new Error('callback error');
        },
      });

      expect(result.text).toBe('Hello, World!');
    });

    it('should reflect model changes from prepareStep', async () => {
      const stepStartEvents: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0][] = [];
      let responseCount = 0;

      const alternateModel = new MockLanguageModelV4({
        provider: 'alternate-provider',
        modelId: 'alternate-model-id',
        doGenerate: async () => ({
          ...dummyResponseValues,
          content: [{ type: 'text', text: 'Final answer.' }],
        }),
      });

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            responseCount++;
            return {
              ...dummyResponseValues,
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: '{ "value": "test" }',
                },
              ],
              finishReason: { unified: 'tool-calls', raw: undefined },
            };
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
        prepareStep: async ({ stepNumber }) => {
          if (stepNumber === 1) {
            return { model: alternateModel };
          }
          return undefined;
        },
        onStepStart: async event => {
          stepStartEvents.push(event);
        },
      });

      expect(stepStartEvents[0].provider).toBe('mock-provider');
      expect(stepStartEvents[0].modelId).toBe('mock-model-id');
      expect(stepStartEvents[1].provider).toBe('alternate-provider');
      expect(stepStartEvents[1].modelId).toBe('alternate-model-id');
    });

    it('should provide empty steps array on first step', async () => {
      let stepStartEvent!: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        onStepStart: async event => {
          stepStartEvent = event;
        },
      });

      expect(stepStartEvent.stepNumber).toBe(0);
      expect(stepStartEvent.steps).toEqual([]);
      expect(stepStartEvent.steps.length).toBe(0);
    });

    it('should provide previous step results in steps array for subsequent steps', async () => {
      const stepStartEvents: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0][] = [];
      let responseCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "step0" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-2',
                      toolName: 'tool1',
                      input: '{ "value": "step1" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 2:
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Final answer.' }],
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(4),
        onStepStart: async event => {
          stepStartEvents.push(event);
        },
      });

      expect(stepStartEvents.length).toBe(3);

      // Step 0: no previous steps
      expect(stepStartEvents[0].steps.length).toBe(0);

      // Step 1: has step 0's result
      expect(stepStartEvents[1].steps.length).toBe(1);
      expect(stepStartEvents[1].steps[0].finishReason).toBe('tool-calls');
      expect(stepStartEvents[1].steps[0].toolCalls.length).toBe(1);
      expect(stepStartEvents[1].steps[0].toolCalls[0].toolName).toBe('tool1');
      expect(stepStartEvents[1].steps[0].toolResults.length).toBe(1);
      expect(stepStartEvents[1].steps[0].toolResults[0].output).toBe(
        'step0-result',
      );

      // Step 2: has step 0 and step 1's results
      expect(stepStartEvents[2].steps.length).toBe(2);
      expect(stepStartEvents[2].steps[0].finishReason).toBe('tool-calls');
      expect(stepStartEvents[2].steps[1].finishReason).toBe('tool-calls');
      expect(stepStartEvents[2].steps[1].toolResults[0].output).toBe(
        'step1-result',
      );
    });

    it('should provide steps with correct text content from prior steps', async () => {
      const stepStartEvents: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0][] = [];
      let responseCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    { type: 'text', text: 'Thinking...' },
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "check" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
        onStepStart: async event => {
          stepStartEvents.push(event);
        },
      });

      expect(stepStartEvents.length).toBe(2);

      // Step 1 should see step 0's text
      expect(stepStartEvents[1].steps[0].text).toBe('Thinking...');
    });

    it('should pass runtimeContext', async () => {
      let stepStartEvent!: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        runtimeContext: { userId: 'test-user', requestId: 'req-123' },
        onStepStart: async event => {
          stepStartEvent = event;
        },
      });

      expect(stepStartEvent.runtimeContext).toEqual({
        userId: 'test-user',
        requestId: 'req-123',
      });
    });

    it('should pass updated runtimeContext from prepareStep', async () => {
      const stepStartEvents: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0][] = [];
      let responseCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "test" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        runtimeContext: { counter: 0 },
        stopWhen: isStepCount(3),
        prepareStep: async ({ runtimeContext, stepNumber }) => {
          return {
            runtimeContext: {
              counter: (runtimeContext as any).counter + 1,
              stepNumber,
            },
          };
        },
        onStepStart: async event => {
          stepStartEvents.push(event);
        },
      });

      expect(stepStartEvents[0].runtimeContext).toEqual({
        counter: 1,
        stepNumber: 0,
      });
      expect(stepStartEvents[1].runtimeContext).toEqual({
        counter: 2,
        stepNumber: 1,
      });
    });

    it('should pass initialInstructions, initialMessages, and responseMessages to prepareStep', async () => {
      const prepareStepCalls: Array<{
        instructions: Instructions | undefined;
        initialInstructions: Instructions | undefined;
        initialMessages: Array<ModelMessage>;
        responseMessages: Array<ModelMessage>;
        messages: Array<ModelMessage>;
      }> = [];
      let responseCount = 0;

      const model = new MockLanguageModelV4({
        doGenerate: async () => {
          switch (responseCount++) {
            case 0:
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: '{ "value": "test" }',
                  },
                ],
                finishReason: { unified: 'tool-calls', raw: undefined },
              };
            case 1:
            default:
              return {
                ...dummyResponseValues,
                content: [{ type: 'text', text: 'Done.' }],
              };
          }
        },
      });

      await generateText({
        model,
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        instructions: 'test instructions',
        messages: [{ role: 'user', content: 'test-input' }],
        stopWhen: isStepCount(3),
        prepareStep: async ({
          instructions,
          initialInstructions,
          initialMessages,
          responseMessages,
          messages,
          stepNumber,
        }) => {
          prepareStepCalls.push({
            instructions,
            initialInstructions,
            initialMessages: [...initialMessages],
            responseMessages: [...responseMessages],
            messages: [...messages],
          });

          return stepNumber === 0
            ? { instructions: 'prepared instructions' }
            : undefined;
        },
      });

      expect(prepareStepCalls).toHaveLength(2);
      expect(prepareStepCalls[0].instructions).toBe('test instructions');
      expect(prepareStepCalls[0].initialInstructions).toBe('test instructions');
      expect(prepareStepCalls[0].initialMessages).toEqual([
        { role: 'user', content: 'test-input' },
      ]);
      expect(prepareStepCalls[0].responseMessages).toEqual([]);
      expect(prepareStepCalls[0].messages).toEqual([
        { role: 'user', content: 'test-input' },
      ]);

      expect(prepareStepCalls[1].instructions).toBe('prepared instructions');
      expect(prepareStepCalls[1].initialInstructions).toBe('test instructions');
      expect(prepareStepCalls[1].initialMessages).toEqual([
        { role: 'user', content: 'test-input' },
      ]);
      expect(prepareStepCalls[1].responseMessages).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "value": "test",
                },
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "text",
                  "value": "test-result",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
      expect(prepareStepCalls[1].messages).toEqual([
        ...prepareStepCalls[1].initialMessages,
        ...prepareStepCalls[1].responseMessages,
      ]);
      expect(model.doGenerateCalls[1].prompt[0]).toEqual({
        role: 'system',
        content: 'prepared instructions',
      });
    });

    it('should pass updated toolsContext from prepareStep', async () => {
      const prepareStepToolsContexts: Array<unknown> = [];
      const stepStartEvents: Parameters<
        GenerateTextOnStepStartCallback<any, any>
      >[0][] = [];
      let responseCount = 0;
      let recordedToolContext: unknown;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "test" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ label: z.string() }),
            execute: async (_, { context }) => {
              recordedToolContext = context;
              return 'test-result';
            },
          }),
        },
        prompt: 'test-input',
        toolsContext: { tool1: { label: 'initial' } },
        stopWhen: isStepCount(3),
        prepareStep: async ({ stepNumber, toolsContext }) => {
          prepareStepToolsContexts.push(toolsContext);

          if (stepNumber === 0) {
            return {
              toolsContext: {
                tool1: { label: 'updated' },
              },
            };
          }

          return undefined;
        },
        onStepStart: async event => {
          stepStartEvents.push(event);
        },
      });

      expect(prepareStepToolsContexts).toEqual([
        { tool1: { label: 'initial' } },
        { tool1: { label: 'updated' } },
      ]);
      expect(stepStartEvents[0].toolsContext).toEqual({
        tool1: { label: 'updated' },
      });
      expect(stepStartEvents[1].toolsContext).toEqual({
        tool1: { label: 'updated' },
      });
      expect(recordedToolContext).toEqual({ label: 'updated' });
    });
  });

  describe('options.onStepEnd stepNumber', () => {
    it('should call onStepEnd with step result', async () => {
      let stepEndEvent!: Parameters<GenerateTextOnStepEndCallback<any, any>>[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        onStepEnd: async event => {
          stepEndEvent = event;
        },
      });

      expect(stepEndEvent.stepNumber).toBe(0);
    });

    it('should prefer onStepEnd over deprecated onStepFinish', async () => {
      const calls: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        onStepEnd: async () => {
          calls.push('onStepEnd');
        },
        onStepFinish: async () => {
          calls.push('onStepFinish');
        },
      });

      expect(calls).toEqual(['onStepEnd']);
    });
  });

  describe('options.onStepFinish stepNumber', () => {
    it('should pass stepNumber 0 for a single step', async () => {
      let stepFinishEvent!: Parameters<
        GenerateTextOnStepFinishCallback<any, any>
      >[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        onStepFinish: async event => {
          stepFinishEvent = event;
        },
      });

      expect(stepFinishEvent.stepNumber).toBe(0);
    });

    it('should pass correct stepNumber for each step in a multi-step tool loop', async () => {
      const stepNumbers: number[] = [];
      let responseCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "test" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-2',
                      toolName: 'tool1',
                      input: '{ "value": "test2" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 2:
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(4),
        onStepFinish: async event => {
          stepNumbers.push(event.stepNumber);
        },
      });

      expect(stepNumbers).toEqual([0, 1, 2]);
    });

    it('should have matching stepNumber between onStepStart and onStepFinish', async () => {
      const startStepNumbers: number[] = [];
      const finishStepNumbers: number[] = [];
      let responseCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "test" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        stopWhen: isStepCount(3),
        onStepStart: async event => {
          startStepNumbers.push(event.stepNumber);
        },
        onStepFinish: async event => {
          finishStepNumbers.push(event.stepNumber);
        },
      });

      expect(startStepNumbers).toEqual(finishStepNumbers);
    });
  });

  describe('options.onLanguageModelCallStart and onLanguageModelCallEnd', () => {
    it('should fire the model-call callbacks before tool execution and step finish', async () => {
      const callOrder: string[] = [];
      let modelCallStartEvent!: LanguageModelCallStartEvent;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        instructions: 'test-system',
        prompt: 'test-input',
        maxOutputTokens: 128,
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1,
        stopSequences: ['stop'],
        seed: 123,
        reasoning: 'high',
        onStepStart: async () => {
          callOrder.push('onStepStart');
        },
        onLanguageModelCallStart: async event => {
          callOrder.push('onLanguageModelCallStart');
          modelCallStartEvent = event;
        },
        onLanguageModelCallEnd: async () => {
          callOrder.push('onLanguageModelCallEnd');
        },
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
        onToolExecutionEnd: async () => {
          callOrder.push('onToolExecutionEnd');
        },
        onStepFinish: async () => {
          callOrder.push('onStepFinish');
        },
        _internal: {
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      expect(callOrder).toEqual([
        'onStepStart',
        'onLanguageModelCallStart',
        'onLanguageModelCallEnd',
        'onToolExecutionStart',
        'onToolExecutionEnd',
        'onStepFinish',
      ]);
      expect(modelCallStartEvent).toMatchInlineSnapshot(`
        {
          "callId": "test-telemetry-call-id",
          "frequencyPenalty": 0.1,
          "instructions": "test-system",
          "maxOutputTokens": 128,
          "messages": [
            {
              "content": "test-input",
              "role": "user",
            },
          ],
          "modelId": "mock-model-id",
          "presencePenalty": 0.2,
          "provider": "mock-provider",
          "reasoning": "high",
          "seed": 123,
          "stopSequences": [
            "stop",
          ],
          "temperature": 0.7,
          "tools": [
            {
              "inputSchema": {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "additionalProperties": false,
                "properties": {
                  "value": {
                    "type": "string",
                  },
                },
                "required": [
                  "value",
                ],
                "type": "object",
              },
              "name": "tool1",
              "type": "function",
            },
          ],
          "topK": 40,
          "topP": 0.9,
        }
      `);
    });

    it('should provide parsed tool calls on model-call end', async () => {
      const modelCallEndEvents: LanguageModelCallEndEvent<any>[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              { type: 'text', text: 'Before tool.' },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test-arg" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            response: {
              id: 'response-1',
              timestamp: new Date('2025-01-01T00:00:00.000Z'),
              modelId: 'mock-response-model',
              headers: { 'x-test': 'true' },
            },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        onLanguageModelCallEnd: async event => {
          modelCallEndEvents.push(event);
        },
        ...defaultSettings(),
      });

      expect(modelCallEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "text": "Before tool.",
                "type": "text",
              },
              {
                "input": {
                  "value": "test-arg",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
            ],
            "finishReason": "tool-calls",
            "modelId": "mock-model-id",
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "timeToFirstOutputMs": undefined,
            },
            "provider": "mock-provider",
            "responseId": "response-1",
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            },
          },
        ]
      `);
    });
  });

  describe('options.onToolExecutionStart', () => {
    it('should use experimental_onToolCallStart as a fallback', async () => {
      const callOrder: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        experimental_onToolCallStart: async () => {
          callOrder.push('experimental_onToolCallStart');
        },
        ...defaultSettings(),
      });

      expect(callOrder).toEqual(['experimental_onToolCallStart']);
    });

    it('should prefer onToolExecutionStart over experimental_onToolCallStart', async () => {
      const callOrder: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        experimental_onToolCallStart: async () => {
          callOrder.push('experimental_onToolCallStart');
        },
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
        ...defaultSettings(),
      });

      expect(callOrder).toEqual(['onToolExecutionStart']);
    });

    it('should be called with correct tool name, id, and input', async () => {
      const toolExecutionStartEvents: ToolExecutionStartEvent<any>[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test-arg" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        _internal: {
          generateId: () => 'test-call-id',
          generateCallId: () => 'test-telemetry-call-id',
        },
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
      });

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "test-input",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "test-arg",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
          },
        ]
      `);
    });

    it('should be called once per tool call in a multi-tool step', async () => {
      const toolExecutionStartEvents: ToolExecutionStartEvent<any>[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "a" }',
              },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-2',
                toolName: 'tool1',
                input: '{ "value": "b" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        ...defaultSettings(),
      });

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "a",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
          },
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "b",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-2",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
          },
        ]
      `);
    });

    it('should be called before tool execution', async () => {
      const callOrder: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => {
              callOrder.push('execute');
              return `${value}-result`;
            },
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
      });

      expect(callOrder.indexOf('onToolExecutionStart')).toBeLessThan(
        callOrder.indexOf('execute'),
      );
    });

    it('should not break generation when callback throws', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async () => {
          throw new Error('callback error');
        },
      });

      expect(result.toolResults.length).toBe(1);
      expect(result.toolResults[0].output).toBe('test-result');
    });

    it('should not fire for tools without execute', async () => {
      const toolExecutionStartEvents: ToolExecutionStartEvent<any>[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
      });

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`[]`);
    });

    it('should pass context', async () => {
      const toolExecutionStartEvents: ToolExecutionStartEvent<any>[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ context: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        toolsContext: { tool1: { context: 'test' } },
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        ...defaultSettings(),
      });

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
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
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": {
              "context": "test",
            },
          },
        ]
      `);
    });
  });

  describe('options.onToolExecutionEnd', () => {
    it('should use experimental_onToolCallFinish as a fallback', async () => {
      const callOrder: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        experimental_onToolCallFinish: async () => {
          callOrder.push('experimental_onToolCallFinish');
        },
        ...defaultSettings(),
      });

      expect(callOrder).toEqual(['experimental_onToolCallFinish']);
    });

    it('should prefer onToolExecutionEnd over experimental_onToolCallFinish', async () => {
      const callOrder: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        experimental_onToolCallFinish: async () => {
          callOrder.push('experimental_onToolCallFinish');
        },
        onToolExecutionEnd: async () => {
          callOrder.push('onToolExecutionEnd');
        },
        ...defaultSettings(),
      });

      expect(callOrder).toEqual(['onToolExecutionEnd']);
    });

    it('should be called with correct data on success', async () => {
      const toolExecutionEndEvents: ToolExecutionEndEvent<any>[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test-arg" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        ...defaultSettings(),
      });

      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "test-arg",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "test-arg",
              },
              "output": "test-arg-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          },
        ]
      `);
    });

    it('should be called with error data when tool execution fails', async () => {
      const toolExecutionEndEvents: ToolExecutionEndEvent<any>[] = [];
      const toolError = new Error('tool execution failed');

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async (): Promise<string> => {
              throw toolError;
            },
          }),
        },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        ...defaultSettings(),
      });

      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
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
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "error": [Error: tool execution failed],
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-error",
            },
          },
        ]
      `);
    });

    it('should have a positive toolExecutionMs', async () => {
      const toolExecutionEndEvents: ToolExecutionEndEvent<any>[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
      });

      expect(toolExecutionEndEvents[0].toolExecutionMs).toBeGreaterThanOrEqual(
        0,
      );
      expect(typeof toolExecutionEndEvents[0].toolExecutionMs).toBe('number');
    });

    it('should not break generation when callback throws', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionEnd: async () => {
          throw new Error('callback error');
        },
      });

      expect(result.toolResults.length).toBe(1);
      expect(result.toolResults[0].output).toBe('test-result');
    });

    it('should not fire for tools without execute', async () => {
      const toolExecutionEndEvents: ToolExecutionEndEvent<any>[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        prompt: 'test-input',
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
      });

      expect(toolExecutionEndEvents.length).toBe(0);
    });

    it('should pass context on success', async () => {
      const toolExecutionEndEvents: ToolExecutionEndEvent<any>[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ context: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        toolsContext: { tool1: { context: 'test' } },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        ...defaultSettings(),
      });

      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
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
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": {
              "context": "test",
            },
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "test",
              },
              "output": "test-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          },
        ]
      `);
    });

    it('should pass context on error', async () => {
      const toolExecutionEndEvents: ToolExecutionEndEvent<any>[] = [];
      const toolError = new Error('Tool execution failed');

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ context: z.string() }),
            execute: async (): Promise<string> => {
              throw toolError;
            },
          }),
        },
        toolsContext: { tool1: { context: 'test' } },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        ...defaultSettings(),
      });

      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
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
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": {
              "context": "test",
            },
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "error": [Error: Tool execution failed],
              "input": {
                "value": "test",
              },
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-error",
            },
          },
        ]
      `);
    });
  });

  describe('options.onToolExecutionStart and onToolExecutionEnd ordering', () => {
    it('should call start before finish', async () => {
      const callOrder: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
        onToolExecutionEnd: async () => {
          callOrder.push('onToolExecutionEnd');
        },
      });

      expect(callOrder).toEqual(['onToolExecutionStart', 'onToolExecutionEnd']);
    });

    it('should fire both tool call callbacks before onStepFinish', async () => {
      const callOrder: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: '{ "value": "test" }',
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
        onToolExecutionStart: async () => {
          callOrder.push('onToolExecutionStart');
        },
        onToolExecutionEnd: async () => {
          callOrder.push('onToolExecutionEnd');
        },
        onStepFinish: async () => {
          callOrder.push('onStepFinish');
        },
      });

      expect(callOrder).toEqual([
        'onToolExecutionStart',
        'onToolExecutionEnd',
        'onStepFinish',
      ]);
    });

    it('should fire tool call callbacks for each tool in a multi-step loop', async () => {
      const toolExecutionStartEvents: ToolExecutionStartEvent<any>[] = [];
      const toolExecutionEndEvents: ToolExecutionEndEvent<any>[] = [];

      let responseCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "step0" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-2',
                      toolName: 'tool1',
                      input: '{ "value": "step1" }',
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 2:
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done.' }],
                };
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        stopWhen: isStepCount(4),
        onToolExecutionStart: async event => {
          toolExecutionStartEvents.push(event);
        },
        onToolExecutionEnd: async event => {
          toolExecutionEndEvents.push(event);
        },
        ...defaultSettings(),
      });

      expect(toolExecutionStartEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "step0",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
          },
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "step0",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "step0-result",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
            ],
            "toolCall": {
              "input": {
                "value": "step1",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-2",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
          },
        ]
      `);
      expect(toolExecutionEndEvents).toMatchInlineSnapshot(`
        [
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
            ],
            "toolCall": {
              "input": {
                "value": "step0",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "step0",
              },
              "output": "step0-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          },
          {
            "callId": "test-telemetry-call-id",
            "messages": [
              {
                "content": "prompt",
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "step0",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "step0-result",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
            ],
            "toolCall": {
              "input": {
                "value": "step1",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-2",
              "toolName": "tool1",
              "type": "tool-call",
            },
            "toolContext": undefined,
            "toolExecutionMs": 0,
            "toolOutput": {
              "dynamic": false,
              "input": {
                "value": "step1",
              },
              "output": "step1-result",
              "toolCallId": "call-2",
              "toolName": "tool1",
              "type": "tool-result",
            },
          },
        ]
      `);
    });
  });

  describe('options.onEnd', () => {
    it('should send correct information', async () => {
      let result!: Parameters<GenerateTextOnEndCallback<any, any>>[0];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [
              { type: 'text', text: 'Hello, World!' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
            ],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
            response: {
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
              headers: { call: '2' },
              providerMetadata: {
                testProvider: { testKey: 'testValue' },
              },
            },
            warnings: [],
          }),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          },
        },
        _internal: {
          generateId: () => 'test-call-id',
          generateCallId: () => 'test-telemetry-call-id',
        },
        onEnd: async event => {
          result = event as unknown as typeof result;
        },
        prompt: 'irrelevant',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "callId": "test-telemetry-call-id",
          "content": [
            {
              "text": "Hello, World!",
              "type": "text",
            },
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "dynamic": false,
              "input": {
                "value": "value",
              },
              "output": "value-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          ],
          "dynamicToolCalls": [],
          "dynamicToolResults": [],
          "files": [],
          "finalStep": DefaultStepResult {
            "callId": "test-telemetry-call-id",
            "content": [
              {
                "text": "Hello, World!",
                "type": "text",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "value",
                },
                "output": "value-result",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "finishReason": "stop",
            "model": {
              "modelId": "mock-model-id",
              "provider": "mock-provider",
            },
            "performance": {
              "effectiveOutputTokensPerSecond": 0,
              "effectiveTotalTokensPerSecond": 0,
              "inputTokensPerSecond": undefined,
              "outputTokensPerSecond": undefined,
              "responseTimeMs": 0,
              "stepTimeMs": 0,
              "timeToFirstOutputMs": undefined,
              "toolExecutionMs": {
                "call-1": 0,
              },
            },
            "providerMetadata": undefined,
            "rawFinishReason": "stop",
            "request": {
              "body": undefined,
              "messages": undefined,
            },
            "response": {
              "body": undefined,
              "headers": {
                "call": "2",
              },
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "Hello, World!",
                      "type": "text",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "value-result",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            },
            "runtimeContext": {},
            "stepNumber": 0,
            "toolsContext": {},
            "usage": {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 3,
              },
              "inputTokens": 3,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 10,
              },
              "outputTokens": 10,
              "raw": undefined,
              "totalTokens": 13,
            },
            "warnings": [],
          },
          "finishReason": "stop",
          "model": {
            "modelId": "mock-model-id",
            "provider": "mock-provider",
          },
          "providerMetadata": undefined,
          "rawFinishReason": "stop",
          "reasoning": [],
          "reasoningText": undefined,
          "request": {
            "body": undefined,
            "messages": undefined,
          },
          "response": {
            "body": undefined,
            "headers": {
              "call": "2",
            },
            "id": "id-0",
            "messages": [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "Hello, World!",
                    "type": "text",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "value-result",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
            ],
            "modelId": "mock-model-id",
            "timestamp": 1970-01-01T00:00:00.000Z,
          },
          "responseMessages": [
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, World!",
                  "type": "text",
                },
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "output": {
                    "type": "text",
                    "value": "value-result",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
          ],
          "runtimeContext": {},
          "sources": [],
          "staticToolCalls": [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
          ],
          "staticToolResults": [
            {
              "dynamic": false,
              "input": {
                "value": "value",
              },
              "output": "value-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          ],
          "stepNumber": 0,
          "steps": [
            DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "text": "Hello, World!",
                  "type": "text",
                },
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "value": "value",
                  },
                  "output": "value-result",
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
              "performance": {
                "effectiveOutputTokensPerSecond": 0,
                "effectiveTotalTokensPerSecond": 0,
                "inputTokensPerSecond": undefined,
                "outputTokensPerSecond": undefined,
                "responseTimeMs": 0,
                "stepTimeMs": 0,
                "timeToFirstOutputMs": undefined,
                "toolExecutionMs": {
                  "call-1": 0,
                },
              },
              "providerMetadata": undefined,
              "rawFinishReason": "stop",
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "body": undefined,
                "headers": {
                  "call": "2",
                },
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "Hello, World!",
                        "type": "text",
                      },
                      {
                        "input": {
                          "value": "value",
                        },
                        "providerExecuted": undefined,
                        "providerOptions": undefined,
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-call",
                      },
                    ],
                    "role": "assistant",
                  },
                  {
                    "content": [
                      {
                        "output": {
                          "type": "text",
                          "value": "value-result",
                        },
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-result",
                      },
                    ],
                    "role": "tool",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
              "usage": {
                "inputTokenDetails": {
                  "cacheReadTokens": undefined,
                  "cacheWriteTokens": undefined,
                  "noCacheTokens": 3,
                },
                "inputTokens": 3,
                "outputTokenDetails": {
                  "reasoningTokens": undefined,
                  "textTokens": 10,
                },
                "outputTokens": 10,
                "raw": undefined,
                "totalTokens": 13,
              },
              "warnings": [],
            },
          ],
          "text": "Hello, World!",
          "toolCalls": [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
          ],
          "toolResults": [
            {
              "dynamic": false,
              "input": {
                "value": "value",
              },
              "output": "value-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          ],
          "toolsContext": {},
          "totalUsage": {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 3,
            },
            "inputTokens": 3,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 10,
            },
            "outputTokens": 10,
            "totalTokens": 13,
          },
          "usage": {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 3,
            },
            "inputTokens": 3,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 10,
            },
            "outputTokens": 10,
            "totalTokens": 13,
          },
          "warnings": [],
        }
      `);
    });

    it('should support onFinish as a deprecated alias', async () => {
      const calls: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello, World!' }],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
            warnings: [],
          }),
        }),
        prompt: 'irrelevant',
        onFinish: async () => {
          calls.push('onFinish');
        },
      });

      expect(calls).toEqual(['onFinish']);
    });

    it('should prefer onEnd over onFinish', async () => {
      const calls: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello, World!' }],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: testUsage,
            warnings: [],
          }),
        }),
        prompt: 'irrelevant',
        onEnd: async () => {
          calls.push('onEnd');
        },
        onFinish: async () => {
          calls.push('onFinish');
        },
      });

      expect(calls).toEqual(['onEnd']);
    });
  });

  describe('options.stopWhen', () => {
    let result: GenerateTextResult<any, any, any>;
    let onFinishResult: Parameters<GenerateTextOnEndCallback<any, any>>[0];
    let onStepFinishResults: StepResult<any, any>[];

    beforeEach(() => {
      result = undefined as any;
      onFinishResult = undefined as any;
      onStepFinishResults = [];
    });

    describe('2 steps: initial, tool-result', () => {
      beforeEach(async () => {
        let responseCount = 0;
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async ({ prompt, tools, toolChoice }) => {
              switch (responseCount++) {
                case 0:
                  expect(tools).toStrictEqual([
                    {
                      type: 'function',
                      name: 'tool1',
                      inputSchema: {
                        $schema: 'http://json-schema.org/draft-07/schema#',
                        additionalProperties: false,
                        properties: { value: { type: 'string' } },
                        required: ['value'],
                        type: 'object',
                      },
                    },
                  ]);

                  expect(toolChoice).toStrictEqual({ type: 'auto' });

                  expect(prompt).toStrictEqual([
                    {
                      role: 'user',
                      content: [{ type: 'text', text: 'test-input' }],
                      providerOptions: undefined,
                    },
                  ]);

                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallType: 'function',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                    ],
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: {
                      inputTokens: {
                        total: 10,
                        noCache: 10,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 5,
                        text: 5,
                        reasoning: undefined,
                      },
                    },
                    response: {
                      id: 'test-id-1-from-model',
                      timestamp: new Date(0),
                      modelId: 'test-response-model-id',
                    },
                  };
                case 1:
                  return {
                    ...dummyResponseValues,
                    content: [{ type: 'text', text: 'Hello, world!' }],
                    response: {
                      id: 'test-id-2-from-model',
                      timestamp: new Date(10000),
                      modelId: 'test-response-model-id',
                      headers: {
                        'custom-response-header': 'response-header-value',
                      },
                    },
                  };
                default:
                  throw new Error(
                    `Unexpected response count: ${responseCount}`,
                  );
              }
            },
          }),
          tools: {
            tool1: tool({
              title: 'Tool One',
              inputSchema: z.object({ value: z.string() }),
              execute: async (args, options) => {
                expect(args).toStrictEqual({ value: 'value' });
                expect(options.messages).toStrictEqual([
                  { role: 'user', content: 'test-input' },
                ]);
                return 'result1';
              },
            }),
          },
          prompt: 'test-input',
          _internal: {
            generateId: () => 'test-call-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
          onFinish: async event => {
            onFinishResult = event as unknown as typeof onFinishResult;
          },
          onStepFinish: async event => {
            onStepFinishResults.push(event);
          },
          stopWhen: isStepCount(3),
        });
      });

      it('result.text should return text from last step', async () => {
        assert.deepStrictEqual(result.text, 'Hello, world!');
      });

      it('result.toolCalls should contain tool calls from all steps', async () => {
        expect(result.toolCalls.map(toolCall => toolCall.toolCallId)).toEqual([
          'call-1',
        ]);
      });

      it('result.finalStep.toolCalls should return empty tool calls from last step', async () => {
        assert.deepStrictEqual(result.finalStep.toolCalls, []);
      });

      it('result.toolResults should contain tool results from all steps', async () => {
        expect(
          result.toolResults.map(toolResult => toolResult.toolCallId),
        ).toEqual(['call-1']);
      });

      it('result.finalStep.toolResults should return empty tool results from last step', async () => {
        assert.deepStrictEqual(result.finalStep.toolResults, []);
      });

      it('result.responseMessages should contain response messages from all steps', () => {
        expect(result.responseMessages).toMatchSnapshot();
      });

      it('result.totalUsage should sum token usage', () => {
        expect(result.totalUsage).toMatchInlineSnapshot(`
          {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 13,
            },
            "inputTokens": 13,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 15,
            },
            "outputTokens": 15,
            "totalTokens": 28,
          }
        `);
      });

      it('result.usage should sum token usage', async () => {
        expect(result.usage).toMatchInlineSnapshot(`
          {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 13,
            },
            "inputTokens": 13,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 15,
            },
            "outputTokens": 15,
            "totalTokens": 28,
          }
        `);
      });

      it('result.finalStep.usage should contain token usage from final step', async () => {
        expect(result.finalStep.usage).toMatchInlineSnapshot(`
          {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 3,
            },
            "inputTokens": 3,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 10,
            },
            "outputTokens": 10,
            "raw": undefined,
            "totalTokens": 13,
          }
        `);
      });

      it('onFinishResult.usage should sum token usage and finalStep should contain final step usage', () => {
        expect(onFinishResult.usage).toEqual(result.usage);
        expect(onFinishResult.usage).toEqual(result.totalUsage);
        expect(onFinishResult.totalUsage).toEqual(result.totalUsage);
        expect(onFinishResult.finalStep).toBe(onFinishResult.steps.at(-1));
        expect(onFinishResult.finalStep.usage).toEqual(result.finalStep.usage);
      });

      it('onFinishResult should expose deprecated AI SDK 6 final-step properties', () => {
        expect(onFinishResult.reasoning).toEqual(result.finalStep.reasoning);
        expect(onFinishResult.reasoningText).toEqual(
          result.finalStep.reasoningText,
        );
        expect(onFinishResult.request).toEqual(result.finalStep.request);
        expect(onFinishResult.response).toEqual(result.finalStep.response);
        expect(onFinishResult.providerMetadata).toEqual(
          result.finalStep.providerMetadata,
        );
      });

      it('result.steps should contain all steps', () => {
        expect(result.steps).toMatchSnapshot();
      });

      describe('callbacks', () => {
        it('onFinish should send correct information', async () => {
          expect(onFinishResult).toMatchSnapshot();
        });

        it('onStepFinish should be called for each step', () => {
          expect(onStepFinishResults).toMatchSnapshot();
        });
      });
    });

    describe('2 steps: initial, tool-result with prepareStep', () => {
      let result: GenerateTextResult<any, any, any>;
      let onStepFinishResults: StepResult<any, any>[];
      let doGenerateCalls: Array<LanguageModelV4CallOptions>;
      let prepareStepCalls: Array<{
        modelId: string;
        stepNumber: number;
        steps: Array<StepResult<any, any>>;
        messages: Array<ModelMessage>;
        runtimeContext: unknown;
      }>;

      beforeEach(async () => {
        onStepFinishResults = [];
        doGenerateCalls = [];
        prepareStepCalls = [];

        let responseCount = 0;

        const trueModel = new MockLanguageModelV4({
          doGenerate: async ({ prompt, tools, toolChoice }) => {
            doGenerateCalls.push({ prompt, tools, toolChoice });

            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: `{ "value": "value" }`,
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                  usage: {
                    inputTokens: {
                      total: 10,
                      noCache: 10,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 5,
                      text: 5,
                      reasoning: undefined,
                    },
                  },
                  response: {
                    id: 'test-id-1-from-model',
                    timestamp: new Date(0),
                    modelId: 'test-response-model-id',
                  },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Hello, world!' }],
                  response: {
                    id: 'test-id-2-from-model',
                    timestamp: new Date(10000),
                    modelId: 'test-response-model-id',
                    headers: {
                      'custom-response-header': 'response-header-value',
                    },
                  },
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        });

        result = await generateText({
          model: modelWithFiles,
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async (args, options) => {
                expect(args).toStrictEqual({ value: 'value' });
                expect(options.messages).toStrictEqual([
                  { role: 'user', content: 'new input from prepareStep' },
                ]);
                return 'result1';
              },
            }),
          },
          runtimeContext: { context: 'state1' },
          prompt: 'test-input',
          _internal: {
            generateId: () => 'test-call-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
          stopWhen: isStepCount(3),
          onStepFinish: async event => {
            onStepFinishResults.push(event);
          },
          prepareStep: async ({
            model,
            stepNumber,
            steps,
            messages,
            runtimeContext,
          }) => {
            prepareStepCalls.push({
              modelId: typeof model === 'string' ? model : model.modelId,
              stepNumber,
              steps,
              messages,
              runtimeContext,
            });

            if (stepNumber === 0) {
              expect(steps).toStrictEqual([]);

              return {
                model: trueModel,
                toolChoice: {
                  type: 'tool',
                  toolName: 'tool1' as const,
                },
                instructions: 'system-message-0',
                messages: [
                  {
                    role: 'user',
                    content: 'new input from prepareStep',
                  },
                ],
                runtimeContext: { context: 'state2' },
              };
            }

            if (stepNumber === 1) {
              expect(steps.length).toStrictEqual(1);
              return {
                model: trueModel,
                activeTools: [],
                instructions: 'system-message-1',
                runtimeContext: { context: 'state3' },
              };
            }
          },
        });
      });

      it('should contain all prepareStep calls', async () => {
        expect(prepareStepCalls).toMatchInlineSnapshot(`
          [
            {
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "modelId": "mock-model-id",
              "runtimeContext": {
                "context": "state1",
              },
              "stepNumber": 0,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 0,
                    "effectiveTotalTokensPerSecond": 0,
                    "inputTokensPerSecond": undefined,
                    "outputTokensPerSecond": undefined,
                    "responseTimeMs": 0,
                    "stepTimeMs": 0,
                    "timeToFirstOutputMs": undefined,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "body": undefined,
                    "headers": undefined,
                    "id": "test-id-1-from-model",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "test-response-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {
                    "context": "state2",
                  },
                  "stepNumber": 0,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 10,
                    },
                    "inputTokens": 10,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 5,
                    },
                    "outputTokens": 5,
                    "raw": undefined,
                    "totalTokens": 15,
                  },
                  "warnings": [],
                },
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "text": "Hello, world!",
                      "type": "text",
                    },
                  ],
                  "finishReason": "stop",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 0,
                    "effectiveTotalTokensPerSecond": 0,
                    "inputTokensPerSecond": undefined,
                    "outputTokensPerSecond": undefined,
                    "responseTimeMs": 0,
                    "stepTimeMs": 0,
                    "timeToFirstOutputMs": undefined,
                    "toolExecutionMs": {},
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": "stop",
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "body": undefined,
                    "headers": {
                      "custom-response-header": "response-header-value",
                    },
                    "id": "test-id-2-from-model",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "Hello, world!",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "test-response-model-id",
                    "timestamp": 1970-01-01T00:00:10.000Z,
                  },
                  "runtimeContext": {
                    "context": "state3",
                  },
                  "stepNumber": 1,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 3,
                    },
                    "inputTokens": 3,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 10,
                    },
                    "outputTokens": 10,
                    "raw": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
            },
            {
              "messages": [
                {
                  "content": "new input from prepareStep",
                  "role": "user",
                },
                {
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "result1",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
              ],
              "modelId": "mock-model-id",
              "runtimeContext": {
                "context": "state2",
              },
              "stepNumber": 1,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 0,
                    "effectiveTotalTokensPerSecond": 0,
                    "inputTokensPerSecond": undefined,
                    "outputTokensPerSecond": undefined,
                    "responseTimeMs": 0,
                    "stepTimeMs": 0,
                    "timeToFirstOutputMs": undefined,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "body": undefined,
                    "headers": undefined,
                    "id": "test-id-1-from-model",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "test-response-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {
                    "context": "state2",
                  },
                  "stepNumber": 0,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 10,
                    },
                    "inputTokens": 10,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 5,
                    },
                    "outputTokens": 5,
                    "raw": undefined,
                    "totalTokens": 15,
                  },
                  "warnings": [],
                },
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "text": "Hello, world!",
                      "type": "text",
                    },
                  ],
                  "finishReason": "stop",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 0,
                    "effectiveTotalTokensPerSecond": 0,
                    "inputTokensPerSecond": undefined,
                    "outputTokensPerSecond": undefined,
                    "responseTimeMs": 0,
                    "stepTimeMs": 0,
                    "timeToFirstOutputMs": undefined,
                    "toolExecutionMs": {},
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": "stop",
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "body": undefined,
                    "headers": {
                      "custom-response-header": "response-header-value",
                    },
                    "id": "test-id-2-from-model",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "Hello, world!",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "test-response-model-id",
                    "timestamp": 1970-01-01T00:00:10.000Z,
                  },
                  "runtimeContext": {
                    "context": "state3",
                  },
                  "stepNumber": 1,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 3,
                    },
                    "inputTokens": 3,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 10,
                    },
                    "outputTokens": 10,
                    "raw": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
            },
          ]
        `);
      });

      it('doGenerate should be called with the correct arguments', () => {
        expect(doGenerateCalls).toMatchInlineSnapshot(`
          [
            {
              "prompt": [
                {
                  "content": "system-message-0",
                  "role": "system",
                },
                {
                  "content": [
                    {
                      "text": "new input from prepareStep",
                      "type": "text",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "user",
                },
              ],
              "toolChoice": {
                "toolName": "tool1",
                "type": "tool",
              },
              "tools": [
                {
                  "inputSchema": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "additionalProperties": false,
                    "properties": {
                      "value": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "value",
                    ],
                    "type": "object",
                  },
                  "name": "tool1",
                  "type": "function",
                },
              ],
            },
            {
              "prompt": [
                {
                  "content": "system-message-1",
                  "role": "system",
                },
                {
                  "content": [
                    {
                      "text": "new input from prepareStep",
                      "type": "text",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "user",
                },
                {
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "result1",
                      },
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "tool",
                },
              ],
              "toolChoice": {
                "type": "auto",
              },
              "tools": undefined,
            },
          ]
        `);
      });

      it('result.text should return text from last step', async () => {
        expect(result.text).toStrictEqual('Hello, world!');
      });

      it('result.toolCalls should contain tool calls from all steps', async () => {
        expect(result.toolCalls.map(toolCall => toolCall.toolCallId)).toEqual([
          'call-1',
        ]);
      });

      it('result.finalStep.toolCalls should return empty tool calls from last step', async () => {
        expect(result.finalStep.toolCalls).toStrictEqual([]);
      });

      it('result.toolResults should contain tool results from all steps', async () => {
        expect(
          result.toolResults.map(toolResult => toolResult.toolCallId),
        ).toEqual(['call-1']);
      });

      it('result.finalStep.toolResults should return empty tool results from last step', async () => {
        expect(result.finalStep.toolResults).toStrictEqual([]);
      });

      it('result.responseMessages should contain response messages from all steps', () => {
        expect(result.responseMessages).toMatchSnapshot();
      });

      it('result.totalUsage should sum token usage', () => {
        expect(result.totalUsage).toMatchInlineSnapshot(`
          {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 13,
            },
            "inputTokens": 13,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 15,
            },
            "outputTokens": 15,
            "totalTokens": 28,
          }
        `);
      });

      it('result.usage should sum token usage', async () => {
        expect(result.usage).toMatchInlineSnapshot(`
          {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 13,
            },
            "inputTokens": 13,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 15,
            },
            "outputTokens": 15,
            "totalTokens": 28,
          }
        `);
      });

      it('result.finalStep.usage should contain token usage from final step', async () => {
        expect(result.finalStep.usage).toMatchInlineSnapshot(`
          {
            "inputTokenDetails": {
              "cacheReadTokens": undefined,
              "cacheWriteTokens": undefined,
              "noCacheTokens": 3,
            },
            "inputTokens": 3,
            "outputTokenDetails": {
              "reasoningTokens": undefined,
              "textTokens": 10,
            },
            "outputTokens": 10,
            "raw": undefined,
            "totalTokens": 13,
          }
        `);
      });

      it('result.steps should contain all steps', () => {
        expect(result.steps).toMatchSnapshot();
      });

      it('onStepFinish should be called for each step', () => {
        expect(onStepFinishResults).toMatchSnapshot();
      });

      it('result.content should contain content from all steps', () => {
        expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "value",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-call",
          },
          {
            "dynamic": false,
            "input": {
              "value": "value",
            },
            "output": "result1",
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-result",
          },
          {
            "text": "Hello, world!",
            "type": "text",
          },
        ]
      `);
      });

      it('result.finalStep.content should contain content from the final step', () => {
        expect(result.finalStep.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Hello, world!",
            "type": "text",
          },
        ]
      `);
      });
    });

    describe('2 stop conditions', () => {
      let result: GenerateTextResult<any, any, any>;
      let stopConditionCalls: Array<{
        number: number;
        steps: StepResult<any, any>[];
      }>;

      beforeEach(async () => {
        stopConditionCalls = [];

        let responseCount = 0;
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => {
              switch (responseCount++) {
                case 0:
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallType: 'function',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                    ],
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: {
                      inputTokens: {
                        total: 10,
                        noCache: 10,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 5,
                        text: 5,
                        reasoning: undefined,
                      },
                    },
                    response: {
                      id: 'test-id-1-from-model',
                      timestamp: new Date(0),
                      modelId: 'test-response-model-id',
                    },
                  };
                default:
                  throw new Error(
                    `Unexpected response count: ${responseCount}`,
                  );
              }
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async (input, options) => {
                expect(input).toStrictEqual({ value: 'value' });
                expect(options.messages).toStrictEqual([
                  { role: 'user', content: 'test-input' },
                ]);
                return 'result1';
              },
            }),
          },
          prompt: 'test-input',
          _internal: {
            generateId: () => 'test-call-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
          stopWhen: [
            ({ steps }) => {
              stopConditionCalls.push({ number: 0, steps });
              return false;
            },
            ({ steps }) => {
              stopConditionCalls.push({ number: 1, steps });
              return true;
            },
          ],
        });
      });

      it('result.steps should contain a single step', () => {
        expect(result.steps.length).toStrictEqual(1);
      });

      it('stopConditionCalls should be called for each stop condition', () => {
        expect(stopConditionCalls).toMatchInlineSnapshot(`
          [
            {
              "number": 0,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 0,
                    "effectiveTotalTokensPerSecond": 0,
                    "inputTokensPerSecond": undefined,
                    "outputTokensPerSecond": undefined,
                    "responseTimeMs": 0,
                    "stepTimeMs": 0,
                    "timeToFirstOutputMs": undefined,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "body": undefined,
                    "headers": undefined,
                    "id": "test-id-1-from-model",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "test-response-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {},
                  "stepNumber": 0,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 10,
                    },
                    "inputTokens": 10,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 5,
                    },
                    "outputTokens": 5,
                    "raw": undefined,
                    "totalTokens": 15,
                  },
                  "warnings": [],
                },
              ],
            },
            {
              "number": 1,
              "steps": [
                DefaultStepResult {
                  "callId": "test-telemetry-call-id",
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "title": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                    {
                      "dynamic": false,
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "model": {
                    "modelId": "mock-model-id",
                    "provider": "mock-provider",
                  },
                  "performance": {
                    "effectiveOutputTokensPerSecond": 0,
                    "effectiveTotalTokensPerSecond": 0,
                    "inputTokensPerSecond": undefined,
                    "outputTokensPerSecond": undefined,
                    "responseTimeMs": 0,
                    "stepTimeMs": 0,
                    "timeToFirstOutputMs": undefined,
                    "toolExecutionMs": {
                      "call-1": 0,
                    },
                  },
                  "providerMetadata": undefined,
                  "rawFinishReason": undefined,
                  "request": {
                    "body": undefined,
                    "messages": undefined,
                  },
                  "response": {
                    "body": undefined,
                    "headers": undefined,
                    "id": "test-id-1-from-model",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "test-response-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "runtimeContext": {},
                  "stepNumber": 0,
                  "toolsContext": {},
                  "usage": {
                    "inputTokenDetails": {
                      "cacheReadTokens": undefined,
                      "cacheWriteTokens": undefined,
                      "noCacheTokens": 10,
                    },
                    "inputTokens": 10,
                    "outputTokenDetails": {
                      "reasoningTokens": undefined,
                      "textTokens": 5,
                    },
                    "outputTokens": 5,
                    "raw": undefined,
                    "totalTokens": 15,
                  },
                  "warnings": [],
                },
              ],
            },
          ]
        `);
      });
    });

    it('should complete tool loop with isLoopFinished()', async () => {
      let responseCount = 0;
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: `{ "value": "value" }`,
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done!' }],
                };
              default:
                throw new Error(`Unexpected response count: ${responseCount}`);
            }
          },
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result1',
          }),
        },
        prompt: 'test-input',
        stopWhen: isLoopFinished(),
      });

      expect(result.text).toBe('Done!');
      expect(result.steps).toHaveLength(2);
    });
  });

  describe('options.headers', () => {
    it('should pass headers to model', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ headers }) => {
            assert.equal(
              headers?.['custom-request-header'],
              'request-header-value',
            );

            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
        headers: { 'custom-request-header': 'request-header-value' },
      });

      assert.deepStrictEqual(result.text, 'Hello, world!');
    });
  });

  describe('options.providerOptions', () => {
    it('should pass provider options to model', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ providerOptions }) => {
            expect(providerOptions).toStrictEqual({
              aProvider: { someKey: 'someValue' },
            });

            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'provider metadata test' }],
            };
          },
        }),
        prompt: 'test-input',
        providerOptions: {
          aProvider: { someKey: 'someValue' },
        },
      });

      expect(result.text).toStrictEqual('provider metadata test');
    });
  });

  describe('options.reasoning', () => {
    it('should pass reasoning to model doGenerate call', async () => {
      const model = new MockLanguageModelV4({
        doGenerate: {
          ...dummyResponseValues,
          content: [{ type: 'text', text: 'test' }],
        },
      });

      await generateText({
        model,
        prompt: 'test-input',
        reasoning: 'high',
      });

      expect(model.doGenerateCalls[0].reasoning).toBe('high');
    });

    it('should pass through provider-default', async () => {
      const model = new MockLanguageModelV4({
        doGenerate: {
          ...dummyResponseValues,
          content: [{ type: 'text', text: 'test' }],
        },
      });

      await generateText({
        model,
        prompt: 'test-input',
        reasoning: 'provider-default',
      });

      expect(model.doGenerateCalls[0].reasoning).toBe('provider-default');
    });
  });

  describe('options.abortSignal', () => {
    it('should forward abort signal to tool execution', async () => {
      const abortController = new AbortController();
      const toolExecuteMock = vi.fn().mockResolvedValue('tool result');

      const generateTextPromise = generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
            ],
          }),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: toolExecuteMock,
          },
        },
        prompt: 'test-input',
        abortSignal: abortController.signal,
      });

      // Abort the operation
      abortController.abort();

      await generateTextPromise;

      expect(toolExecuteMock).toHaveBeenCalledWith(
        { value: 'value' },
        {
          abortSignal: abortController.signal,
          toolCallId: 'call-1',
          messages: expect.any(Array),
          context: undefined,
        },
      );
    });
  });

  describe('options.timeout', () => {
    it('should forward timeout as abort signal to model', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
        timeout: 5000,
      });

      expect(receivedAbortSignal).toBeDefined();
    });

    it('should merge timeout with abort signal', async () => {
      const abortController = new AbortController();
      let receivedAbortSignal: AbortSignal | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
        timeout: 5000,
        abortSignal: abortController.signal,
      });

      // The merged signal should be different from the original
      expect(receivedAbortSignal).toBeDefined();
      expect(receivedAbortSignal).not.toBe(abortController.signal);
    });

    it('should pass undefined when no timeout or abortSignal provided', async () => {
      let receivedAbortSignal: AbortSignal | undefined = 'not-set' as any;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
      });

      expect(receivedAbortSignal).toBeUndefined();
    });

    it('should forward timeout abort signal to tool execution', async () => {
      const toolExecuteMock = vi.fn().mockResolvedValue('tool result');

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
            ],
          }),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: toolExecuteMock,
          },
        },
        prompt: 'test-input',
        timeout: 5000,
      });

      expect(toolExecuteMock).toHaveBeenCalledWith(
        { value: 'value' },
        {
          abortSignal: expect.any(AbortSignal),
          toolCallId: 'call-1',
          messages: expect.any(Array),
          context: undefined,
        },
      );
    });

    it('should support timeout object with totalMs', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
        timeout: { totalMs: 5000 },
      });

      expect(receivedAbortSignal).toBeDefined();
    });

    it('should merge timeout object with abort signal', async () => {
      const abortController = new AbortController();
      let receivedAbortSignal: AbortSignal | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
        timeout: { totalMs: 5000 },
        abortSignal: abortController.signal,
      });

      // The merged signal should be different from the original
      expect(receivedAbortSignal).toBeDefined();
      expect(receivedAbortSignal).not.toBe(abortController.signal);
    });

    it('should pass undefined when timeout object has no totalMs', async () => {
      let receivedAbortSignal: AbortSignal | undefined = 'not-set' as any;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
        timeout: {},
      });

      expect(receivedAbortSignal).toBeUndefined();
    });

    it('should forward stepMs as abort signal to each step', async () => {
      const receivedAbortSignals: (AbortSignal | undefined)[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignals.push(abortSignal);
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
        timeout: { stepMs: 5000 },
      });

      expect(receivedAbortSignals.length).toBe(1);
      expect(receivedAbortSignals[0]).toBeDefined();
    });

    it('should reuse the same abort signal for all steps when stepMs is set', async () => {
      const receivedAbortSignals: (AbortSignal | undefined)[] = [];
      let stepCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignals.push(abortSignal);
            stepCount++;
            if (stepCount === 1) {
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: `{ "value": "test" }`,
                  },
                ],
              };
            }
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Final response' }],
            };
          },
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'tool result',
          },
        },
        prompt: 'test-input',
        timeout: { stepMs: 5000 },
        stopWhen: isStepCount(2),
      });

      expect(receivedAbortSignals.length).toBe(2);
      // The same abort signal is reused for all steps (timeout is reset per step)
      expect(receivedAbortSignals[0]).toBeDefined();
      expect(receivedAbortSignals[1]).toBeDefined();
      expect(receivedAbortSignals[0]).toBe(receivedAbortSignals[1]);
    });

    it('should forward stepMs abort signal to tool execution', async () => {
      let toolAbortSignal: AbortSignal | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "test" }`,
              },
            ],
          }),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async (_args, { abortSignal }) => {
              toolAbortSignal = abortSignal;
              return 'tool result';
            },
          },
        },
        prompt: 'test-input',
        timeout: { stepMs: 5000 },
      });

      expect(toolAbortSignal).toBeDefined();
    });

    it('should support both totalMs and stepMs together', async () => {
      let receivedAbortSignal: AbortSignal | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
        timeout: { totalMs: 10000, stepMs: 5000 },
      });

      expect(receivedAbortSignal).toBeDefined();
    });

    it('should abort when step timeout expires', async () => {
      let receivedAbortSignal: AbortSignal | undefined;
      const delayedPromise = new DelayedPromise<void>();

      const generatePromise = generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ abortSignal }) => {
            receivedAbortSignal = abortSignal;
            await delayedPromise.promise;
            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        prompt: 'test-input',
        timeout: { stepMs: 50 },
        maxRetries: 0,
      });

      // Advance time past the step timeout — fires stepAbortController.abort(...)
      await vi.advanceTimersByTimeAsync(100);

      // Allow doGenerate to complete so the test cleans up
      delayedPromise.resolve(undefined);

      await generatePromise.catch(() => {});

      expect(receivedAbortSignal?.aborted).toBe(true);
      expect((receivedAbortSignal?.reason as Error)?.name).toBe('TimeoutError');
    });
  });

  describe('options.activeTools', () => {
    it('should filter available tools to only the ones in activeTools', async () => {
      let tools:
        | (LanguageModelV4FunctionTool | LanguageModelV4ProviderTool)[]
        | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ tools: toolsArg }) => {
            tools = toolsArg;

            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),

        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result1',
          },
          tool2: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result2',
          },
        },
        prompt: 'test-input',
        activeTools: ['tool1'],
      });

      expect(tools).toMatchInlineSnapshot(`
        [
          {
            "inputSchema": {
              "$schema": "http://json-schema.org/draft-07/schema#",
              "additionalProperties": false,
              "properties": {
                "value": {
                  "type": "string",
                },
              },
              "required": [
                "value",
              ],
              "type": "object",
            },
            "name": "tool1",
            "type": "function",
          },
        ]
      `);
    });
  });

  describe('options.toolOrder', () => {
    it('should order available tools before sending them to the model', async () => {
      let tools:
        | (LanguageModelV4FunctionTool | LanguageModelV4ProviderTool)[]
        | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ tools: toolsArg }) => {
            tools = toolsArg;

            return {
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            };
          },
        }),
        tools: {
          zebra: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'zebra',
          },
          alpha: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'alpha',
          },
          middle: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'middle',
          },
        },
        prompt: 'test-input',
        toolOrder: ['middle'],
      });

      expect(tools?.map(tool => tool.name)).toEqual([
        'middle',
        'alpha',
        'zebra',
      ]);
    });
  });

  describe('tool callbacks', () => {
    it('should invoke callbacks in the correct order', async () => {
      const recordedCalls: unknown[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            return {
              ...dummyResponseValues,
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'test-tool',
                  input: `{ "value": "value" }`,
                },
              ],
            };
          },
        }),
        tools: {
          'test-tool': tool({
            inputSchema: jsonSchema<{ value: string }>({
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            }),
            onInputAvailable: options => {
              recordedCalls.push({ type: 'onInputAvailable', options });
            },
            onInputStart: options => {
              recordedCalls.push({ type: 'onInputStart', options });
            },
            onInputDelta: options => {
              recordedCalls.push({ type: 'onInputDelta', options });
            },
          }),
        },
        toolChoice: 'required',
        prompt: 'test-input',
      });

      expect(recordedCalls).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "abortSignal": undefined,
              "context": {},
              "input": {
                "value": "value",
              },
              "messages": [
                {
                  "content": "test-input",
                  "role": "user",
                },
              ],
              "toolCallId": "call-1",
            },
            "type": "onInputAvailable",
          },
        ]
      `);
    });
  });

  describe('tools with custom schema', () => {
    it('should contain tool calls', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async ({ prompt, tools, toolChoice }) => {
            expect(tools).toStrictEqual([
              {
                type: 'function',
                name: 'tool1',
                inputSchema: {
                  additionalProperties: false,
                  properties: { value: { type: 'string' } },
                  required: ['value'],
                  type: 'object',
                },
              },
              {
                type: 'function',
                name: 'tool2',
                inputSchema: {
                  additionalProperties: false,
                  properties: { somethingElse: { type: 'string' } },
                  required: ['somethingElse'],
                  type: 'object',
                },
              },
            ]);

            expect(toolChoice).toStrictEqual({ type: 'required' });

            expect(prompt).toStrictEqual([
              {
                role: 'user',
                content: [{ type: 'text', text: 'test-input' }],
                providerOptions: undefined,
              },
            ]);

            return {
              ...dummyResponseValues,
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: `{ "value": "value" }`,
                },
              ],
            };
          },
        }),
        tools: {
          tool1: {
            inputSchema: jsonSchema<{ value: string }>({
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            }),
          },
          // 2nd tool to show typing:
          tool2: {
            inputSchema: jsonSchema<{ somethingElse: string }>({
              type: 'object',
              properties: { somethingElse: { type: 'string' } },
              required: ['somethingElse'],
              additionalProperties: false,
            }),
          },
        },
        toolChoice: 'required',
        prompt: 'test-input',
        _internal: {
          generateId: () => 'test-id',
          generateCallId: () => 'test-telemetry-call-id',
        },
      });

      // test type inference
      if (
        result.toolCalls[0].toolName === 'tool1' &&
        !result.toolCalls[0].dynamic
      ) {
        assertType<string>(result.toolCalls[0].input.value);
      }

      expect(result.toolCalls).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "value",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-call",
          },
        ]
      `);
    });
  });

  describe('provider-executed tools', () => {
    describe('two provider-executed tool calls and results', () => {
      let result: GenerateTextResult<any, any, any>;

      beforeEach(async () => {
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'web_search',
                  input: `{ "value": "value" }`,
                  providerExecuted: true,
                },
                {
                  type: 'tool-result',
                  toolCallId: 'call-1',
                  toolName: 'web_search',
                  result: `{ "value": "result1" }`,
                  providerMetadata: {
                    openai: { itemId: 'tool-result-1' },
                  },
                },
                {
                  type: 'tool-call',
                  toolCallId: 'call-2',
                  toolName: 'web_search',
                  input: `{ "value": "value" }`,
                  providerExecuted: true,
                },
                {
                  type: 'tool-result',
                  toolCallId: 'call-2',
                  toolName: 'web_search',
                  result: 'ERROR',
                  isError: true,
                  providerExecuted: true,
                  providerMetadata: {
                    openai: { itemId: 'tool-result-2' },
                  },
                },
              ],
            }),
          }),
          tools: {
            web_search: {
              type: 'provider',
              isProviderExecuted: true,
              id: 'test.web_search',
              inputSchema: z.object({ value: z.string() }),
              outputSchema: z.object({ value: z.string() }),
              args: {},
            },
          },
          prompt: 'test-input',
          stopWhen: isStepCount(4),
        });
      });

      it('should include provider-executed tool calls and results in the content', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "web_search",
              "type": "tool-call",
            },
            {
              "dynamic": undefined,
              "input": {
                "value": "value",
              },
              "output": "{ "value": "result1" }",
              "providerExecuted": true,
              "providerMetadata": {
                "openai": {
                  "itemId": "tool-result-1",
                },
              },
              "toolCallId": "call-1",
              "toolName": "web_search",
              "type": "tool-result",
            },
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-2",
              "toolName": "web_search",
              "type": "tool-call",
            },
            {
              "dynamic": undefined,
              "error": "ERROR",
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": {
                "openai": {
                  "itemId": "tool-result-2",
                },
              },
              "toolCallId": "call-2",
              "toolName": "web_search",
              "type": "tool-error",
            },
          ]
        `);
      });

      it('should include provider-executed tool calls in staticToolCalls', async () => {
        expect(result.staticToolCalls).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "web_search",
              "type": "tool-call",
            },
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-2",
              "toolName": "web_search",
              "type": "tool-call",
            },
          ]
        `);
      });

      it('should include provider-executed results in staticToolResults (errors excluded)', async () => {
        expect(result.staticToolResults).toMatchInlineSnapshot(`
          [
            {
              "dynamic": undefined,
              "input": {
                "value": "value",
              },
              "output": "{ "value": "result1" }",
              "providerExecuted": true,
              "providerMetadata": {
                "openai": {
                  "itemId": "tool-result-1",
                },
              },
              "toolCallId": "call-1",
              "toolName": "web_search",
              "type": "tool-result",
            },
          ]
        `);
      });

      it('should only execute a single step', async () => {
        expect(result.steps.length).toBe(1);
      });
    });
  });

  describe('options.messages', () => {
    it('should support models that use "this" context in supportedUrls', async () => {
      let supportedUrlsCalled = false;
      class MockLanguageModelWithImageSupport extends MockLanguageModelV4 {
        constructor() {
          super({
            supportedUrls() {
              supportedUrlsCalled = true;
              // Reference 'this' to verify context
              return this.modelId === 'mock-model-id'
                ? ({ 'image/*': [/^https:\/\/.*$/] } as Record<
                    string,
                    RegExp[]
                  >)
                : {};
            },
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
            }),
          });
        }
      }

      const model = new MockLanguageModelWithImageSupport();

      const result = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: [{ type: 'image', image: 'https://example.com/test.jpg' }],
          },
        ],
      });

      expect(result.text).toStrictEqual('Hello, world!');
      expect(supportedUrlsCalled).toBe(true);
    });
  });

  describe('options.output', () => {
    describe('text output (default)', () => {
      it('should throw error when accessing output', async () => {
        const result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [{ type: 'text', text: `Hello, world!` }],
            }),
          }),
          prompt: 'prompt',
        });

        expect(result.output).toStrictEqual('Hello, world!');
      });
    });

    describe('text output', () => {
      it('should forward text as output', async () => {
        const result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [{ type: 'text', text: `Hello, world!` }],
            }),
          }),
          prompt: 'prompt',
          output: Output.text(),
        });

        expect(result.output).toStrictEqual('Hello, world!');
      });

      it('should set responseFormat to text and not change the prompt', async () => {
        let callOptions: LanguageModelV4CallOptions;

        await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async args => {
              callOptions = args;
              return {
                ...dummyResponseValues,
                content: [{ type: 'text', text: `Hello, world!` }],
              };
            },
          }),
          prompt: 'prompt',
          output: Output.text(),
        });

        expect(callOptions!).toMatchInlineSnapshot(`
          {
            "abortSignal": undefined,
            "frequencyPenalty": undefined,
            "headers": {
              "user-agent": "ai/0.0.0-test",
            },
            "maxOutputTokens": undefined,
            "presencePenalty": undefined,
            "prompt": [
              {
                "content": [
                  {
                    "text": "prompt",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ],
            "providerOptions": undefined,
            "reasoning": undefined,
            "responseFormat": {
              "type": "text",
            },
            "seed": undefined,
            "stopSequences": undefined,
            "temperature": undefined,
            "toolChoice": {
              "type": "auto",
            },
            "tools": undefined,
            "topK": undefined,
            "topP": undefined,
          }
        `);
      });
    });

    describe('object output', () => {
      it('should parse the output', async () => {
        const result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [{ type: 'text', text: `{ "value": "test-value" }` }],
            }),
          }),
          prompt: 'prompt',
          output: Output.object({
            schema: z.object({ value: z.string() }),
          }),
        });

        expect(result.output).toEqual({ value: 'test-value' });
      });

      it('should set responseFormat to json and send schema as part of the responseFormat', async () => {
        let callOptions: LanguageModelV4CallOptions;

        await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async args => {
              callOptions = args;
              return {
                ...dummyResponseValues,
                content: [{ type: 'text', text: `{ "value": "test-value" }` }],
              };
            },
          }),
          prompt: 'prompt',
          output: Output.object({
            schema: z.object({ value: z.string() }),
          }),
        });

        expect(callOptions!).toMatchInlineSnapshot(`
          {
            "abortSignal": undefined,
            "frequencyPenalty": undefined,
            "headers": {
              "user-agent": "ai/0.0.0-test",
            },
            "maxOutputTokens": undefined,
            "presencePenalty": undefined,
            "prompt": [
              {
                "content": [
                  {
                    "text": "prompt",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ],
            "providerOptions": undefined,
            "reasoning": undefined,
            "responseFormat": {
              "schema": {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "additionalProperties": false,
                "properties": {
                  "value": {
                    "type": "string",
                  },
                },
                "required": [
                  "value",
                ],
                "type": "object",
              },
              "type": "json",
            },
            "seed": undefined,
            "stopSequences": undefined,
            "temperature": undefined,
            "toolChoice": {
              "type": "auto",
            },
            "tools": undefined,
            "topK": undefined,
            "topP": undefined,
          }
        `);
      });
    });

    describe('array output', () => {
      it('should generate an array with 3 elements', async () => {
        const model = new MockLanguageModelV4({
          doGenerate: {
            ...dummyResponseValues,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  elements: [
                    { content: 'element 1' },
                    { content: 'element 2' },
                    { content: 'element 3' },
                  ],
                }),
              },
            ],
          },
        });

        const result = await generateText({
          model,
          output: Output.array({
            element: z.object({ content: z.string() }),
          }),
          prompt: 'prompt',
        });

        expect(result.output).toMatchInlineSnapshot(`
        [
          {
            "content": "element 1",
          },
          {
            "content": "element 2",
          },
          {
            "content": "element 3",
          },
        ]
      `);

        expect(model.doGenerateCalls[0].prompt).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "prompt",
                "type": "text",
              },
            ],
            "providerOptions": undefined,
            "role": "user",
          },
        ]
      `);

        expect(model.doGenerateCalls[0].responseFormat).toMatchInlineSnapshot(`
        {
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "elements": {
                "items": {
                  "additionalProperties": false,
                  "properties": {
                    "content": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "content",
                  ],
                  "type": "object",
                },
                "type": "array",
              },
            },
            "required": [
              "elements",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
      });
    });

    describe('choice output', () => {
      it('should generate a choice value', async () => {
        const model = new MockLanguageModelV4({
          doGenerate: {
            ...dummyResponseValues,
            content: [
              {
                type: 'text',
                text: JSON.stringify({ result: 'sunny' }),
              },
            ],
          },
        });

        const result = await generateText({
          model,
          output: Output.choice({
            options: ['sunny', 'rainy', 'snowy'],
          }),
          prompt: 'prompt',
        });

        expect(result.output).toEqual('sunny');
        expect(model.doGenerateCalls[0].prompt).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "prompt",
                "type": "text",
              },
            ],
            "providerOptions": undefined,
            "role": "user",
          },
        ]
      `);
        expect(model.doGenerateCalls[0].responseFormat).toMatchInlineSnapshot(`
        {
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "result": {
                "enum": [
                  "sunny",
                  "rainy",
                  "snowy",
                ],
                "type": "string",
              },
            },
            "required": [
              "result",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
      });
    });

    it('should not parse output when finish reason is tool-calls', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            finishReason: { unified: 'tool-calls', raw: undefined },
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: `{ "value": "test" }`,
              },
            ],
          }),
        }),
        prompt: 'prompt',
        output: Output.object({
          schema: z.object({ summary: z.string() }),
        }),
        tools: {
          testTool: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'tool result',
          },
        },
      });

      // output should be undefined when finish reason is tool-calls
      expect(() => {
        result.output;
      }).toThrow('No output generated');

      // But tool calls should work normally
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolResults).toHaveLength(1);
    });
  });

  describe('tool execution errors', () => {
    let result: GenerateTextResult<any, any, any>;

    beforeEach(async () => {
      result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: `{ "value": "value" }`,
              },
            ],
          }),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => {
              throw new Error('test error');
            },
          },
        },
        prompt: 'test-input',
      });
    });

    it('should add tool error part to the content', async () => {
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "value",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-call",
          },
          {
            "dynamic": false,
            "error": [Error: test error],
            "input": {
              "value": "value",
            },
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-error",
          },
        ]
      `);
    });

    it('should include error result in response messages', async () => {
      expect(result.responseMessages).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "output": {
                  "type": "error-text",
                  "value": "Error: test error",
                },
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });
  });

  describe('provider-executed tools', () => {
    it('should not call execute for provider-executed tool calls', async () => {
      let toolExecuted = false;

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'providerTool',
                input: `{ "value": "test" }`,
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'providerTool',
                providerExecuted: true,
                result: { example: 'example' },
              },
            ],
            finishReason: { unified: 'stop', raw: 'stop' },
          }),
        }),
        tools: {
          providerTool: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => {
              toolExecuted = true;
              return `${value}-should-not-execute`;
            },
          },
        },
        prompt: 'test-input',
      });

      // tool should not be executed by client
      expect(toolExecuted).toBe(false);

      // tool call should still be included in content
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "test",
            },
            "providerExecuted": true,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "call-1",
            "toolName": "providerTool",
            "type": "tool-call",
          },
          {
            "dynamic": undefined,
            "input": {
              "value": "test",
            },
            "output": {
              "example": "example",
            },
            "providerExecuted": true,
            "toolCallId": "call-1",
            "toolName": "providerTool",
            "type": "tool-result",
          },
        ]
      `);

      // tool results should include the result from the provider
      expect(result.toolResults).toMatchInlineSnapshot(`
        [
          {
            "dynamic": undefined,
            "input": {
              "value": "test",
            },
            "output": {
              "example": "example",
            },
            "providerExecuted": true,
            "toolCallId": "call-1",
            "toolName": "providerTool",
            "type": "tool-result",
          },
        ]
      `);
    });
  });

  describe('programmatic tool calling', () => {
    describe('5 steps: code_execution triggers client tool across multiple turns (dice game fixture)', () => {
      let result: GenerateTextResult<any, any, any>;
      let onFinishResult: Parameters<GenerateTextOnEndCallback<any, any>>[0];
      let onStepFinishResults: StepResult<any, any>[];
      let doGenerateCalls: Array<LanguageModelV4CallOptions>;
      let prepareStepCalls: Array<{
        modelId: string;
        stepNumber: number;
        steps: Array<StepResult<any, any>>;
        messages: Array<ModelMessage>;
      }>;
      let rollDieExecutions: Array<{ player: string }>;

      // Fixture-based tool call IDs (from anthropic-programmatic-tool-calling.1.json)
      const CODE_EXEC_ID = 'srvtoolu_01CberhXc9TgYXrCZU8bQoks';
      const CONTAINER_ID = 'container_011CWHQB57xVregfCMPrKgew';

      beforeEach(async () => {
        onFinishResult = undefined as any;
        onStepFinishResults = [];
        doGenerateCalls = [];
        prepareStepCalls = [];
        rollDieExecutions = [];

        let responseCount = 0;

        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async options => {
              doGenerateCalls.push(options);

              switch (responseCount++) {
                case 0:
                  // Step 1: text + server_tool_use (code_execution) + 2 rollDie calls
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'text',
                        text: "I'll help you simulate this dice game between two players! Let me run the game where both players roll dice each round until one player wins 3 rounds.",
                      },
                      {
                        type: 'tool-call',
                        toolCallId: CODE_EXEC_ID,
                        toolName: 'code_execution',
                        input: `{"type":"programmatic-tool-call","code":"game_loop()"}`,
                        providerExecuted: true,
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_01PMcE1JBKCeLjn83cgUCvR5',
                        toolName: 'rollDie',
                        input: `{ "player": "player2" }`,
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_01MZf5QJ1EQyd2yGyeLzBxAS',
                        toolName: 'rollDie',
                        input: `{ "player": "player1" }`,
                      },
                    ],
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: {
                      inputTokens: {
                        total: 3369,
                        noCache: 3369,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 577,
                        text: 577,
                        reasoning: undefined,
                      },
                    },
                    response: {
                      id: 'msg_01V3gktwqnMAsXxpJ6sG9KDR',
                      timestamp: new Date(0),
                      modelId: 'claude-sonnet-4-5-20250929',
                    },
                    providerMetadata: {
                      anthropic: {
                        container: { id: CONTAINER_ID },
                      },
                    },
                  };

                case 1:
                  // Step 2: 2 rollDie calls (round 2)
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_01UvVQ2xwA6preZppeajCkYK',
                        toolName: 'rollDie',
                        input: `{ "player": "player1" }`,
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_01BghspNownQFtRgv8jVicr3',
                        toolName: 'rollDie',
                        input: `{ "player": "player2" }`,
                      },
                    ],
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: {
                      inputTokens: {
                        total: 0,
                        noCache: 0,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 0,
                        text: 0,
                        reasoning: undefined,
                      },
                    },
                    response: {
                      id: 'msg_01DmEmveJkWRUR1y41DfGfEQ',
                      timestamp: new Date(1000),
                      modelId: 'claude-sonnet-4-5-20250929',
                    },
                    providerMetadata: {
                      anthropic: {
                        container: { id: CONTAINER_ID },
                      },
                    },
                  };

                case 2:
                  // Step 3: 2 rollDie calls (round 3)
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_01T7Upuuv8C71nq7DZ9ZPNQW',
                        toolName: 'rollDie',
                        input: `{ "player": "player1" }`,
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_016Da1tDet9Bf7dAdYTkF5Ar',
                        toolName: 'rollDie',
                        input: `{ "player": "player2" }`,
                      },
                    ],
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: {
                      inputTokens: {
                        total: 0,
                        noCache: 0,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 0,
                        text: 0,
                        reasoning: undefined,
                      },
                    },
                    response: {
                      id: 'msg_01AxicwpZwTqKCtty95VTAoL',
                      timestamp: new Date(2000),
                      modelId: 'claude-sonnet-4-5-20250929',
                    },
                    providerMetadata: {
                      anthropic: {
                        container: { id: CONTAINER_ID },
                      },
                    },
                  };

                case 3:
                  // Step 4: 2 rollDie calls (round 4 - final round)
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_01DiUBRds64sNajVPTZRrDSM',
                        toolName: 'rollDie',
                        input: `{ "player": "player1" }`,
                      },
                      {
                        type: 'tool-call',
                        toolCallId: 'toolu_01XQa3r3y1Fe8rnkGSncq626',
                        toolName: 'rollDie',
                        input: `{ "player": "player2" }`,
                      },
                    ],
                    finishReason: { unified: 'tool-calls', raw: undefined },
                    usage: {
                      inputTokens: {
                        total: 0,
                        noCache: 0,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 0,
                        text: 0,
                        reasoning: undefined,
                      },
                    },
                    response: {
                      id: 'msg_01TjXmSMrfqKVMpHHM3wMaBy',
                      timestamp: new Date(3000),
                      modelId: 'claude-sonnet-4-5-20250929',
                    },
                    providerMetadata: {
                      anthropic: {
                        container: { id: CONTAINER_ID },
                      },
                    },
                  };

                case 4:
                  // Step 5: code_execution_tool_result + final text
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-result',
                        toolCallId: CODE_EXEC_ID,
                        toolName: 'code_execution',
                        providerExecuted: true,
                        result: {
                          type: 'code_execution_result',
                          stdout:
                            '============================================================\nDICE GAME: First to 3 Round Wins\n============================================================\n\nRound 1:\n  Player 1 rolls: 6\n  Player 2 rolls: 6\n  → Draw! No points awarded.\n  Score: Player 1: 0 | Player 2: 0\n\nRound 2:\n  Player 1 rolls: 5\n  Player 2 rolls: 4\n  → Player 1 wins this round!\n  Score: Player 1: 1 | Player 2: 0\n\nRound 3:\n  Player 1 rolls: 6\n  Player 2 rolls: 4\n  → Player 1 wins this round!\n  Score: Player 1: 2 | Player 2: 0\n\nRound 4:\n  Player 1 rolls: 6\n  Player 2 rolls: 3\n  → Player 1 wins this round!\n  Score: Player 1: 3 | Player 2: 0\n\n============================================================\n🏆 PLAYER 1 WINS THE GAME!\nFinal Score: Player 1: 3 | Player 2: 0\nTotal Rounds: 4\n============================================================\n',
                          stderr: '',
                          return_code: 0,
                          content: [],
                        },
                      },
                      {
                        type: 'text',
                        text: "**Game Over!**\n\nPlayer 1 dominated this game with a decisive 3-0 victory! Looking at the rolls:\n- **Round 1**: Both rolled 6 (Draw)\n- **Round 2**: Player 1 (5) beat Player 2 (4)\n- **Round 3**: Player 1 (6) beat Player 2 (4)\n- **Round 4**: Player 1 (6) beat Player 2 (3)\n\nBased on these results, it appears **Player 1 is likely the one with the loaded die** - they rolled 6 three times out of four rolls (including the draw), and consistently rolled high numbers (5, 6, 6, 6). Player 2's rolls were more varied and lower (6, 4, 4, 3), which looks more like a fair die distribution.\n\nThe loaded die gave Player 1 a significant advantage, allowing them to win the game without Player 2 scoring a single round!",
                      },
                    ],
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: {
                      inputTokens: {
                        total: 4243,
                        noCache: 4243,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 229,
                        text: 229,
                        reasoning: undefined,
                      },
                    },
                    response: {
                      id: 'msg_01LPPbjvqcSgBPfApMEiJ4qv',
                      timestamp: new Date(4000),
                      modelId: 'claude-sonnet-4-5-20250929',
                    },
                  };

                default:
                  throw new Error(
                    `Unexpected response count: ${responseCount}`,
                  );
              }
            },
          }),
          tools: {
            code_execution: {
              type: 'provider',
              isProviderExecuted: true,
              id: 'anthropic.code_execution_20250825',
              inputSchema: z.object({ code: z.string() }),
              outputSchema: z.object({
                stdout: z.string(),
                stderr: z.string(),
              }),
              args: {},
              supportsDeferredResults: true,
            },
            rollDie: tool({
              description: 'Roll a die and return the result.',
              inputSchema: z.object({
                player: z.enum(['player1', 'player2']),
              }),
              execute: async ({ player }) => {
                rollDieExecutions.push({ player });
                return player === 'player1' ? 6 : 3;
              },
              providerOptions: {
                anthropic: {
                  allowedCallers: ['code_execution_20250825'],
                },
              },
            }),
          },
          prompt: 'Play a dice game between two players.',
          stopWhen: isStepCount(10),
          onFinish: async event => {
            onFinishResult = event as unknown as typeof onFinishResult;
          },
          onStepFinish: async event => {
            onStepFinishResults.push(event);
          },
          prepareStep: async ({ model, stepNumber, steps, messages }) => {
            prepareStepCalls.push({
              modelId: typeof model === 'string' ? model : model.modelId,
              stepNumber,
              steps: [...steps],
              messages: [...messages],
            });

            // Forward container ID from previous step (simulating forwardAnthropicContainerIdFromLastStep)
            if (stepNumber > 0 && steps.length > 0) {
              const lastStep = steps[steps.length - 1];
              const containerId = (
                lastStep.providerMetadata?.anthropic as
                  | { container?: { id?: string } }
                  | undefined
              )?.container?.id;

              if (containerId) {
                return {
                  providerOptions: {
                    anthropic: {
                      container: { id: containerId },
                    },
                  },
                };
              }
            }
            return undefined;
          },
        });
      });

      describe('step inputs', () => {
        it('should send correct prompt in step 1', () => {
          expect(doGenerateCalls[0].prompt).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Play a dice game between two players.",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ]
          `);
        });

        it('should send correct tools in step 1', () => {
          expect(doGenerateCalls[0].tools).toMatchInlineSnapshot(`
            [
              {
                "args": {},
                "id": "anthropic.code_execution_20250825",
                "name": "code_execution",
                "type": "provider",
              },
              {
                "description": "Roll a die and return the result.",
                "inputSchema": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "additionalProperties": false,
                  "properties": {
                    "player": {
                      "enum": [
                        "player1",
                        "player2",
                      ],
                      "type": "string",
                    },
                  },
                  "required": [
                    "player",
                  ],
                  "type": "object",
                },
                "name": "rollDie",
                "providerOptions": {
                  "anthropic": {
                    "allowedCallers": [
                      "code_execution_20250825",
                    ],
                  },
                },
                "type": "function",
              },
            ]
          `);
        });

        it('should include assistant messages and tool results in step 2 prompt', () => {
          expect(doGenerateCalls[1].prompt).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Play a dice game between two players.",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "I'll help you simulate this dice game between two players! Let me run the game where both players roll dice each round until one player wins 3 rounds.",
                    "type": "text",
                  },
                  {
                    "input": {
                      "code": "game_loop()",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "srvtoolu_01CberhXc9TgYXrCZU8bQoks",
                    "toolName": "code_execution",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01PMcE1JBKCeLjn83cgUCvR5",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01MZf5QJ1EQyd2yGyeLzBxAS",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01PMcE1JBKCeLjn83cgUCvR5",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01MZf5QJ1EQyd2yGyeLzBxAS",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ]
          `);
        });

        it('should include all previous messages in step 3 prompt (round 3)', () => {
          expect(doGenerateCalls[2].prompt).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Play a dice game between two players.",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "I'll help you simulate this dice game between two players! Let me run the game where both players roll dice each round until one player wins 3 rounds.",
                    "type": "text",
                  },
                  {
                    "input": {
                      "code": "game_loop()",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "srvtoolu_01CberhXc9TgYXrCZU8bQoks",
                    "toolName": "code_execution",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01PMcE1JBKCeLjn83cgUCvR5",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01MZf5QJ1EQyd2yGyeLzBxAS",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01PMcE1JBKCeLjn83cgUCvR5",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01MZf5QJ1EQyd2yGyeLzBxAS",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
              {
                "content": [
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01UvVQ2xwA6preZppeajCkYK",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01BghspNownQFtRgv8jVicr3",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01UvVQ2xwA6preZppeajCkYK",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01BghspNownQFtRgv8jVicr3",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ]
          `);
        });

        it('should forward container ID via providerOptions in step 2', () => {
          expect(doGenerateCalls[1].providerOptions).toMatchInlineSnapshot(`
            {
              "anthropic": {
                "container": {
                  "id": "container_011CWHQB57xVregfCMPrKgew",
                },
              },
            }
          `);
        });

        it('should include all previous messages in step 5 prompt (final step)', () => {
          expect(doGenerateCalls[4].prompt).toMatchSnapshot();
        });
      });

      describe('result.responseMessages', () => {
        it('should contain response messages from all steps', () => {
          expect(result.responseMessages).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "I'll help you simulate this dice game between two players! Let me run the game where both players roll dice each round until one player wins 3 rounds.",
                    "type": "text",
                  },
                  {
                    "input": {
                      "code": "game_loop()",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "srvtoolu_01CberhXc9TgYXrCZU8bQoks",
                    "toolName": "code_execution",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01PMcE1JBKCeLjn83cgUCvR5",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01MZf5QJ1EQyd2yGyeLzBxAS",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "toolCallId": "toolu_01PMcE1JBKCeLjn83cgUCvR5",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "toolCallId": "toolu_01MZf5QJ1EQyd2yGyeLzBxAS",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01UvVQ2xwA6preZppeajCkYK",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01BghspNownQFtRgv8jVicr3",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "toolCallId": "toolu_01UvVQ2xwA6preZppeajCkYK",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "toolCallId": "toolu_01BghspNownQFtRgv8jVicr3",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01T7Upuuv8C71nq7DZ9ZPNQW",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_016Da1tDet9Bf7dAdYTkF5Ar",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "toolCallId": "toolu_01T7Upuuv8C71nq7DZ9ZPNQW",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "toolCallId": "toolu_016Da1tDet9Bf7dAdYTkF5Ar",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "input": {
                      "player": "player1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01DiUBRds64sNajVPTZRrDSM",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "player": "player2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "toolu_01XQa3r3y1Fe8rnkGSncq626",
                    "toolName": "rollDie",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": 6,
                    },
                    "toolCallId": "toolu_01DiUBRds64sNajVPTZRrDSM",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                  {
                    "output": {
                      "type": "json",
                      "value": 3,
                    },
                    "toolCallId": "toolu_01XQa3r3y1Fe8rnkGSncq626",
                    "toolName": "rollDie",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "json",
                      "value": {
                        "content": [],
                        "return_code": 0,
                        "stderr": "",
                        "stdout": "============================================================
            DICE GAME: First to 3 Round Wins
            ============================================================

            Round 1:
              Player 1 rolls: 6
              Player 2 rolls: 6
              → Draw! No points awarded.
              Score: Player 1: 0 | Player 2: 0

            Round 2:
              Player 1 rolls: 5
              Player 2 rolls: 4
              → Player 1 wins this round!
              Score: Player 1: 1 | Player 2: 0

            Round 3:
              Player 1 rolls: 6
              Player 2 rolls: 4
              → Player 1 wins this round!
              Score: Player 1: 2 | Player 2: 0

            Round 4:
              Player 1 rolls: 6
              Player 2 rolls: 3
              → Player 1 wins this round!
              Score: Player 1: 3 | Player 2: 0

            ============================================================
            🏆 PLAYER 1 WINS THE GAME!
            Final Score: Player 1: 3 | Player 2: 0
            Total Rounds: 4
            ============================================================
            ",
                        "type": "code_execution_result",
                      },
                    },
                    "providerOptions": undefined,
                    "toolCallId": "srvtoolu_01CberhXc9TgYXrCZU8bQoks",
                    "toolName": "code_execution",
                    "type": "tool-result",
                  },
                  {
                    "providerOptions": undefined,
                    "text": "**Game Over!**

            Player 1 dominated this game with a decisive 3-0 victory! Looking at the rolls:
            - **Round 1**: Both rolled 6 (Draw)
            - **Round 2**: Player 1 (5) beat Player 2 (4)
            - **Round 3**: Player 1 (6) beat Player 2 (4)
            - **Round 4**: Player 1 (6) beat Player 2 (3)

            Based on these results, it appears **Player 1 is likely the one with the loaded die** - they rolled 6 three times out of four rolls (including the draw), and consistently rolled high numbers (5, 6, 6, 6). Player 2's rolls were more varied and lower (6, 4, 4, 3), which looks more like a fair die distribution.

            The loaded die gave Player 1 a significant advantage, allowing them to win the game without Player 2 scoring a single round!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ]
          `);
        });
      });

      describe('result.toolCalls and result.toolResults', () => {
        it('should return toolCalls from all steps', () => {
          expect(result.toolCalls.map(toolCall => toolCall.toolCallId))
            .toMatchInlineSnapshot(`
              [
                "srvtoolu_01CberhXc9TgYXrCZU8bQoks",
                "toolu_01PMcE1JBKCeLjn83cgUCvR5",
                "toolu_01MZf5QJ1EQyd2yGyeLzBxAS",
                "toolu_01UvVQ2xwA6preZppeajCkYK",
                "toolu_01BghspNownQFtRgv8jVicr3",
                "toolu_01T7Upuuv8C71nq7DZ9ZPNQW",
                "toolu_016Da1tDet9Bf7dAdYTkF5Ar",
                "toolu_01DiUBRds64sNajVPTZRrDSM",
                "toolu_01XQa3r3y1Fe8rnkGSncq626",
              ]
            `);
        });

        it('should return empty finalStep.toolCalls when final step has no tool calls', () => {
          expect(result.finalStep.toolCalls).toMatchInlineSnapshot(`[]`);
        });

        it('should return toolResults from all steps', () => {
          expect(result.toolResults.map(toolResult => toolResult.toolCallId))
            .toMatchInlineSnapshot(`
              [
                "toolu_01PMcE1JBKCeLjn83cgUCvR5",
                "toolu_01MZf5QJ1EQyd2yGyeLzBxAS",
                "toolu_01UvVQ2xwA6preZppeajCkYK",
                "toolu_01BghspNownQFtRgv8jVicr3",
                "toolu_01T7Upuuv8C71nq7DZ9ZPNQW",
                "toolu_016Da1tDet9Bf7dAdYTkF5Ar",
                "toolu_01DiUBRds64sNajVPTZRrDSM",
                "toolu_01XQa3r3y1Fe8rnkGSncq626",
                "srvtoolu_01CberhXc9TgYXrCZU8bQoks",
              ]
            `);
        });

        it('should return final step toolResults from finalStep', () => {
          expect(result.finalStep.toolResults).toMatchInlineSnapshot(`
            [
              {
                "dynamic": undefined,
                "input": undefined,
                "output": {
                  "content": [],
                  "return_code": 0,
                  "stderr": "",
                  "stdout": "============================================================
            DICE GAME: First to 3 Round Wins
            ============================================================

            Round 1:
              Player 1 rolls: 6
              Player 2 rolls: 6
              → Draw! No points awarded.
              Score: Player 1: 0 | Player 2: 0

            Round 2:
              Player 1 rolls: 5
              Player 2 rolls: 4
              → Player 1 wins this round!
              Score: Player 1: 1 | Player 2: 0

            Round 3:
              Player 1 rolls: 6
              Player 2 rolls: 4
              → Player 1 wins this round!
              Score: Player 1: 2 | Player 2: 0

            Round 4:
              Player 1 rolls: 6
              Player 2 rolls: 3
              → Player 1 wins this round!
              Score: Player 1: 3 | Player 2: 0

            ============================================================
            🏆 PLAYER 1 WINS THE GAME!
            Final Score: Player 1: 3 | Player 2: 0
            Total Rounds: 4
            ============================================================
            ",
                  "type": "code_execution_result",
                },
                "providerExecuted": true,
                "toolCallId": "srvtoolu_01CberhXc9TgYXrCZU8bQoks",
                "toolName": "code_execution",
                "type": "tool-result",
              },
            ]
          `);
        });
      });

      describe('tool execution', () => {
        it('should execute rollDie tool 4 times (twice per step for steps 1 and 2)', () => {
          expect(rollDieExecutions).toMatchInlineSnapshot(`
            [
              {
                "player": "player2",
              },
              {
                "player": "player1",
              },
              {
                "player": "player1",
              },
              {
                "player": "player2",
              },
              {
                "player": "player1",
              },
              {
                "player": "player2",
              },
              {
                "player": "player1",
              },
              {
                "player": "player2",
              },
            ]
          `);
        });
      });

      describe('result.steps', () => {
        it('should contain 5 steps', () => {
          expect(result.steps.length).toBe(5);
        });

        it('should have correct finishReason for each step', () => {
          expect(result.steps[0].finishReason).toBe('tool-calls');
          expect(result.steps[1].finishReason).toBe('tool-calls');
          expect(result.steps[2].finishReason).toBe('tool-calls');
          expect(result.steps[3].finishReason).toBe('tool-calls');
          expect(result.steps[4].finishReason).toBe('stop');
        });
      });

      describe('result.text', () => {
        it('should return final text from last step', () => {
          expect(result.text).toContain('**Game Over!**');
        });
      });

      describe('result.finishReason', () => {
        it('should return stop from final step', () => {
          expect(result.finishReason).toBe('stop');
        });
      });

      describe('result.totalUsage', () => {
        it('should sum token usage across all steps', () => {
          expect(result.totalUsage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 7612,
              },
              "inputTokens": 7612,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 806,
              },
              "outputTokens": 806,
              "totalTokens": 8418,
            }
          `);
        });
      });

      describe('prepareStep calls', () => {
        it('should call prepareStep for each step with correct stepNumber', () => {
          expect(prepareStepCalls.length).toBe(5);
          expect(prepareStepCalls[0].stepNumber).toBe(0);
          expect(prepareStepCalls[1].stepNumber).toBe(1);
          expect(prepareStepCalls[2].stepNumber).toBe(2);
          expect(prepareStepCalls[3].stepNumber).toBe(3);
          expect(prepareStepCalls[4].stepNumber).toBe(4);
        });

        it('should pass empty steps array for first prepareStep call', () => {
          expect(prepareStepCalls[0].steps.length).toBe(0);
        });

        it('should pass accumulated steps to subsequent prepareStep calls', () => {
          expect(prepareStepCalls[1].steps.length).toBe(1);
          expect(prepareStepCalls[2].steps.length).toBe(2);
          expect(prepareStepCalls[3].steps.length).toBe(3);
          expect(prepareStepCalls[4].steps.length).toBe(4);
        });

        it('should pass accumulated messages to prepareStep', () => {
          // Step 0: just the initial user message
          expect(prepareStepCalls[0].messages.length).toBe(1);

          // Step 1: user message + assistant message + tool message
          expect(prepareStepCalls[1].messages.length).toBe(3);

          // Step 2: user message + assistant + tool + assistant + tool
          expect(prepareStepCalls[2].messages.length).toBe(5);

          // Step 3: continued accumulation
          expect(prepareStepCalls[3].messages.length).toBe(7);

          // Step 4: continued accumulation
          expect(prepareStepCalls[4].messages.length).toBe(9);
        });
      });

      describe('onStepFinish callback', () => {
        it('should be called for each step', () => {
          expect(onStepFinishResults.length).toBe(5);
        });

        it('should contain correct finishReason for each step', () => {
          expect(onStepFinishResults[0].finishReason).toBe('tool-calls');
          expect(onStepFinishResults[1].finishReason).toBe('tool-calls');
          expect(onStepFinishResults[2].finishReason).toBe('tool-calls');
          expect(onStepFinishResults[3].finishReason).toBe('tool-calls');
          expect(onStepFinishResults[4].finishReason).toBe('stop');
        });

        it('should contain provider metadata with container ID for steps 1 and 2', () => {
          expect(onStepFinishResults[0].providerMetadata)
            .toMatchInlineSnapshot(`
              {
                "anthropic": {
                  "container": {
                    "id": "container_011CWHQB57xVregfCMPrKgew",
                  },
                },
              }
            `);
          expect(onStepFinishResults[1].providerMetadata)
            .toMatchInlineSnapshot(`
              {
                "anthropic": {
                  "container": {
                    "id": "container_011CWHQB57xVregfCMPrKgew",
                  },
                },
              }
            `);
        });
      });

      describe('onFinish callback', () => {
        it('should be called with correct text', () => {
          expect(onFinishResult.text).toContain('**Game Over!**');
        });

        it('should be called with correct finishReason', () => {
          expect(onFinishResult.finishReason).toBe('stop');
        });

        it('should contain all steps', () => {
          expect(onFinishResult.steps.length).toBe(5);
        });

        it('should contain correct usage', () => {
          expect(onFinishResult.usage).toMatchInlineSnapshot(`
            {
              "inputTokenDetails": {
                "cacheReadTokens": undefined,
                "cacheWriteTokens": undefined,
                "noCacheTokens": 7612,
              },
              "inputTokens": 7612,
              "outputTokenDetails": {
                "reasoningTokens": undefined,
                "textTokens": 806,
              },
              "outputTokens": 806,
              "totalTokens": 8418,
            }
          `);
        });

        it('should contain response messages from all steps', () => {
          expect(onFinishResult.responseMessages.length).toBe(9);
        });
      });
    });
  });

  describe('dynamic tools', () => {
    it('should execute dynamic tools', async () => {
      let toolExecuted = false;

      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'dynamicTool',
                input: `{ "value": "test" }`,
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          dynamicTool: dynamicTool({
            inputSchema: z.object({ value: z.string() }),
            execute: async () => {
              toolExecuted = true;
              return { value: 'test-result' };
            },
          }),
        },
        prompt: 'test-input',
      });

      // tool should be executed by client
      expect(toolExecuted).toBe(true);

      // tool call should be included in content
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "dynamic": true,
            "input": {
              "value": "test",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "title": undefined,
            "toolCallId": "call-1",
            "toolName": "dynamicTool",
            "type": "tool-call",
          },
          {
            "dynamic": true,
            "input": {
              "value": "test",
            },
            "output": {
              "value": "test-result",
            },
            "toolCallId": "call-1",
            "toolName": "dynamicTool",
            "type": "tool-result",
          },
        ]
      `);
    });
  });

  describe('context', () => {
    it('should send context to tool execution', async () => {
      let recordedContext: unknown | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 't1',
                input: `{ "value": "test" }`,
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          t1: tool({
            inputSchema: z.object({ value: z.string() }),
            contextSchema: z.object({ context: z.string() }),
            execute: async (input, { context }) => {
              recordedContext = context;
              return { value: 'test-result' };
            },
          }),
        },
        toolsContext: { t1: { context: 'test' } },
        prompt: 'test-input',
      });

      // tool should be executed by client
      expect(recordedContext).toMatchInlineSnapshot(`
        {
          "context": "test",
        }
      `);
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

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 't1',
                input: `{ "value": "test" }`,
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
          }),
        }),
        tools: {
          t1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }, { experimental_sandbox: sandbox }) => {
              recordedSandbox = sandbox;
              return { value };
            },
          }),
        },
        experimental_sandbox: sandbox,
        prompt: 'test-input',
      });

      expect(recordedSandbox).toBe(sandbox);
    });

    it('should pass runtimeContext to prepareStep', async () => {
      let capturedContext: unknown;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
          }),
        }),
        runtimeContext: { myData: 'test-value' },
        prepareStep: async ({ runtimeContext }) => {
          capturedContext = runtimeContext;
          return undefined;
        },
        prompt: 'test',
      });

      expect(capturedContext).toEqual({ myData: 'test-value' });
    });

    it('should pass sandbox to prepareStep', async () => {
      const sandbox = {
        description: 'test sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      let capturedSandbox: SandboxSession | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
          }),
        }),
        experimental_sandbox: sandbox,
        prepareStep: async ({ experimental_sandbox: sandbox }) => {
          capturedSandbox = sandbox;
          return undefined;
        },
        prompt: 'test',
      });

      expect(capturedSandbox).toBe(sandbox);
    });

    it('should use sandbox returned from prepareStep for that step only', async () => {
      const sandbox = {
        description: 'default sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      const stepSandbox = {
        description: 'step sandbox',
        run: vi.fn(async () => ({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        })),
        ...mockSandboxSessionFileStubs,
      } satisfies SandboxSession;
      const recordedSandboxes: Array<SandboxSession | undefined> = [];
      let responseCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (responseCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 't1',
                      input: `{ "value": "first" }`,
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-2',
                      toolName: 't1',
                      input: `{ "value": "second" }`,
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                };
              default:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'done' }],
                };
            }
          },
        }),
        tools: {
          t1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }, { experimental_sandbox: sandbox }) => {
              recordedSandboxes.push(sandbox);
              return { value };
            },
          }),
        },
        experimental_sandbox: sandbox,
        prepareStep: async ({ stepNumber }) =>
          stepNumber === 0 ? { experimental_sandbox: stepSandbox } : {},
        prompt: 'test-input',
        stopWhen: isStepCount(3),
      });

      expect(recordedSandboxes).toEqual([stepSandbox, sandbox]);
    });

    it('should send runtimeContext in onFinish callback', async () => {
      let recordedContext: unknown | undefined;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            finishReason: { unified: 'stop', raw: 'stop' },
          }),
        }),
        runtimeContext: {
          context: 'test',
        },
        prompt: 'test-input',
        onFinish: ({ runtimeContext }) => {
          recordedContext = runtimeContext;
        },
      });

      expect(recordedContext).toStrictEqual({
        context: 'test',
      });
    });

    it('should pass full runtimeContext to callbacks', async () => {
      const callbackContexts: unknown[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            finishReason: { unified: 'stop', raw: 'stop' },
          }),
        }),
        runtimeContext: {
          userId: 'user-123',
          requestId: 'request-123',
        },
        prompt: 'test-input',
        telemetry: {
          includeRuntimeContext: {
            requestId: true,
          },
        },
        onStart: ({ runtimeContext }) => {
          callbackContexts.push(runtimeContext);
        },
        onStepStart: ({ runtimeContext }) => {
          callbackContexts.push(runtimeContext);
        },
        onStepFinish: ({ runtimeContext }) => {
          callbackContexts.push(runtimeContext);
        },
        onFinish: ({ runtimeContext }) => {
          callbackContexts.push(runtimeContext);
        },
      });

      expect(callbackContexts).toEqual([
        { userId: 'user-123', requestId: 'request-123' },
        { userId: 'user-123', requestId: 'request-123' },
        { userId: 'user-123', requestId: 'request-123' },
        { userId: 'user-123', requestId: 'request-123' },
      ]);
    });

    it('should include configured runtimeContext properties in telemetry', async () => {
      const telemetryContexts: unknown[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            finishReason: { unified: 'stop', raw: 'stop' },
          }),
        }),
        runtimeContext: {
          userId: 'user-123',
          requestId: 'request-123',
        },
        prompt: 'test-input',
        telemetry: {
          includeRuntimeContext: {
            requestId: true,
          },
          integrations: {
            onStart: event => {
              telemetryContexts.push(
                (event as { runtimeContext: unknown }).runtimeContext,
              );
            },
            onStepStart: ({ runtimeContext }) => {
              telemetryContexts.push(runtimeContext);
            },
            onStepEnd: ({ runtimeContext }) => {
              telemetryContexts.push(runtimeContext);
            },
            onEnd: event => {
              telemetryContexts.push(
                (event as { runtimeContext: unknown }).runtimeContext,
              );
            },
          },
        },
      });

      expect(telemetryContexts).toEqual([
        { requestId: 'request-123' },
        { requestId: 'request-123' },
        { requestId: 'request-123' },
        { requestId: 'request-123' },
      ]);
    });

    it('should include configured toolsContext properties in telemetry', async () => {
      const telemetryContexts: unknown[] = [];
      const tools = {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
          contextSchema: z.object({
            apiKey: z.string(),
            region: z.string(),
          }),
          execute: async () => 'sunny',
        }),
      };

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            finishReason: { unified: 'stop', raw: 'stop' },
          }),
        }),
        prompt: 'test-input',
        tools,
        toolsContext: {
          weather: {
            apiKey: 'secret-api-key',
            region: 'eu',
          },
        },
        telemetry: {
          includeToolsContext: {
            weather: {
              region: true,
            },
          },
          integrations: {
            onStart: event => {
              telemetryContexts.push(
                (event as { toolsContext: unknown }).toolsContext,
              );
            },
            onStepStart: ({ toolsContext }) => {
              telemetryContexts.push(toolsContext);
            },
            onStepEnd: ({ toolsContext }) => {
              telemetryContexts.push(toolsContext);
            },
            onEnd: event => {
              telemetryContexts.push(
                (event as { toolsContext: unknown }).toolsContext,
              );
            },
          },
        },
      });

      expect(telemetryContexts).toEqual([
        { weather: { region: 'eu' } },
        { weather: { region: 'eu' } },
        { weather: { region: 'eu' } },
        { weather: { region: 'eu' } },
      ]);
    });

    it('should exclude toolsContext properties from telemetry by default', async () => {
      const telemetryContexts: unknown[] = [];
      const tools = {
        weather: tool({
          inputSchema: z.object({ city: z.string() }),
          contextSchema: z.object({
            apiKey: z.string(),
            region: z.string(),
          }),
          execute: async () => 'sunny',
        }),
      };

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            finishReason: { unified: 'stop', raw: 'stop' },
          }),
        }),
        prompt: 'test-input',
        tools,
        toolsContext: {
          weather: {
            apiKey: 'secret-api-key',
            region: 'eu',
          },
        },
        telemetry: {
          integrations: {
            onStart: event => {
              telemetryContexts.push(
                (event as { toolsContext: unknown }).toolsContext,
              );
            },
            onStepStart: ({ toolsContext }) => {
              telemetryContexts.push(toolsContext);
            },
            onStepEnd: ({ toolsContext }) => {
              telemetryContexts.push(toolsContext);
            },
            onEnd: event => {
              telemetryContexts.push(
                (event as { toolsContext: unknown }).toolsContext,
              );
            },
          },
        },
      });

      expect(telemetryContexts).toEqual([{}, {}, {}, {}]);
    });

    it('should exclude runtimeContext from telemetry by default', async () => {
      const telemetryContexts: unknown[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            finishReason: { unified: 'stop', raw: 'stop' },
          }),
        }),
        runtimeContext: {
          userId: 'user-123',
          requestId: 'request-123',
        },
        prompt: 'test-input',
        telemetry: {
          integrations: {
            onStart: event => {
              telemetryContexts.push(
                (event as { runtimeContext: unknown }).runtimeContext,
              );
            },
            onStepStart: ({ runtimeContext }) => {
              telemetryContexts.push(runtimeContext);
            },
            onStepEnd: ({ runtimeContext }) => {
              telemetryContexts.push(runtimeContext);
            },
            onEnd: event => {
              telemetryContexts.push(
                (event as { runtimeContext: unknown }).runtimeContext,
              );
            },
          },
        },
      });

      expect(telemetryContexts).toEqual([{}, {}, {}, {}]);
    });
  });

  describe('invalid tool calls', () => {
    describe('single invalid tool call', () => {
      let result: GenerateTextResult<any, any, any>;

      beforeEach(async () => {
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              warnings: [],
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 20,
                  text: 20,
                  reasoning: undefined,
                },
              },
              finishReason: { unified: 'tool-calls', raw: undefined },
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'cityAttractions',
                  // wrong tool call arguments (city vs cities):
                  input: `{ "cities": "San Francisco" }`,
                },
              ],
            }),
          }),
          tools: {
            cityAttractions: tool({
              inputSchema: z.object({ city: z.string() }),
            }),
          },
          prompt: 'What are the tourist attractions in San Francisco?',
        });
      });

      it('should add tool error part to the content', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "dynamic": true,
              "error": [AI_InvalidToolInputError: Invalid input for tool cityAttractions: AI_TypeValidationError: Type validation failed: Value: {"cities":"San Francisco"}.
          Error message: [
            {
              "expected": "string",
              "code": "invalid_type",
              "path": [
                "city"
              ],
              "message": "Invalid input: expected string, received undefined"
            }
          ]],
              "input": {
                "cities": "San Francisco",
              },
              "invalid": true,
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-call",
            },
            {
              "dynamic": true,
              "error": "AI_InvalidToolInputError: Invalid input for tool cityAttractions: AI_TypeValidationError: Type validation failed: Value: {"cities":"San Francisco"}.
          Error message: [
            {
              "expected": "string",
              "code": "invalid_type",
              "path": [
                "city"
              ],
              "message": "Invalid input: expected string, received undefined"
            }
          ]",
              "input": {
                "cities": "San Francisco",
              },
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-error",
            },
          ]
        `);
      });

      it('should include error result in response messages', async () => {
        expect(result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "cities": "San Francisco",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "cityAttractions",
                  "type": "tool-call",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "output": {
                    "type": "error-text",
                    "value": "AI_InvalidToolInputError: Invalid input for tool cityAttractions: AI_TypeValidationError: Type validation failed: Value: {"cities":"San Francisco"}.
          Error message: [
            {
              "expected": "string",
              "code": "invalid_type",
              "path": [
                "city"
              ],
              "message": "Invalid input: expected string, received undefined"
            }
          ]",
                  },
                  "toolCallId": "call-1",
                  "toolName": "cityAttractions",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
          ]
        `);
      });
    });
  });

  describe('tools with preliminary results', () => {
    describe('single tool with preliminary results', () => {
      let result: GenerateTextResult<any, any, any>;

      beforeEach(async () => {
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              warnings: [],
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 20,
                  text: 20,
                  reasoning: undefined,
                },
              },
              finishReason: { unified: 'tool-calls', raw: undefined },
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'cityAttractions',
                  input: `{ "city": "San Francisco" }`,
                },
              ],
            }),
          }),
          prompt: 'test-input',
          _internal: {
            generateId: () => 'test-id',
            generateCallId: () => 'test-telemetry-call-id',
          },
          tools: {
            cityAttractions: tool({
              inputSchema: z.object({ city: z.string() }),
              async *execute({ city }) {
                yield {
                  status: 'loading',
                  text: `Getting weather for ${city}`,
                };

                yield {
                  status: 'success',
                  text: `The weather in ${city} is 72°F`,
                  temperature: 72,
                };
              },
            }),
          },
        });
      });

      it('should only include final tool result in content', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "city": "San Francisco",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-call",
            },
            {
              "dynamic": false,
              "input": {
                "city": "San Francisco",
              },
              "output": {
                "status": "success",
                "temperature": 72,
                "text": "The weather in San Francisco is 72°F",
              },
              "toolCallId": "call-1",
              "toolName": "cityAttractions",
              "type": "tool-result",
            },
          ]
        `);
      });

      it('should only include final tool result in step content', async () => {
        expect(result.steps).toMatchInlineSnapshot(`
          [
            DefaultStepResult {
              "callId": "test-telemetry-call-id",
              "content": [
                {
                  "input": {
                    "city": "San Francisco",
                  },
                  "providerExecuted": undefined,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "call-1",
                  "toolName": "cityAttractions",
                  "type": "tool-call",
                },
                {
                  "dynamic": false,
                  "input": {
                    "city": "San Francisco",
                  },
                  "output": {
                    "status": "success",
                    "temperature": 72,
                    "text": "The weather in San Francisco is 72°F",
                  },
                  "toolCallId": "call-1",
                  "toolName": "cityAttractions",
                  "type": "tool-result",
                },
              ],
              "finishReason": "tool-calls",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
              },
              "performance": {
                "effectiveOutputTokensPerSecond": 0,
                "effectiveTotalTokensPerSecond": 0,
                "inputTokensPerSecond": undefined,
                "outputTokensPerSecond": undefined,
                "responseTimeMs": 0,
                "stepTimeMs": 0,
                "timeToFirstOutputMs": undefined,
                "toolExecutionMs": {
                  "call-1": 0,
                },
              },
              "providerMetadata": undefined,
              "rawFinishReason": undefined,
              "request": {
                "body": undefined,
                "messages": undefined,
              },
              "response": {
                "body": undefined,
                "headers": undefined,
                "id": "test-id",
                "messages": [
                  {
                    "content": [
                      {
                        "input": {
                          "city": "San Francisco",
                        },
                        "providerExecuted": undefined,
                        "providerOptions": undefined,
                        "toolCallId": "call-1",
                        "toolName": "cityAttractions",
                        "type": "tool-call",
                      },
                    ],
                    "role": "assistant",
                  },
                  {
                    "content": [
                      {
                        "output": {
                          "type": "json",
                          "value": {
                            "status": "success",
                            "temperature": 72,
                            "text": "The weather in San Francisco is 72°F",
                          },
                        },
                        "toolCallId": "call-1",
                        "toolName": "cityAttractions",
                        "type": "tool-result",
                      },
                    ],
                    "role": "tool",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "runtimeContext": {},
              "stepNumber": 0,
              "toolsContext": {},
              "usage": {
                "inputTokenDetails": {
                  "cacheReadTokens": undefined,
                  "cacheWriteTokens": undefined,
                  "noCacheTokens": 10,
                },
                "inputTokens": 10,
                "outputTokenDetails": {
                  "reasoningTokens": undefined,
                  "textTokens": 20,
                },
                "outputTokens": 20,
                "raw": undefined,
                "totalTokens": 30,
              },
              "warnings": [],
            },
          ]
        `);
      });
    });
  });

  describe('logWarnings', () => {
    it('should call logWarnings with warnings from a single step', async () => {
      const expectedWarnings = [
        {
          type: 'other' as const,
          message: 'Setting is not supported',
        },
        {
          type: 'unsupported' as const,
          feature: 'temperature',
          details: 'Temperature parameter not supported',
        },
      ];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: {
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            warnings: expectedWarnings,
          },
        }),
        prompt: 'Hello',
      });

      expect(logWarningsSpy).toHaveBeenCalledOnce();
      expect(logWarningsSpy).toHaveBeenCalledWith({
        warnings: expectedWarnings,
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
    });

    it('should call logWarnings once for each step with warnings from that step', async () => {
      const warning1 = {
        type: 'other' as const,
        message: 'Warning from step 1',
      };
      const warning2 = {
        type: 'other' as const,
        message: 'Warning from step 2',
      };

      let callCount = 0;

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => {
            switch (callCount++) {
              case 0:
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'testTool',
                      input: `{ "value": "test" }`,
                    },
                  ],
                  finishReason: { unified: 'tool-calls', raw: undefined },
                  warnings: [warning1],
                };
              case 1:
                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Final response' }],
                  warnings: [warning2],
                };
              default:
                throw new Error('Unexpected call');
            }
          },
        }),
        prompt: 'Hello',
        tools: {
          testTool: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result',
          },
        },
        stopWhen: isStepCount(3),
      });

      expect(logWarningsSpy).toHaveBeenCalledTimes(2);
      expect(logWarningsSpy).toHaveBeenNthCalledWith(1, {
        warnings: [warning1],
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
      expect(logWarningsSpy).toHaveBeenNthCalledWith(2, {
        warnings: [warning2],
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
    });

    it('should call logWarnings with empty array when no warnings are present', async () => {
      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: {
            ...dummyResponseValues,
            content: [{ type: 'text', text: 'Hello, world!' }],
            warnings: [], // no warnings
          },
        }),
        prompt: 'Hello',
      });

      expect(logWarningsSpy).toHaveBeenCalledOnce();
      expect(logWarningsSpy).toHaveBeenCalledWith({
        warnings: [],
        provider: 'mock-provider',
        model: 'mock-model-id',
      });
    });
  });

  describe('tool execution approval', () => {
    describe('when a single tool needs approval (user-defined)', () => {
      let result: GenerateTextResult<any, any, any>;

      beforeEach(async () => {
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: `{ "value": "value" }`,
                },
              ],
              finishReason: { unified: 'tool-calls', raw: undefined },
            }),
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          prompt: 'test-input',
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
        });
      });

      it('should only execute 1 step when the tool needs approval', async () => {
        expect(result.steps.length).toBe(1);
      });

      it('should have tool-calls finish reason', async () => {
        expect(result.finishReason).toBe('tool-calls');
      });

      it('should add a tool approval request to the content', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "approvalId": "id-1",
              "toolCall": {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              "type": "tool-approval-request",
            },
          ]
        `);
      });

      it('should include tool approval request in response messages', async () => {
        expect(result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "approvalId": "id-1",
                  "isAutomatic": undefined,
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('when a single tool needs approval (tool-defined)', () => {
      let result: GenerateTextResult<any, any, any>;

      beforeEach(async () => {
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: `{ "value": "value" }`,
                },
              ],
              finishReason: { unified: 'tool-calls', raw: undefined },
            }),
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
              needsApproval: true,
            }),
          },
          stopWhen: isStepCount(3),
          prompt: 'test-input',
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
        });
      });

      it('should only execute 1 step when the tool needs approval', async () => {
        expect(result.steps.length).toBe(1);
      });

      it('should have tool-calls finish reason', async () => {
        expect(result.finishReason).toBe('tool-calls');
      });

      it('should add a tool approval request to the content', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "approvalId": "id-1",
              "toolCall": {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              "type": "tool-approval-request",
            },
          ]
        `);
      });

      it('should include tool approval request in response messages', async () => {
        expect(result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "approvalId": "id-1",
                  "isAutomatic": undefined,
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('when a single tool has a needsApproval function', () => {
      let result: GenerateTextResult<any, any, any>;
      let needsApprovalCalls: Array<{ input: any; options: any }> = [];

      beforeEach(async () => {
        needsApprovalCalls = [];
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: `{ "value": "value-needs-approval" }`,
                },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-2',
                  toolName: 'tool1',
                  input: `{ "value": "value-no-approval" }`,
                },
              ],
              finishReason: { unified: 'tool-calls', raw: undefined },
            }),
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: input => `result for ${input.value}`,
            }),
          },
          toolApproval: {
            tool1: (input, options) => {
              needsApprovalCalls.push({ input, options });
              return input.value === 'value-needs-approval'
                ? 'user-approval'
                : 'not-applicable';
            },
          },
          stopWhen: isStepCount(3),
          prompt: 'test-input',
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
        });
      });

      it('should only execute 1 step when the tool needs approval', async () => {
        expect(result.steps.length).toBe(1);
      });

      it('should have tool-calls finish reason', async () => {
        expect(result.finishReason).toBe('tool-calls');
      });

      it('should add a tool approval request to the content', async () => {
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value-needs-approval",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "input": {
                "value": "value-no-approval",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "title": undefined,
              "toolCallId": "call-2",
              "toolName": "tool1",
              "type": "tool-call",
            },
            {
              "dynamic": false,
              "input": {
                "value": "value-no-approval",
              },
              "output": "result for value-no-approval",
              "toolCallId": "call-2",
              "toolName": "tool1",
              "type": "tool-result",
            },
            {
              "approvalId": "id-1",
              "toolCall": {
                "input": {
                  "value": "value-needs-approval",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              "type": "tool-approval-request",
            },
          ]
        `);
      });

      it('should include tool approval request in response messages', async () => {
        expect(result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "value": "value-needs-approval",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "input": {
                    "value": "value-no-approval",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-2",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "approvalId": "id-1",
                  "isAutomatic": undefined,
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "output": {
                    "type": "text",
                    "value": "result for value-no-approval",
                  },
                  "toolCallId": "call-2",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
          ]
        `);
      });

      it('should call the needsApproval function with the correct input and options', async () => {
        expect(needsApprovalCalls).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value-needs-approval",
              },
              "options": {
                "messages": [
                  {
                    "content": "test-input",
                    "role": "user",
                  },
                ],
                "runtimeContext": {},
                "toolCallId": "call-1",
                "toolContext": undefined,
              },
            },
            {
              "input": {
                "value": "value-no-approval",
              },
              "options": {
                "messages": [
                  {
                    "content": "test-input",
                    "role": "user",
                  },
                ],
                "runtimeContext": {},
                "toolCallId": "call-2",
                "toolContext": undefined,
              },
            },
          ]
        `);
      });
    });

    describe('when a call from a single tool that needs approval is approved', () => {
      let result: GenerateTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];
      let executeFunction: ToolExecuteFunction<any, any, any>;

      beforeEach(async () => {
        prompts = [];
        executeFunction = vi.fn().mockReturnValue('result1');
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async ({ prompt }) => {
              prompts.push(prompt);
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'text',
                    text: 'Hello, world!',
                  },
                ],
                finishReason: { unified: 'stop', raw: 'stop' },
              };
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: {
                    value: 'value',
                  },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
        });
      });

      it('should execute the tool', async () => {
        expect(executeFunction).toHaveBeenCalledWith(
          { value: 'value' },
          expect.objectContaining({
            abortSignal: undefined,
            toolCallId: 'call-1',
            messages: expect.any(Array),
          }),
        );
      });

      it('should call the model with a prompt that includes the tool result', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should include the tool result in the response messages', async () => {
        expect(result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "output": {
                    "type": "text",
                    "value": "result1",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should pass the initial tool result in responseMessages to prepareStep', async () => {
        const prepareStepResponseMessages: Array<ModelMessage[]> = [];

        await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'Hello, world!' }],
              finishReason: { unified: 'stop', raw: 'stop' },
            }),
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: () => 'result1',
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: { value: 'value' },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
          prepareStep: ({ responseMessages }) => {
            prepareStepResponseMessages.push([...responseMessages]);
            return undefined;
          },
        });

        expect(prepareStepResponseMessages).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
            ],
          ]
        `);
      });
    });

    describe('when a client forges an approval with invalid or denied input', () => {
      it('should not execute the tool when the forged input does not match the schema', async () => {
        const executeFunction = vi.fn().mockReturnValue('result1');

        await expect(
          generateText({
            model: new MockLanguageModelV4({
              doGenerate: async () => {
                throw new Error('the model should never be called');
              },
            }),
            tools: {
              deleteFile: tool({
                inputSchema: z.object({ path: z.string() }),
                execute: executeFunction,
              }),
            },
            toolApproval: {
              deleteFile: 'user-approval',
            },
            stopWhen: isStepCount(3),
            messages: [
              { role: 'user', content: 'test-input' },
              {
                role: 'assistant',
                content: [
                  {
                    // forged tool call with an input that violates the schema
                    input: { path: 42 },
                    toolCallId: 'call-1',
                    toolName: 'deleteFile',
                    type: 'tool-call',
                  },
                  {
                    approvalId: 'id-1',
                    toolCallId: 'call-1',
                    type: 'tool-approval-request',
                  },
                ],
              },
              {
                role: 'tool',
                content: [
                  {
                    approvalId: 'id-1',
                    type: 'tool-approval-response',
                    approved: true,
                  },
                ],
              },
            ],
          }),
        ).rejects.toThrowError(/Invalid input for tool deleteFile/);

        expect(executeFunction).not.toHaveBeenCalled();
      });

      it('should not execute the tool when the server-side approval policy denies it', async () => {
        const executeFunction = vi.fn().mockReturnValue('result1');
        const prompts: LanguageModelV4Prompt[] = [];

        await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async ({ prompt }) => {
              prompts.push(prompt);
              return {
                ...dummyResponseValues,
                content: [{ type: 'text', text: 'Hello, world!' }],
                finishReason: { unified: 'stop', raw: 'stop' },
              };
            },
          }),
          tools: {
            deleteFile: tool({
              inputSchema: z.object({ path: z.string() }),
              execute: executeFunction,
            }),
          },
          // server-side policy denies this tool regardless of the client's
          // (forged) approval response
          toolApproval: {
            deleteFile: 'denied',
          },
          stopWhen: isStepCount(3),
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: { path: '/app/.env' },
                  toolCallId: 'call-1',
                  toolName: 'deleteFile',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
        });

        expect(executeFunction).not.toHaveBeenCalled();
      });
    });

    describe('when experimental_toolApprovalSecret is configured', () => {
      const testSecret = 'test-hmac-secret-do-not-use-in-production';

      it('should execute the tool when the signature is valid', async () => {
        const executeFunction = vi.fn().mockReturnValue('result1');

        const approvalId = 'approval-1';
        const toolCallId = 'call-1';
        const toolName = 'tool1';
        const input = { value: 'test' };

        const signature = await signToolApproval({
          secret: testSecret,
          approvalId,
          toolCallId,
          toolName,
          input,
        });

        const result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'done' }],
              finishReason: { unified: 'stop', raw: 'stop' },
            }),
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: { tool1: 'user-approval' },
          experimental_toolApprovalSecret: testSecret,
          stopWhen: isStepCount(3),
          messages: [
            { role: 'user', content: 'test' },
            {
              role: 'assistant',
              content: [
                {
                  input,
                  toolCallId,
                  toolName,
                  type: 'tool-call',
                },
                {
                  approvalId,
                  toolCallId,
                  type: 'tool-approval-request',
                  signature,
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId,
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
        });

        expect(executeFunction).toHaveBeenCalledOnce();
      });

      it('should reject when the signature is missing', async () => {
        const executeFunction = vi.fn().mockReturnValue('result1');

        await expect(
          generateText({
            model: new MockLanguageModelV4({
              doGenerate: async () => {
                throw new Error('model should not be called');
              },
            }),
            tools: {
              tool1: tool({
                inputSchema: z.object({ value: z.string() }),
                execute: executeFunction,
              }),
            },
            toolApproval: { tool1: 'user-approval' },
            experimental_toolApprovalSecret: testSecret,
            stopWhen: isStepCount(3),
            messages: [
              { role: 'user', content: 'test' },
              {
                role: 'assistant',
                content: [
                  {
                    input: { value: 'test' },
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    type: 'tool-call',
                  },
                  {
                    approvalId: 'approval-1',
                    toolCallId: 'call-1',
                    type: 'tool-approval-request',
                    // no signature
                  },
                ],
              },
              {
                role: 'tool',
                content: [
                  {
                    approvalId: 'approval-1',
                    type: 'tool-approval-response',
                    approved: true,
                  },
                ],
              },
            ],
          }),
        ).rejects.toThrowError(/missing signature/);

        expect(executeFunction).not.toHaveBeenCalled();
      });

      it('should reject when the input was tampered after signing', async () => {
        const executeFunction = vi.fn().mockReturnValue('result1');

        const signature = await signToolApproval({
          secret: testSecret,
          approvalId: 'approval-1',
          toolCallId: 'call-1',
          toolName: 'tool1',
          input: { value: 'original' },
        });

        await expect(
          generateText({
            model: new MockLanguageModelV4({
              doGenerate: async () => {
                throw new Error('model should not be called');
              },
            }),
            tools: {
              tool1: tool({
                inputSchema: z.object({ value: z.string() }),
                execute: executeFunction,
              }),
            },
            toolApproval: { tool1: 'user-approval' },
            experimental_toolApprovalSecret: testSecret,
            stopWhen: isStepCount(3),
            messages: [
              { role: 'user', content: 'test' },
              {
                role: 'assistant',
                content: [
                  {
                    input: { value: 'tampered' },
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    type: 'tool-call',
                  },
                  {
                    approvalId: 'approval-1',
                    toolCallId: 'call-1',
                    type: 'tool-approval-request',
                    signature,
                  },
                ],
              },
              {
                role: 'tool',
                content: [
                  {
                    approvalId: 'approval-1',
                    type: 'tool-approval-response',
                    approved: true,
                  },
                ],
              },
            ],
          }),
        ).rejects.toThrowError(/invalid signature/);

        expect(executeFunction).not.toHaveBeenCalled();
      });

      it('should work without a secret (backward compatible)', async () => {
        const executeFunction = vi.fn().mockReturnValue('result1');

        await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async () => ({
              ...dummyResponseValues,
              content: [{ type: 'text', text: 'done' }],
              finishReason: { unified: 'stop', raw: 'stop' },
            }),
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: { tool1: 'user-approval' },
          // no experimental_toolApprovalSecret
          stopWhen: isStepCount(3),
          messages: [
            { role: 'user', content: 'test' },
            {
              role: 'assistant',
              content: [
                {
                  input: { value: 'test' },
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'approval-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'approval-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
        });

        expect(executeFunction).toHaveBeenCalledOnce();
      });
    });

    describe('when a call from a single tool that needs approval is approved and the tool throws', () => {
      let result: GenerateTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];

      beforeEach(async () => {
        prompts = [];
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async ({ prompt }) => {
              prompts.push(prompt);
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'text',
                    text: 'Hello, world!',
                  },
                ],
                finishReason: { unified: 'stop', raw: 'stop' },
              };
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async (): Promise<string> => {
                throw new Error('No valid token for plugin');
              },
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
          },
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: {
                    value: 'value',
                  },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
        });
      });

      it('should serialize the tool error as error-text in the continuation prompt', async () => {
        expect(prompts).toEqual([
          [
            {
              role: 'user',
              content: [{ type: 'text', text: 'test-input' }],
              providerOptions: undefined,
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  input: { value: 'value' },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                },
              ],
              providerOptions: undefined,
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  output: {
                    type: 'error-text',
                    value: 'Error: No valid token for plugin',
                  },
                  providerOptions: undefined,
                },
              ],
              providerOptions: undefined,
            },
          ],
        ]);
      });
    });

    describe('when a call from a single tool that needs approval is denied', () => {
      let result: GenerateTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];
      let executeFunction: ToolExecuteFunction<any, any, any>;

      beforeEach(async () => {
        prompts = [];
        executeFunction = vi.fn().mockReturnValue('result1');
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async ({ prompt }) => {
              prompts.push(prompt);
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'text',
                    text: 'Hello, world!',
                  },
                ],
                finishReason: { unified: 'tool-calls', raw: undefined },
              };
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: {
                    value: 'value',
                  },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: false,
                },
              ],
            },
          ],
        });
      });

      it('should not execute the tool', async () => {
        expect(executeFunction).not.toHaveBeenCalled();
      });

      it('should call the model with a prompt that includes the tool error', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "reason": undefined,
                      "type": "execution-denied",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should include the tool error in the response messages', async () => {
        expect(result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "output": {
                    "reason": undefined,
                    "type": "execution-denied",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('when a single tool is automatically rejected', () => {
      let result: GenerateTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];
      let executeFunction: ToolExecuteFunction<any, any, any>;

      beforeEach(async () => {
        prompts = [];
        executeFunction = vi.fn().mockReturnValue('result1');

        let step = 0;
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async ({ prompt }) => {
              prompts.push(prompt);
              switch (step++) {
                case 0:
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallType: 'function',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                    ],
                    finishReason: { unified: 'tool-calls', raw: undefined },
                  };

                default:
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'text',
                        text: 'Hello, world!',
                      },
                    ],
                    finishReason: { unified: 'stop', raw: 'stop' },
                  };
              }
            },
          }),
          prompt: 'test-input',
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: {
            tool1: {
              type: 'denied',
              reason: 'blocked by policy',
            },
          },
        });
      });

      it('should continue to a second step with text and not execute the tool', async () => {
        expect(executeFunction).not.toHaveBeenCalled();
        expect(result.text).toBe('Hello, world!');
        expect(result.steps.length).toBe(2);
      });

      it('should call the model again for the second step', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ],
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "reason": "blocked by policy",
                      "type": "execution-denied",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should produce response messages', async () => {
        expect(result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "approvalId": "id-1",
                  "isAutomatic": true,
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "approvalId": "id-1",
                  "approved": false,
                  "providerExecuted": undefined,
                  "reason": "blocked by policy",
                  "type": "tool-approval-response",
                },
                {
                  "output": {
                    "reason": "blocked by policy",
                    "type": "execution-denied",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('when a single tool is automatically approved', () => {
      let result: GenerateTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];
      let executeFunction: ToolExecuteFunction<any, any, any>;

      beforeEach(async () => {
        prompts = [];
        executeFunction = vi.fn().mockReturnValue('result1');

        let step = 0;
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async ({ prompt }) => {
              prompts.push(prompt);
              switch (step++) {
                case 0:
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallType: 'function',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                    ],
                    finishReason: { unified: 'tool-calls', raw: undefined },
                  };

                default:
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'text',
                        text: 'Hello, world!',
                      },
                    ],
                    finishReason: { unified: 'stop', raw: 'stop' },
                  };
              }
            },
          }),
          prompt: 'test-input',
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: {
            tool1: {
              type: 'approved',
              reason: 'trusted internal tool',
            },
          },
        });
      });

      it('should continue to a second step and execute the tool', async () => {
        expect(executeFunction).toHaveBeenCalledWith(
          { value: 'value' },
          expect.objectContaining({
            abortSignal: undefined,
            toolCallId: 'call-1',
            messages: expect.any(Array),
          }),
        );
        expect(result.text).toBe('Hello, world!');
        expect(result.steps.length).toBe(2);
      });

      it('should call the model again for the second step with the tool result', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ],
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should produce response messages with automatic approval metadata', async () => {
        expect(result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "providerOptions": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "approvalId": "id-1",
                  "isAutomatic": true,
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "approvalId": "id-1",
                  "approved": true,
                  "providerExecuted": undefined,
                  "reason": "trusted internal tool",
                  "type": "tool-approval-response",
                },
                {
                  "output": {
                    "type": "text",
                    "value": "result1",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('when two calls from a single tool that needs approval are approved', () => {
      let result: GenerateTextResult<any, any, any>;
      let prompts: LanguageModelV4Prompt[];
      let executeFunction: ToolExecuteFunction<any, any, any>;

      beforeEach(async () => {
        prompts = [];
        executeFunction = vi.fn().mockReturnValue('result1');
        result = await generateText({
          model: new MockLanguageModelV4({
            doGenerate: async ({ prompt }) => {
              prompts.push(prompt);
              return {
                ...dummyResponseValues,
                content: [
                  {
                    type: 'text',
                    text: 'Hello, world!',
                  },
                ],
                finishReason: { unified: 'tool-calls', raw: undefined },
              };
            },
          }),
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: executeFunction,
            }),
          },
          toolApproval: {
            tool1: 'user-approval',
          },
          stopWhen: isStepCount(3),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            generateCallId: () => 'test-telemetry-call-id',
          },
          messages: [
            { role: 'user', content: 'test-input' },
            {
              role: 'assistant',
              content: [
                {
                  input: {
                    value: 'value1',
                  },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-1',
                  toolCallId: 'call-1',
                  type: 'tool-approval-request',
                },
                {
                  input: {
                    value: 'value2',
                  },
                  providerExecuted: undefined,
                  providerOptions: undefined,
                  toolCallId: 'call-2',
                  toolName: 'tool1',
                  type: 'tool-call',
                },
                {
                  approvalId: 'id-2',
                  toolCallId: 'call-2',
                  type: 'tool-approval-request',
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  approvalId: 'id-1',
                  type: 'tool-approval-response',
                  approved: true,
                },
                {
                  approvalId: 'id-2',
                  type: 'tool-approval-response',
                  approved: true,
                },
              ],
            },
          ],
        });
      });

      it('should call the model with a prompt that includes the tool results', async () => {
        expect(prompts).toMatchInlineSnapshot(`
          [
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "value": "value1",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                  {
                    "input": {
                      "value": "value2",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-2",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-2",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ],
          ]
        `);
      });

      it('should include the tool results in the response messages', async () => {
        expect(result.responseMessages).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "output": {
                    "type": "text",
                    "value": "result1",
                  },
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
                {
                  "output": {
                    "type": "text",
                    "value": "result1",
                  },
                  "toolCallId": "call-2",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "providerOptions": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('provider-executed tool (MCP) approval', () => {
      describe('when a provider-executed tool emits tool-approval-request', () => {
        let result: GenerateTextResult<any, any, any>;

        beforeEach(async () => {
          result = await generateText({
            model: new MockLanguageModelV4({
              doGenerate: async () => ({
                ...dummyResponseValues,
                content: [
                  {
                    type: 'tool-call',
                    toolCallId: 'mcp-call-1',
                    toolName: 'mcp_tool',
                    input: `{ "query": "test" }`,
                    providerExecuted: true,
                  },
                  {
                    type: 'tool-approval-request',
                    approvalId: 'mcp-approval-1',
                    toolCallId: 'mcp-call-1',
                  },
                ],
                finishReason: { unified: 'tool-calls', raw: undefined },
              }),
            }),
            tools: {
              mcp_tool: {
                type: 'provider',
                isProviderExecuted: true,
                id: 'test.mcp_tool',
                inputSchema: z.object({ query: z.string() }),
                args: {},
              },
            },
            stopWhen: isStepCount(3),
            prompt: 'test-input',
            _internal: {
              generateId: mockId({ prefix: 'id' }),
              generateCallId: () => 'test-telemetry-call-id',
            },
          });
        });

        it('should only execute 1 step when waiting for approval', async () => {
          expect(result.steps.length).toBe(1);
        });

        it('should have tool-calls finish reason', async () => {
          expect(result.finishReason).toBe('tool-calls');
        });

        it('should add tool approval request with providerExecuted tool call to content', async () => {
          expect(result.content).toMatchInlineSnapshot(`
            [
              {
                "input": {
                  "query": "test",
                },
                "providerExecuted": true,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "mcp-call-1",
                "toolName": "mcp_tool",
                "type": "tool-call",
              },
              {
                "approvalId": "mcp-approval-1",
                "toolCall": {
                  "input": {
                    "query": "test",
                  },
                  "providerExecuted": true,
                  "providerMetadata": undefined,
                  "title": undefined,
                  "toolCallId": "mcp-call-1",
                  "toolName": "mcp_tool",
                  "type": "tool-call",
                },
                "type": "tool-approval-request",
              },
            ]
          `);
        });

        it('should include tool approval request in response messages', async () => {
          expect(result.responseMessages).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "input": {
                      "query": "test",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "mcp-call-1",
                    "toolName": "mcp_tool",
                    "type": "tool-call",
                  },
                  {
                    "approvalId": "mcp-approval-1",
                    "isAutomatic": undefined,
                    "toolCallId": "mcp-call-1",
                    "type": "tool-approval-request",
                  },
                ],
                "role": "assistant",
              },
            ]
          `);
        });
      });

      describe('when a provider-executed tool approval is approved', () => {
        let result: GenerateTextResult<any, any, any>;
        let prompts: LanguageModelV4Prompt[];

        beforeEach(async () => {
          prompts = [];
          let callCount = 0;
          result = await generateText({
            model: new MockLanguageModelV4({
              doGenerate: async ({ prompt }) => {
                prompts.push(prompt);
                callCount++;

                if (callCount === 1) {
                  // Model returns tool call with result after approval
                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'mcp-call-1',
                        toolName: 'mcp_tool',
                        input: `{ "query": "test" }`,
                        providerExecuted: true,
                      },
                      {
                        type: 'tool-result',
                        toolCallId: 'mcp-call-1',
                        toolName: 'mcp_tool',
                        result: { shortened_url: 'https://short.url/abc' },
                        providerExecuted: true,
                      },
                      {
                        type: 'text',
                        text: 'Here is your shortened URL: https://short.url/abc',
                      },
                    ],
                    finishReason: { unified: 'stop', raw: 'stop' },
                  };
                }

                return {
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Done' }],
                  finishReason: { unified: 'stop', raw: 'stop' },
                };
              },
            }),
            tools: {
              mcp_tool: {
                type: 'provider',
                isProviderExecuted: true,
                id: 'test.mcp_tool',
                inputSchema: z.object({ query: z.string() }),
                args: {},
              },
            },
            stopWhen: isStepCount(3),
            _internal: {
              generateId: mockId({ prefix: 'id' }),
              generateCallId: () => 'test-telemetry-call-id',
            },
            messages: [
              {
                role: 'user',
                content: 'Shorten this URL: https://example.com',
              },
              {
                role: 'assistant',
                content: [
                  {
                    input: { query: 'test' },
                    providerExecuted: true,
                    providerOptions: undefined,
                    toolCallId: 'mcp-call-1',
                    toolName: 'mcp_tool',
                    type: 'tool-call',
                  },
                  {
                    approvalId: 'mcp-approval-1',
                    toolCallId: 'mcp-call-1',
                    type: 'tool-approval-request',
                  },
                ],
              },
              {
                role: 'tool',
                content: [
                  {
                    approvalId: 'mcp-approval-1',
                    type: 'tool-approval-response',
                    approved: true,
                    providerExecuted: true,
                  },
                ],
              },
            ],
          });
        });

        it('should send tool-approval-response to the model exactly once', async () => {
          expect(prompts[0]).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Shorten this URL: https://example.com",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "query": "test",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "mcp-call-1",
                    "toolName": "mcp_tool",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "approvalId": "mcp-approval-1",
                    "approved": true,
                    "reason": undefined,
                    "type": "tool-approval-response",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ]
          `);
        });

        it('should include provider-executed tool result in content', async () => {
          expect(result.content).toMatchInlineSnapshot(`
            [
              {
                "input": {
                  "query": "test",
                },
                "providerExecuted": true,
                "providerMetadata": undefined,
                "title": undefined,
                "toolCallId": "mcp-call-1",
                "toolName": "mcp_tool",
                "type": "tool-call",
              },
              {
                "dynamic": undefined,
                "input": {
                  "query": "test",
                },
                "output": {
                  "shortened_url": "https://short.url/abc",
                },
                "providerExecuted": true,
                "toolCallId": "mcp-call-1",
                "toolName": "mcp_tool",
                "type": "tool-result",
              },
              {
                "text": "Here is your shortened URL: https://short.url/abc",
                "type": "text",
              },
            ]
          `);
        });
      });

      describe('when a provider-executed tool approval is denied', () => {
        let result: GenerateTextResult<any, any, any>;
        let prompts: LanguageModelV4Prompt[];

        beforeEach(async () => {
          prompts = [];
          result = await generateText({
            model: new MockLanguageModelV4({
              doGenerate: async ({ prompt }) => {
                prompts.push(prompt);
                return {
                  ...dummyResponseValues,
                  content: [
                    {
                      type: 'text',
                      text: 'I understand. The tool execution was not approved.',
                    },
                  ],
                  finishReason: { unified: 'stop', raw: 'stop' },
                };
              },
            }),
            tools: {
              mcp_tool: {
                type: 'provider',
                isProviderExecuted: true,
                id: 'test.mcp_tool',
                inputSchema: z.object({ query: z.string() }),
                args: {},
              },
            },
            stopWhen: isStepCount(3),
            _internal: {
              generateId: mockId({ prefix: 'id' }),
              generateCallId: () => 'test-telemetry-call-id',
            },
            messages: [
              {
                role: 'user',
                content: 'Shorten this URL: https://example.com',
              },
              {
                role: 'assistant',
                content: [
                  {
                    input: { query: 'test' },
                    providerExecuted: true,
                    providerOptions: undefined,
                    toolCallId: 'mcp-call-1',
                    toolName: 'mcp_tool',
                    type: 'tool-call',
                  },
                  {
                    approvalId: 'mcp-approval-1',
                    toolCallId: 'mcp-call-1',
                    type: 'tool-approval-request',
                  },
                ],
              },
              {
                role: 'tool',
                content: [
                  {
                    approvalId: 'mcp-approval-1',
                    type: 'tool-approval-response',
                    approved: false,
                    reason: 'User denied the request',
                    providerExecuted: true,
                  },
                ],
              },
            ],
          });
        });

        it('should send denied tool-approval-response to the model exactly once', async () => {
          expect(prompts[0]).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "Shorten this URL: https://example.com",
                    "type": "text",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
              {
                "content": [
                  {
                    "input": {
                      "query": "test",
                    },
                    "providerExecuted": true,
                    "providerOptions": undefined,
                    "toolCallId": "mcp-call-1",
                    "toolName": "mcp_tool",
                    "type": "tool-call",
                  },
                ],
                "providerOptions": undefined,
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "approvalId": "mcp-approval-1",
                    "approved": false,
                    "reason": "User denied the request",
                    "type": "tool-approval-response",
                  },
                  {
                    "output": {
                      "providerOptions": {
                        "openai": {
                          "approvalId": "mcp-approval-1",
                        },
                      },
                      "reason": "User denied the request",
                      "type": "execution-denied",
                    },
                    "providerOptions": undefined,
                    "toolCallId": "mcp-call-1",
                    "toolName": "mcp_tool",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
              },
            ]
          `);
        });

        it('should include text response from model in content', async () => {
          expect(result.content).toMatchInlineSnapshot(`
            [
              {
                "text": "I understand. The tool execution was not approved.",
                "type": "text",
              },
            ]
          `);
        });

        it('should have stop finish reason', async () => {
          expect(result.finishReason).toBe('stop');
        });
      });
    });
  });

  describe('prepareStep with model switch and image URLs', () => {
    it('should use the prepareStep model supportedUrls for download decision', async () => {
      const downloadCalls: Array<{ url: URL; isUrlSupportedByModel: boolean }> =
        [];
      const languageModelCalls: Array<LanguageModelV4CallOptions> = [];

      const modelWithImageUrlSupport = new MockLanguageModelV4({
        provider: 'with-image-url-support',
        modelId: 'with-image-url-support',
        supportedUrls: {
          'image/*': [/^https?:\/\/.*$/],
        },
        doGenerate: async options => {
          languageModelCalls.push(options);
          return {
            ...dummyResponseValues,
            content: [
              { type: 'text', text: 'response from with-image-url-support' },
            ],
          };
        },
      });

      const modelWithoutImageUrlSupport = new MockLanguageModelV4({
        provider: 'without-image-url-support',
        modelId: 'without-image-url-support',
        supportedUrls: {},
        doGenerate: async options => {
          languageModelCalls.push(options);
          return {
            ...dummyResponseValues,
            content: [
              { type: 'text', text: 'response from without-image-url-support' },
            ],
          };
        },
      });

      const customDownload = async (
        requestedDownloads: Array<{ url: URL; isUrlSupportedByModel: boolean }>,
      ) => {
        downloadCalls.push(...requestedDownloads);
        return requestedDownloads.map(download =>
          download.isUrlSupportedByModel
            ? null
            : {
                data: new Uint8Array([1, 2, 3, 4]),
                mediaType: 'image/png',
              },
        );
      };

      const result = await generateText({
        model: modelWithImageUrlSupport,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image' },
              { type: 'image', image: 'https://example.com/test.jpg' },
            ],
          },
        ],
        prepareStep: async () => {
          return { model: modelWithoutImageUrlSupport }; // model switch
        },
        experimental_download: customDownload,
      });

      expect(downloadCalls).toMatchInlineSnapshot(`
        [
          {
            "isUrlSupportedByModel": false,
            "url": "https://example.com/test.jpg",
          },
        ]
      `);

      expect(languageModelCalls).toMatchInlineSnapshot(`
        [
          {
            "abortSignal": undefined,
            "frequencyPenalty": undefined,
            "headers": {
              "user-agent": "ai/0.0.0-test",
            },
            "maxOutputTokens": undefined,
            "presencePenalty": undefined,
            "prompt": [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "Describe this image",
                    "type": "text",
                  },
                  {
                    "data": {
                      "data": Uint8Array [
                        1,
                        2,
                        3,
                        4,
                      ],
                      "type": "data",
                    },
                    "filename": undefined,
                    "mediaType": "image/png",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                ],
                "providerOptions": undefined,
                "role": "user",
              },
            ],
            "providerOptions": undefined,
            "reasoning": undefined,
            "responseFormat": undefined,
            "seed": undefined,
            "stopSequences": undefined,
            "temperature": undefined,
            "toolChoice": {
              "type": "auto",
            },
            "tools": undefined,
            "topK": undefined,
            "topP": undefined,
          },
        ]
      `);

      expect(result.text).toBe('response from without-image-url-support');
    });
  });

  describe('telemetry integrations', () => {
    afterEach(() => {
      globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = undefined;
    });

    it('should call per-call integration listeners for all lifecycle events', async () => {
      const events: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: '{ "value": "test" }',
              },
            ],
            ...dummyResponseValues,
          }),
        }),
        tools: {
          testTool: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          }),
        },
        prompt: 'test-input',
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

      expect(events).toMatchInlineSnapshot(`
        [
          "onStart",
          "onStepStart",
          "onToolExecutionStart",
          "onToolExecutionEnd",
          "onStepEnd",
          "onEnd",
        ]
      `);
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

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
      });

      expect(events).toEqual([
        'global-onStart',
        'global-onStepEnd',
        'global-onEnd',
      ]);
    });

    it('should only call per-call integrations when both global and per-call integrations are provided', async () => {
      const events: string[] = [];

      globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = [
        {
          onStart: async () => {
            events.push('global');
          },
        },
      ];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        telemetry: {
          integrations: {
            onStart: async () => {
              events.push('per-call');
            },
          },
        },
      });

      expect(events).toEqual(['per-call']);
    });

    it('should call integration listeners alongside user callbacks', async () => {
      const events: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        onStart: async () => {
          events.push('user-onStart');
        },
        onStepFinish: async () => {
          events.push('user-onStepFinish');
        },
        onFinish: async () => {
          events.push('user-onFinish');
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

      expect(events).toEqual([
        'user-onStart',
        'integration-onStart',
        'user-onStepFinish',
        'integration-onStepEnd',
        'user-onFinish',
        'integration-onEnd',
      ]);
    });

    it('should not break generation when an integration listener throws', async () => {
      const result = await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
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

      expect(result.text).toBe('Hello!');
    });

    it('should support multiple per-call integrations as an array', async () => {
      const events: string[] = [];

      await generateText({
        model: new MockLanguageModelV4({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello!' }],
            ...dummyResponseValues,
          }),
        }),
        prompt: 'test-input',
        telemetry: {
          integrations: [
            {
              onStart: async () => {
                events.push('first');
              },
            },
            {
              onStart: async () => {
                events.push('second');
              },
            },
          ],
        },
      });

      expect(events).toEqual(['first', 'second']);
    });
  });
});
