import type * as AnthropicInternal from '@ai-sdk/anthropic/internal';
import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { AmazonBedrockChatLanguageModel } from './amazon-bedrock-chat-language-model';
import { beforeEach, describe, expect, vi, it } from 'vitest';
import { injectFetchHeaders } from './inject-fetch-headers';
import { anthropicTools, prepareTools } from '@ai-sdk/anthropic/internal';
import { z } from 'zod/v4';
import fs from 'node:fs';

const mockPrepareAnthropicTools = vi.mocked(prepareTools);

vi.mock('@ai-sdk/anthropic/internal', async importOriginal => {
  const original = await importOriginal<typeof AnthropicInternal>();
  return {
    ...original,
    prepareTools: vi.fn(),
    anthropicTools: {
      ...original.anthropicTools,
      bash_20241022: (args: any) => ({
        type: 'provider',
        id: 'anthropic.bash_20241022',
        name: 'bash',
        args,
        inputSchema: z.object({
          command: z.string(),
          restart: z.boolean().optional(),
        }),
      }),
    },
  };
});

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'system', content: 'System Prompt' },
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const mockTrace = {
  guardrail: {
    inputAssessment: {
      '1abcd2ef34gh': {
        contentPolicy: {
          filters: [
            {
              action: 'BLOCKED' as const,
              confidence: 'LOW' as const,
              type: 'INSULTS' as const,
            },
          ],
        },
        wordPolicy: {
          managedWordLists: [
            {
              action: 'BLOCKED' as const,
              match: '<rude word>',
              type: 'PROFANITY' as const,
            },
          ],
        },
      },
    },
  },
};

const fakeFetchWithAuth = injectFetchHeaders({ 'x-amz-auth': 'test-auth' });

const modelId = 'anthropic.claude-3-haiku-20240307-v1:0';
const anthropicModelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0'; // Define at top level
const baseUrl = 'https://bedrock-runtime.us-east-1.amazonaws.com';

const streamUrl = `${baseUrl}/model/${encodeURIComponent(
  modelId,
)}/converse-stream`;
const generateUrl = `${baseUrl}/model/${encodeURIComponent(modelId)}/converse`;
const anthropicGenerateUrl = `${baseUrl}/model/${encodeURIComponent(
  anthropicModelId,
)}/converse`;

const novaModelId = 'us.amazon.nova-2-lite-v1:0';
const novaGenerateUrl = `${baseUrl}/model/${encodeURIComponent(
  novaModelId,
)}/converse`;

const openaiModelId = 'openai.gpt-oss-120b-1:0';
const openaiGenerateUrl = `${baseUrl}/model/${encodeURIComponent(
  openaiModelId,
)}/converse`;

const newerAnthropicModelId = 'anthropic.claude-sonnet-4-6-v1';
const newerAnthropicGenerateUrl = `${baseUrl}/model/${encodeURIComponent(
  newerAnthropicModelId,
)}/converse`;

const server = createTestServer({
  [generateUrl]: {},
  [streamUrl]: {
    response: {
      type: 'stream-chunks',
      chunks: [],
    },
  },
  // Configure the server for the Anthropic model from the start
  [anthropicGenerateUrl]: {},
  [novaGenerateUrl]: {},
  [openaiGenerateUrl]: {},
  [newerAnthropicGenerateUrl]: {},
});

function prepareJsonFixtureResponse(
  filename: string,
  { headers }: { headers?: Record<string, string> } = {},
) {
  server.urls[generateUrl].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

function prepareChunksFixtureResponse(
  filename: string,
  { headers }: { headers?: Record<string, string> } = {},
) {
  const chunks = fs
    .readFileSync(`src/__fixtures__/${filename}.chunks.txt`, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => line + '\n');

  server.urls[streamUrl].response = {
    type: 'stream-chunks',
    headers,
    chunks,
  };
}

beforeEach(() => {
  // Reset stream chunks for the default model
  server.urls[streamUrl].response = {
    type: 'stream-chunks',
    chunks: [],
  };
  // Reset the response for the anthropic model to a default empty state
  server.urls[anthropicGenerateUrl].response = {
    type: 'json-value',
    body: {},
  };
  mockPrepareAnthropicTools.mockClear();
});

const model = new AmazonBedrockChatLanguageModel(modelId, {
  baseUrl: () => baseUrl,
  headers: {},
  fetch: fakeFetchWithAuth,
  generateId: () => 'test-id',
});

const novaModel = new AmazonBedrockChatLanguageModel(novaModelId, {
  baseUrl: () => baseUrl,
  headers: {},
  fetch: fakeFetchWithAuth,
  generateId: () => 'test-id',
});

const openaiModel = new AmazonBedrockChatLanguageModel(openaiModelId, {
  baseUrl: () => baseUrl,
  headers: {},
  fetch: fakeFetchWithAuth,
  generateId: () => 'test-id',
});

const newerAnthropicModel = new AmazonBedrockChatLanguageModel(
  newerAnthropicModelId,
  {
    baseUrl: () => baseUrl,
    headers: {},
    fetch: fakeFetchWithAuth,
    generateId: () => 'test-id',
  },
);

let mockOptions: { success: boolean; errorValue?: any } = { success: true };

describe('doStream', () => {
  beforeEach(() => {
    mockOptions = { success: true, errorValue: undefined };
  });

  vi.mock('./amazon-bedrock-event-stream-response-handler', () => ({
    createAmazonBedrockEventStreamResponseHandler: (schema: any) => {
      return async ({ response }: { response: Response }) => {
        let chunks: { success: boolean; value: any }[] = [];
        if (mockOptions.success) {
          const text = await response.text();
          chunks = text
            .split('\n')
            .filter(Boolean)
            .map(chunk => {
              const parsedChunk = JSON.parse(chunk);
              return {
                success: true,
                value: parsedChunk,
                rawValue: parsedChunk,
              };
            });
        }
        const headers = Object.fromEntries<string>([...response.headers]);

        return {
          responseHeaders: headers,
          value: new ReadableStream({
            start(controller) {
              if (mockOptions.success) {
                chunks.forEach(chunk => controller.enqueue(chunk));
              } else {
                controller.enqueue({
                  success: false,
                  error: mockOptions.errorValue,
                });
              }
              controller.close();
            },
          }),
        };
      };
    },
  }));

  function setupMockEventStreamHandler(
    options: { success?: boolean; errorValue?: any } = { success: true },
  ) {
    mockOptions = { ...mockOptions, ...options };
  }

  describe('text', () => {
    beforeEach(() => {
      setupMockEventStreamHandler();
      prepareChunksFixtureResponse('amazon-bedrock-text');
    });

    it('should stream text deltas', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });

    it('should expose the raw response headers', async () => {
      prepareChunksFixtureResponse('amazon-bedrock-text', {
        headers: { 'test-header': 'test-value' },
      });

      const result = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(result.response?.headers).toMatchInlineSnapshot(`
        {
          "cache-control": "no-cache",
          "connection": "keep-alive",
          "content-type": "text/event-stream",
          "test-header": "test-value",
        }
      `);
    });
  });

  describe('reasoning', () => {
    beforeEach(() => {
      setupMockEventStreamHandler();
      prepareChunksFixtureResponse('amazon-bedrock-reasoning');
    });

    it('should stream reasoning and text parts', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  it('should stream text deltas with metadata and usage', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 1,
            delta: { text: ', ' },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 2,
            delta: { text: 'World!' },
          },
        }) + '\n',
        JSON.stringify({
          metadata: {
            usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
            metrics: { latencyMs: 10 },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Hello",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "1",
          "type": "text-start",
        },
        {
          "delta": ", ",
          "id": "1",
          "type": "text-delta",
        },
        {
          "id": "2",
          "type": "text-start",
        },
        {
          "delta": "World!",
          "id": "2",
          "type": "text-delta",
        },
        {
          "finishReason": {
            "raw": "stop_sequence",
            "unified": "stop",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": 0,
              "noCache": 4,
              "total": 4,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 34,
              "total": 34,
            },
            "raw": {
              "inputTokens": 4,
              "outputTokens": 34,
              "totalTokens": 38,
            },
          },
        },
      ]
    `);
  });

  it('should stream tool deltas', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockStart: {
            contentBlockIndex: 0,
            start: {
              toolUse: { toolUseId: 'tool-use-id', name: 'test-tool' },
            },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { toolUse: { input: '{"value":' } },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { toolUse: { input: '"Sparkle Day"}' } },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockStop: { contentBlockIndex: 0 },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'tool_use',
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'test-tool',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      toolChoice: { type: 'tool', toolName: 'test-tool' },
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "tool-use-id",
          "toolName": "test-tool",
          "type": "tool-input-start",
        },
        {
          "delta": "{"value":",
          "id": "tool-use-id",
          "type": "tool-input-delta",
        },
        {
          "delta": ""Sparkle Day"}",
          "id": "tool-use-id",
          "type": "tool-input-delta",
        },
        {
          "id": "tool-use-id",
          "type": "tool-input-end",
        },
        {
          "input": "{"value":"Sparkle Day"}",
          "toolCallId": "tool-use-id",
          "toolName": "test-tool",
          "type": "tool-call",
        },
        {
          "finishReason": {
            "raw": "tool_use",
            "unified": "tool-calls",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should stream parallel tool calls', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockStart: {
            contentBlockIndex: 0,
            start: {
              toolUse: { toolUseId: 'tool-use-id-1', name: 'test-tool-1' },
            },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { toolUse: { input: '{"value1":' } },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockStart: {
            contentBlockIndex: 1,
            start: {
              toolUse: { toolUseId: 'tool-use-id-2', name: 'test-tool-2' },
            },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 1,
            delta: { toolUse: { input: '{"value2":' } },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 1,
            delta: { toolUse: { input: '"Sparkle Day"}' } },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { toolUse: { input: '"Sparkle Day"}' } },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockStop: { contentBlockIndex: 0 },
        }) + '\n',
        JSON.stringify({
          contentBlockStop: { contentBlockIndex: 1 },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'tool_use',
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'test-tool-1',
          inputSchema: {
            type: 'object',
            properties: { value1: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
        {
          type: 'function',
          name: 'test-tool-2',
          inputSchema: {
            type: 'object',
            properties: { value2: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      toolChoice: { type: 'tool', toolName: 'test-tool' },
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "tool-use-id-1",
          "toolName": "test-tool-1",
          "type": "tool-input-start",
        },
        {
          "delta": "{"value1":",
          "id": "tool-use-id-1",
          "type": "tool-input-delta",
        },
        {
          "id": "tool-use-id-2",
          "toolName": "test-tool-2",
          "type": "tool-input-start",
        },
        {
          "delta": "{"value2":",
          "id": "tool-use-id-2",
          "type": "tool-input-delta",
        },
        {
          "delta": ""Sparkle Day"}",
          "id": "tool-use-id-2",
          "type": "tool-input-delta",
        },
        {
          "delta": ""Sparkle Day"}",
          "id": "tool-use-id-1",
          "type": "tool-input-delta",
        },
        {
          "id": "tool-use-id-1",
          "type": "tool-input-end",
        },
        {
          "input": "{"value1":"Sparkle Day"}",
          "toolCallId": "tool-use-id-1",
          "toolName": "test-tool-1",
          "type": "tool-call",
        },
        {
          "id": "tool-use-id-2",
          "type": "tool-input-end",
        },
        {
          "input": "{"value2":"Sparkle Day"}",
          "toolCallId": "tool-use-id-2",
          "toolName": "test-tool-2",
          "type": "tool-call",
        },
        {
          "finishReason": {
            "raw": "tool_use",
            "unified": "tool-calls",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should handle error stream parts', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          internalServerException: {
            message: 'Internal Server Error',
            name: 'InternalServerException',
            $fault: 'server',
            $metadata: {},
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "error": {
            "$fault": "server",
            "$metadata": {},
            "message": "Internal Server Error",
            "name": "InternalServerException",
          },
          "type": "error",
        },
        {
          "finishReason": {
            "raw": undefined,
            "unified": "error",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should handle modelStreamErrorException error', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          modelStreamErrorException: {
            message: 'Model Stream Error',
            name: 'ModelStreamErrorException',
            $fault: 'server',
            $metadata: {},
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "error": {
            "$fault": "server",
            "$metadata": {},
            "message": "Model Stream Error",
            "name": "ModelStreamErrorException",
          },
          "type": "error",
        },
        {
          "finishReason": {
            "raw": undefined,
            "unified": "error",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should handle throttlingException error', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          throttlingException: {
            message: 'Throttling Error',
            name: 'ThrottlingException',
            $fault: 'server',
            $metadata: {},
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "error": {
            "$fault": "server",
            "$metadata": {},
            "message": "Throttling Error",
            "name": "ThrottlingException",
          },
          "type": "error",
        },
        {
          "finishReason": {
            "raw": undefined,
            "unified": "error",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should handle validationException error', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          validationException: {
            message: 'Validation Error',
            name: 'ValidationException',
            $fault: 'server',
            $metadata: {},
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "error": {
            "$fault": "server",
            "$metadata": {},
            "message": "Validation Error",
            "name": "ValidationException",
          },
          "type": "error",
        },
        {
          "finishReason": {
            "raw": undefined,
            "unified": "error",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should handle failed chunk parsing', async () => {
    setupMockEventStreamHandler({
      success: false,
      errorValue: { message: 'Chunk Parsing Failed' },
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "error": {
            "message": "Chunk Parsing Failed",
          },
          "type": "error",
        },
        {
          "finishReason": {
            "raw": undefined,
            "unified": "error",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should pass the messages and the model', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [],
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "additionalModelResponseFieldPaths": [
          "/delta/stop_sequence",
        ],
        "messages": [
          {
            "content": [
              {
                "text": "Hello",
              },
            ],
            "role": "user",
          },
        ],
        "system": [
          {
            "text": "System Prompt",
          },
        ],
      }
    `);
  });

  it('should support guardrails', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [],
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: {
        bedrock: {
          guardrailConfig: {
            guardrailIdentifier: '-1',
            guardrailVersion: '1',
            trace: 'enabled',
            streamProcessingMode: 'async',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      messages: [{ role: 'user', content: [{ text: 'Hello' }] }],
      system: [{ text: 'System Prompt' }],
      guardrailConfig: {
        guardrailIdentifier: '-1',
        guardrailVersion: '1',
        trace: 'enabled',
        streamProcessingMode: 'async',
      },
    });
  });

  it('should accept the new `amazonBedrock` providerOptions key', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [],
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: {
        amazonBedrock: {
          guardrailConfig: {
            guardrailIdentifier: '-1',
            guardrailVersion: '1',
            trace: 'enabled',
            streamProcessingMode: 'async',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      guardrailConfig: {
        guardrailIdentifier: '-1',
        guardrailVersion: '1',
        trace: 'enabled',
        streamProcessingMode: 'async',
      },
    });
  });

  it('should prefer `amazonBedrock` providerOptions over the legacy `bedrock` key', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [],
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: {
        bedrock: {
          guardrailConfig: {
            guardrailIdentifier: 'legacy',
            guardrailVersion: '1',
          },
        },
        amazonBedrock: {
          guardrailConfig: {
            guardrailIdentifier: 'preferred',
            guardrailVersion: '2',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      guardrailConfig: {
        guardrailIdentifier: 'preferred',
        guardrailVersion: '2',
      },
    });
  });

  it('should include trace information in providerMetadata', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          metadata: {
            usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
            metrics: { latencyMs: 10 },
            trace: mockTrace,
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Hello",
          "id": "0",
          "type": "text-delta",
        },
        {
          "finishReason": {
            "raw": "stop_sequence",
            "unified": "stop",
          },
          "providerMetadata": {
            "amazonBedrock": {
              "trace": {
                "guardrail": {
                  "inputAssessment": {
                    "1abcd2ef34gh": {
                      "contentPolicy": {
                        "filters": [
                          {
                            "action": "BLOCKED",
                            "confidence": "LOW",
                            "type": "INSULTS",
                          },
                        ],
                      },
                      "wordPolicy": {
                        "managedWordLists": [
                          {
                            "action": "BLOCKED",
                            "match": "<rude word>",
                            "type": "PROFANITY",
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "bedrock": {
              "trace": {
                "guardrail": {
                  "inputAssessment": {
                    "1abcd2ef34gh": {
                      "contentPolicy": {
                        "filters": [
                          {
                            "action": "BLOCKED",
                            "confidence": "LOW",
                            "type": "INSULTS",
                          },
                        ],
                      },
                      "wordPolicy": {
                        "managedWordLists": [
                          {
                            "action": "BLOCKED",
                            "match": "<rude word>",
                            "type": "PROFANITY",
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": 0,
              "noCache": 4,
              "total": 4,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 34,
              "total": 34,
            },
            "raw": {
              "inputTokens": 4,
              "outputTokens": 34,
              "totalTokens": 38,
            },
          },
        },
      ]
    `);
  });

  it('should include stop_sequence in provider metadata', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          metadata: {
            usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
            additionalModelResponseFields: { delta: { stop_sequence: 'STOP' } },
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      stopSequences: ['STOP'],
    });

    const chunks = await convertReadableStreamToArray(stream);

    expect(chunks.filter(chunk => chunk.type === 'finish'))
      .toMatchInlineSnapshot(`
        [
          {
            "finishReason": {
              "raw": "stop_sequence",
              "unified": "stop",
            },
            "providerMetadata": {
              "amazonBedrock": {
                "stopSequence": "STOP",
              },
              "bedrock": {
                "stopSequence": "STOP",
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": 0,
                "noCache": 4,
                "total": 4,
              },
              "outputTokens": {
                "reasoning": undefined,
                "text": 34,
                "total": 34,
              },
              "raw": {
                "inputTokens": 4,
                "outputTokens": 34,
                "totalTokens": 38,
              },
            },
          },
        ]
      `);
  });

  it('should correctly parse delta.stop_sequence structure in streaming with additional fields', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Response' },
          },
        }) + '\n',
        JSON.stringify({
          metadata: {
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
            additionalModelResponseFields: {
              delta: {
                stop_sequence: 'CUSTOM_END',
              },
              // Additional fields that might be present
              otherField: 'value',
            },
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      stopSequences: ['CUSTOM_END'],
    });

    const chunks = await convertReadableStreamToArray(stream);
    const finishChunk = chunks.find(chunk => chunk.type === 'finish');

    expect(finishChunk?.providerMetadata?.bedrock?.stopSequence).toBe(
      'CUSTOM_END',
    );
    expect(finishChunk?.finishReason).toEqual({
      unified: 'stop',
      raw: 'stop_sequence',
    });
  });

  it('should include response headers in rawResponse', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      headers: {
        'x-amzn-requestid': 'test-request-id',
        'x-amzn-trace-id': 'test-trace-id',
      },
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    const result = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(result.response?.headers).toEqual({
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'content-type': 'text/event-stream',
      'x-amzn-requestid': 'test-request-id',
      'x-amzn-trace-id': 'test-trace-id',
    });
  });

  it('should extract response metadata', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      headers: {
        'x-amzn-requestid': 'test-request-id',
        date: 'Wed, 01 Jan 2025 00:00:00 GMT',
      },
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'end_turn',
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const parts = await convertReadableStreamToArray(stream);
    const metadata = parts.find(p => p.type === 'response-metadata');

    expect(metadata).toMatchInlineSnapshot(`
      {
        "id": "test-request-id",
        "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
        "timestamp": 2025-01-01T00:00:00.000Z,
        "type": "response-metadata",
      }
    `);
  });

  it('should properly combine headers from all sources', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      headers: {
        'x-amzn-requestid': 'test-request-id',
        'x-amzn-trace-id': 'test-trace-id',
      },
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    const optionsHeaders = {
      'options-header': 'options-value',
      'shared-header': 'options-shared',
    };

    const model = new AmazonBedrockChatLanguageModel(modelId, {
      baseUrl: () => baseUrl,
      headers: {
        'model-header': 'model-value',
        'shared-header': 'model-shared',
      },
      fetch: injectFetchHeaders({
        'options-header': 'options-value',
        'model-header': 'model-value',
        'shared-header': 'options-shared',
        'signed-header': 'signed-value',
        authorization: 'AWS4-HMAC-SHA256...',
      }),
      generateId: () => 'test-id',
    });

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      headers: optionsHeaders,
    });

    const requestHeaders = server.calls[0].requestHeaders;
    expect(requestHeaders['options-header']).toBe('options-value');
    expect(requestHeaders['model-header']).toBe('model-value');
    expect(requestHeaders['signed-header']).toBe('signed-value');
    expect(requestHeaders['authorization']).toBe('AWS4-HMAC-SHA256...');
    expect(requestHeaders['shared-header']).toBe('options-shared');
  });

  it('should work with partial headers', async () => {
    setupMockEventStreamHandler();
    const model = new AmazonBedrockChatLanguageModel(modelId, {
      baseUrl: () => baseUrl,
      headers: {
        'model-header': 'model-value',
      },
      fetch: injectFetchHeaders({
        'model-header': 'model-value',
        'signed-header': 'signed-value',
        authorization: 'AWS4-HMAC-SHA256...',
      }),
      generateId: () => 'test-id',
    });

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const requestHeaders = server.calls[0].requestHeaders;
    expect(requestHeaders['model-header']).toBe('model-value');
    expect(requestHeaders['signed-header']).toBe('signed-value');
    expect(requestHeaders['authorization']).toBe('AWS4-HMAC-SHA256...');
  });

  it('should include providerOptions in the request for streaming calls', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Dummy' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: { stopReason: 'stop_sequence' },
        }) + '\n',
      ],
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: {
        bedrock: {
          foo: 'bar',
        },
      },
    });

    // Verify the outgoing request body includes "foo" at the top level.
    const body = await server.calls[0].requestBodyJson;
    expect(body).toMatchObject({ foo: 'bar' });
  });

  it('should include cache token usage in providerMetadata', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          metadata: {
            usage: {
              inputTokens: 4,
              outputTokens: 34,
              totalTokens: 38,
              cacheReadInputTokens: 2,
              cacheWriteInputTokens: 3,
            },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Hello",
          "id": "0",
          "type": "text-delta",
        },
        {
          "finishReason": {
            "raw": "stop_sequence",
            "unified": "stop",
          },
          "providerMetadata": {
            "amazonBedrock": {
              "usage": {
                "cacheWriteInputTokens": 3,
              },
            },
            "bedrock": {
              "usage": {
                "cacheWriteInputTokens": 3,
              },
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 2,
              "cacheWrite": 3,
              "noCache": 4,
              "total": 9,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 34,
              "total": 34,
            },
            "raw": {
              "cacheReadInputTokens": 2,
              "cacheWriteInputTokens": 3,
              "inputTokens": 4,
              "outputTokens": 34,
              "totalTokens": 38,
            },
          },
        },
      ]
    `);
  });

  it('should include performanceConfig in providerMetadata', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          metadata: {
            usage: {
              inputTokens: 4,
              outputTokens: 34,
            },
            performanceConfig: { latency: 'optimized' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: { stopReason: 'end_turn' },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const parts = await convertReadableStreamToArray(stream);
    const finish = parts.find(p => p.type === 'finish');
    expect(finish?.providerMetadata).toMatchInlineSnapshot(`
      {
        "amazonBedrock": {
          "performanceConfig": {
            "latency": "optimized",
          },
        },
        "bedrock": {
          "performanceConfig": {
            "latency": "optimized",
          },
        },
      }
    `);
  });

  it('should include serviceTier in providerMetadata', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          metadata: {
            usage: {
              inputTokens: 4,
              outputTokens: 34,
            },
            serviceTier: { type: 'on-demand' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: { stopReason: 'end_turn' },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const parts = await convertReadableStreamToArray(stream);
    const finish = parts.find(p => p.type === 'finish');
    expect(finish?.providerMetadata).toMatchInlineSnapshot(`
      {
        "amazonBedrock": {
          "serviceTier": {
            "type": "on-demand",
          },
        },
        "bedrock": {
          "serviceTier": {
            "type": "on-demand",
          },
        },
      }
    `);
  });

  it('should include cacheDetails in providerMetadata', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          metadata: {
            usage: {
              inputTokens: 4,
              outputTokens: 34,
              cacheDetails: [{ inputTokens: 100, ttl: 'T5M' }],
            },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: { stopReason: 'end_turn' },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const parts = await convertReadableStreamToArray(stream);
    const finish = parts.find(p => p.type === 'finish');
    expect(finish?.providerMetadata).toMatchInlineSnapshot(`
      {
        "amazonBedrock": {
          "usage": {
            "cacheDetails": [
              {
                "inputTokens": 100,
                "ttl": "T5M",
              },
            ],
          },
        },
        "bedrock": {
          "usage": {
            "cacheDetails": [
              {
                "inputTokens": 100,
                "ttl": "T5M",
              },
            ],
          },
        },
      }
    `);
  });

  it('should handle system messages with cache points', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    await model.doStream({
      prompt: [
        {
          role: 'system',
          content: 'System Prompt',
          providerOptions: { bedrock: { cachePoint: { type: 'default' } } },
        },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
      includeRawChunks: false,
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      system: [{ text: 'System Prompt' }, { cachePoint: { type: 'default' } }],
      messages: [{ role: 'user', content: [{ text: 'Hello' }] }],
    });
  });

  it('should stream reasoning text deltas', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: {
              reasoningContent: { text: 'I am thinking' },
            },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: {
              reasoningContent: { text: ' about this problem...' },
            },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: {
              reasoningContent: { signature: 'abc123signature' },
            },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 1,
            delta: { text: 'Based on my reasoning, the answer is 42.' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "reasoning-start",
        },
        {
          "delta": "I am thinking",
          "id": "0",
          "type": "reasoning-delta",
        },
        {
          "delta": " about this problem...",
          "id": "0",
          "type": "reasoning-delta",
        },
        {
          "delta": "",
          "id": "0",
          "providerMetadata": {
            "amazonBedrock": {
              "signature": "abc123signature",
            },
            "bedrock": {
              "signature": "abc123signature",
            },
          },
          "type": "reasoning-delta",
        },
        {
          "id": "1",
          "type": "text-start",
        },
        {
          "delta": "Based on my reasoning, the answer is 42.",
          "id": "1",
          "type": "text-delta",
        },
        {
          "finishReason": {
            "raw": "stop_sequence",
            "unified": "stop",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should stream redacted reasoning', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: {
              reasoningContent: { data: 'redacted-reasoning-data' },
            },
          },
        }) + '\n',
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 1,
            delta: { text: 'Here is my answer.' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "reasoning-start",
        },
        {
          "delta": "",
          "id": "0",
          "providerMetadata": {
            "amazonBedrock": {
              "redactedData": "redacted-reasoning-data",
            },
            "bedrock": {
              "redactedData": "redacted-reasoning-data",
            },
          },
          "type": "reasoning-delta",
        },
        {
          "id": "1",
          "type": "text-start",
        },
        {
          "delta": "Here is my answer.",
          "id": "1",
          "type": "text-delta",
        },
        {
          "finishReason": {
            "raw": "stop_sequence",
            "unified": "stop",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should include raw chunks when includeRawChunks is true', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: true,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "rawValue": {
            "contentBlockDelta": {
              "contentBlockIndex": 0,
              "delta": {
                "text": "Hello",
              },
            },
          },
          "type": "raw",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Hello",
          "id": "0",
          "type": "text-delta",
        },
        {
          "rawValue": {
            "messageStop": {
              "stopReason": "stop_sequence",
            },
          },
          "type": "raw",
        },
        {
          "finishReason": {
            "raw": "stop_sequence",
            "unified": "stop",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should transform reasoningConfig to thinking in stream requests', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: 'Hello' },
          },
        }) + '\n',
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      maxOutputTokens: 100,
      includeRawChunks: false,
      providerOptions: {
        bedrock: {
          reasoningConfig: {
            type: 'enabled',
            budgetTokens: 2000,
          },
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    // Should contain thinking in additionalModelRequestFields
    expect(requestBody).toMatchObject({
      additionalModelRequestFields: {
        thinking: {
          type: 'enabled',
          budget_tokens: 2000,
        },
      },
      inferenceConfig: {
        maxTokens: 2100,
      },
    });

    // Should NOT contain reasoningConfig at the top level
    expect(requestBody).not.toHaveProperty('reasoningConfig');
  });

  it('merges user additionalModelRequestFields with derived thinking (stream)', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: {
        bedrock: {
          reasoningConfig: { type: 'enabled', budgetTokens: 500 },
          additionalModelRequestFields: { foo: 'bar', custom: 42 },
        },
      },
    });

    const body = await server.calls[0].requestBodyJson;
    expect(body).not.toHaveProperty('reasoningConfig');
    expect(body.additionalModelRequestFields).toMatchObject({
      foo: 'bar',
      custom: 42,
      thinking: { type: 'enabled', budget_tokens: 500 },
    });
  });

  it('should pass serviceTier provider option in stream requests', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: {
        bedrock: {
          serviceTier: 'priority',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody).toMatchObject({
      serviceTier: {
        type: 'priority',
      },
    });
    expect(
      requestBody.additionalModelRequestFields?.serviceTier,
    ).toBeUndefined();
  });

  it('should handle JSON response format in streaming', async () => {
    setupMockEventStreamHandler();
    prepareChunksFixtureResponse('amazon-bedrock-json-tool.1');

    const { stream } = await model.doStream({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Generate JSON' }] },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value'],
        },
      },
      includeRawChunks: false,
    });

    expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "{"value":"test"}",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "0",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "tool_use",
            "unified": "stop",
          },
          "providerMetadata": {
            "amazonBedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
            "bedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should include text content before JSON tool call in streaming', async () => {
    setupMockEventStreamHandler();
    prepareChunksFixtureResponse('amazon-bedrock-json-tool.2');

    const { stream } = await model.doStream({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Generate JSON' }] },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value'],
        },
      },
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    // Text before JSON tool call should be streamed normally
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Let me generate",
          "id": "0",
          "type": "text-delta",
        },
        {
          "delta": " that JSON for you.",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "1",
          "type": "text-start",
        },
        {
          "delta": "{"value":"test"}",
          "id": "1",
          "type": "text-delta",
        },
        {
          "id": "1",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "tool_use",
            "unified": "stop",
          },
          "providerMetadata": {
            "amazonBedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
            "bedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should stream text introduction before JSON-only response', async () => {
    setupMockEventStreamHandler();
    prepareChunksFixtureResponse('amazon-bedrock-json-only-text-first.1');

    const { stream } = await model.doStream({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Return name data' }] },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false,
          $schema: 'http://json-schema.org/draft-07/schema#',
        },
      },
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    // Should emit text events for "Here is your data:" followed by JSON output as text
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Here is your data:",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "0",
          "type": "text-end",
        },
        {
          "id": "1",
          "type": "text-start",
        },
        {
          "delta": "{"name":"John"}",
          "id": "1",
          "type": "text-delta",
        },
        {
          "id": "1",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "tool_use",
            "unified": "stop",
          },
          "providerMetadata": {
            "amazonBedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
            "bedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": 0,
              "noCache": 100,
              "total": 100,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 20,
              "total": 20,
            },
            "raw": {
              "inputTokens": 100,
              "outputTokens": 20,
              "totalTokens": 120,
            },
          },
        },
      ]
    `);
  });

  it('should include multiple text blocks before JSON tool call in streaming', async () => {
    setupMockEventStreamHandler();
    prepareChunksFixtureResponse('amazon-bedrock-json-tool.3');

    const { stream } = await model.doStream({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Generate data' }] },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { result: { type: 'number' } },
          required: ['result'],
        },
      },
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    // All text blocks before the JSON tool call should be streamed
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "First text block.",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "1",
          "type": "text-start",
        },
        {
          "delta": "Second text block.",
          "id": "1",
          "type": "text-delta",
        },
        {
          "id": "2",
          "type": "text-start",
        },
        {
          "delta": "Third block.",
          "id": "2",
          "type": "text-delta",
        },
        {
          "id": "3",
          "type": "text-start",
        },
        {
          "delta": "{"result":42}",
          "id": "3",
          "type": "text-delta",
        },
        {
          "id": "3",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "tool_use",
            "unified": "stop",
          },
          "providerMetadata": {
            "amazonBedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
            "bedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should handle regular tool call before JSON tool call in streaming', async () => {
    setupMockEventStreamHandler();
    prepareChunksFixtureResponse('amazon-bedrock-json-with-tool.1');

    const { stream } = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      tools: [
        {
          type: 'function',
          name: 'get-weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
          },
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { result: { type: 'string' } },
          required: ['result'],
        },
      },
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    // Should include text, regular tool, text, then JSON as text
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Calling a tool first.",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "tool-1",
          "toolName": "get-weather",
          "type": "tool-input-start",
        },
        {
          "delta": "{"location":"SF"}",
          "id": "tool-1",
          "type": "tool-input-delta",
        },
        {
          "id": "tool-1",
          "type": "tool-input-end",
        },
        {
          "input": "{"location":"SF"}",
          "toolCallId": "tool-1",
          "toolName": "get-weather",
          "type": "tool-call",
        },
        {
          "id": "2",
          "type": "text-start",
        },
        {
          "delta": "Now JSON.",
          "id": "2",
          "type": "text-delta",
        },
        {
          "id": "3",
          "type": "text-start",
        },
        {
          "delta": "{"result":"data"}",
          "id": "3",
          "type": "text-delta",
        },
        {
          "id": "3",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "tool_use",
            "unified": "stop",
          },
          "providerMetadata": {
            "amazonBedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
            "bedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should handle multiple regular tool calls before JSON tool call in streaming', async () => {
    setupMockEventStreamHandler();
    prepareChunksFixtureResponse('amazon-bedrock-json-with-tools.1');

    const { stream } = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      tools: [
        {
          type: 'function',
          name: 'tool-a',
          inputSchema: {
            type: 'object',
            properties: { a: { type: 'string' } },
          },
        },
        {
          type: 'function',
          name: 'tool-b',
          inputSchema: {
            type: 'object',
            properties: { b: { type: 'string' } },
          },
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { final: { type: 'string' } },
          required: ['final'],
        },
      },
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    // Should preserve all content in order
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "Multiple tools.",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "tool-1",
          "toolName": "tool-a",
          "type": "tool-input-start",
        },
        {
          "delta": "{"a":"1"}",
          "id": "tool-1",
          "type": "tool-input-delta",
        },
        {
          "id": "tool-1",
          "type": "tool-input-end",
        },
        {
          "input": "{"a":"1"}",
          "toolCallId": "tool-1",
          "toolName": "tool-a",
          "type": "tool-call",
        },
        {
          "id": "tool-2",
          "toolName": "tool-b",
          "type": "tool-input-start",
        },
        {
          "delta": "{"b":"2"}",
          "id": "tool-2",
          "type": "tool-input-delta",
        },
        {
          "id": "tool-2",
          "type": "tool-input-end",
        },
        {
          "input": "{"b":"2"}",
          "toolCallId": "tool-2",
          "toolName": "tool-b",
          "type": "tool-call",
        },
        {
          "id": "3",
          "type": "text-start",
        },
        {
          "delta": "Final JSON.",
          "id": "3",
          "type": "text-delta",
        },
        {
          "id": "4",
          "type": "text-start",
        },
        {
          "delta": "{"final":"result"}",
          "id": "4",
          "type": "text-delta",
        },
        {
          "id": "4",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "tool_use",
            "unified": "stop",
          },
          "providerMetadata": {
            "amazonBedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
            "bedrock": {
              "isJsonResponseFromTool": true,
              "stopSequence": null,
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": undefined,
              "cacheWrite": undefined,
              "noCache": undefined,
              "total": undefined,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": undefined,
              "total": undefined,
            },
            "raw": undefined,
          },
        },
      ]
    `);
  });

  it('should stream text, then regular tool calls, with JSON response format available', async () => {
    setupMockEventStreamHandler();
    prepareChunksFixtureResponse(
      'amazon-bedrock-json-tool-text-then-weather-then-json.1',
    );

    const { stream } = await model.doStream({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: "What's 2+2? Also check the weather in San Francisco and London.",
            },
          ],
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
          },
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            locations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  temperature: { type: 'number' },
                },
              },
            },
          },
        },
      },
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    // Should show: text answer, then tool calls (not JSON tool)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
          "type": "response-metadata",
        },
        {
          "id": "0",
          "type": "text-start",
        },
        {
          "delta": "2 + 2 equals 4. Now let me check",
          "id": "0",
          "type": "text-delta",
        },
        {
          "delta": " the weather for you.",
          "id": "0",
          "type": "text-delta",
        },
        {
          "id": "0",
          "type": "text-end",
        },
        {
          "id": "weather-tool-1",
          "toolName": "weather",
          "type": "tool-input-start",
        },
        {
          "delta": "{"location":",
          "id": "weather-tool-1",
          "type": "tool-input-delta",
        },
        {
          "delta": ""San Francisco"}",
          "id": "weather-tool-1",
          "type": "tool-input-delta",
        },
        {
          "id": "weather-tool-1",
          "type": "tool-input-end",
        },
        {
          "input": "{"location":"San Francisco"}",
          "toolCallId": "weather-tool-1",
          "toolName": "weather",
          "type": "tool-call",
        },
        {
          "id": "weather-tool-2",
          "toolName": "weather",
          "type": "tool-input-start",
        },
        {
          "delta": "{"location":"London"}",
          "id": "weather-tool-2",
          "type": "tool-input-delta",
        },
        {
          "id": "weather-tool-2",
          "type": "tool-input-end",
        },
        {
          "input": "{"location":"London"}",
          "toolCallId": "weather-tool-2",
          "toolName": "weather",
          "type": "tool-call",
        },
        {
          "finishReason": {
            "raw": "tool_use",
            "unified": "tool-calls",
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": 0,
              "noCache": 500,
              "total": 500,
            },
            "outputTokens": {
              "reasoning": undefined,
              "text": 100,
              "total": 100,
            },
            "raw": {
              "inputTokens": 500,
              "outputTokens": 100,
              "totalTokens": 600,
            },
          },
        },
      ]
    `);
  });

  it('should warn when Anthropic model receives maxReasoningEffort in stream', async () => {
    setupMockEventStreamHandler();
    server.urls[streamUrl].response = {
      type: 'stream-chunks',
      chunks: [
        JSON.stringify({
          messageStop: {
            stopReason: 'stop_sequence',
          },
        }) + '\n',
      ],
    };

    const result = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: {
        bedrock: {
          reasoningConfig: {
            type: 'enabled',
            maxReasoningEffort: 'medium',
          },
        },
      },
    });

    await convertReadableStreamToArray(result.stream);

    const requestBody = await server.calls[0].requestBodyJson;
    expect(
      requestBody.additionalModelRequestFields?.reasoningConfig,
    ).toBeUndefined();
  });

  it('should support tool calls with empty input (no arguments)', async () => {
    setupMockEventStreamHandler();
    prepareChunksFixtureResponse('amazon-bedrock-tool-no-args');

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'updateIssueList',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const result = await convertReadableStreamToArray(stream);

    const toolCallPart = result.find(part => part.type === 'tool-call');
    expect(toolCallPart).toBeDefined();
    expect(toolCallPart?.input).toBe('{}');
  });
});

describe('doGenerate', () => {
  describe('text', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('amazon-bedrock-text');
    });

    it('should extract text response', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });

    it('should extract usage', async () => {
      const { usage } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(usage).toMatchInlineSnapshot(`
        {
          "inputTokens": {
            "cacheRead": 0,
            "cacheWrite": 0,
            "noCache": 22,
            "total": 22,
          },
          "outputTokens": {
            "reasoning": undefined,
            "text": 57,
            "total": 57,
          },
          "raw": {
            "cacheReadInputTokens": 0,
            "cacheWriteInputTokens": 0,
            "inputTokens": 22,
            "outputTokens": 57,
            "totalTokens": 79,
          },
        }
      `);
    });

    it('should send additional response information', async () => {
      const { response } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect({
        id: response?.id,
        timestamp: response?.timestamp,
        modelId: response?.modelId,
      }).toMatchInlineSnapshot(`
        {
          "id": undefined,
          "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
          "timestamp": undefined,
        }
      `);
    });

    it('should expose the raw response headers', async () => {
      prepareJsonFixtureResponse('amazon-bedrock-text', {
        headers: { 'test-header': 'test-value' },
      });

      const { response } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(response?.headers).toMatchInlineSnapshot(`
        {
          "content-length": "435",
          "content-type": "application/json",
          "test-header": "test-value",
        }
      `);
    });
  });

  describe('reasoning', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('amazon-bedrock-reasoning');
    });

    it('should extract reasoning and text response', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  it('should extract finish reason', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello, World!' }],
          },
        },
        usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
        stopReason: 'stop_sequence',
      },
    };

    const { finishReason } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "stop_sequence",
        "unified": "stop",
      }
    `);
  });

  it('should support unknown finish reason', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello, World!' }],
          },
        },
        usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
        stopReason: 'eos',
      },
    };

    const { finishReason } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "eos",
        "unified": "other",
      }
    `);
  });

  it('should pass the model and the messages', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
      {
        "additionalModelResponseFieldPaths": [
          "/delta/stop_sequence",
        ],
        "messages": [
          {
            "content": [
              {
                "text": "Hello",
              },
            ],
            "role": "user",
          },
        ],
        "system": [
          {
            "text": "System Prompt",
          },
        ],
      }
    `);
  });

  it('should pass settings', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      maxOutputTokens: 100,
      temperature: 0.5,
      topP: 0.5,
      topK: 1,
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      inferenceConfig: {
        maxTokens: 100,
        temperature: 0.5,
        topP: 0.5,
        topK: 1,
      },
    });
  });

  it('should support guardrails', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        bedrock: {
          guardrailConfig: {
            guardrailIdentifier: '-1',
            guardrailVersion: '1',
            trace: 'enabled',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      guardrailConfig: {
        guardrailIdentifier: '-1',
        guardrailVersion: '1',
        trace: 'enabled',
      },
    });
  });

  it('should include trace information in providerMetadata', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello, World!' }],
          },
        },
        usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
        stopReason: 'stop_sequence',
        trace: mockTrace,
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.providerMetadata?.bedrock.trace).toMatchObject(mockTrace);
  });

  it('should include stop_sequence in provider metadata', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Hello, World!' }],
          },
        },
        stopReason: 'stop_sequence',
        additionalModelResponseFields: { delta: { stop_sequence: 'STOP' } },
        usage: {
          inputTokens: 4,
          outputTokens: 30,
          totalTokens: 34,
        },
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      stopSequences: ['STOP'],
    });

    expect(result.providerMetadata).toMatchInlineSnapshot(`
      {
        "amazonBedrock": {
          "stopSequence": "STOP",
        },
        "bedrock": {
          "stopSequence": "STOP",
        },
      }
    `);
  });

  // https://github.com/vercel/ai/issues/11371
  it('should handle stop_sequence: null when stopReason is tool_use', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              { text: "I'll query your Salesforce..." },
              {
                toolUse: {
                  toolUseId: 'tool-use-id',
                  name: 'querySalesforce',
                  input: { query: 'SELECT Id FROM Account' },
                },
              },
            ],
          },
        },
        stopReason: 'tool_use',
        additionalModelResponseFields: { delta: { stop_sequence: null } },
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'function',
          name: 'querySalesforce',
          description: 'Query Salesforce',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
            additionalProperties: false,
          },
        },
      ],
    });

    expect(result.finishReason).toEqual({
      unified: 'tool-calls',
      raw: 'tool_use',
    });
    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "I'll query your Salesforce...",
          "type": "text",
        },
        {
          "input": "{"query":"SELECT Id FROM Account"}",
          "toolCallId": "tool-use-id",
          "toolName": "querySalesforce",
          "type": "tool-call",
        },
      ]
    `);
    expect(result.providerMetadata).toMatchInlineSnapshot(`
      {
        "amazonBedrock": {
          "stopSequence": null,
        },
        "bedrock": {
          "stopSequence": null,
        },
      }
    `);
  });

  it('should correctly parse delta.stop_sequence structure from additionalModelResponseFields', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Response text' }],
          },
        },
        stopReason: 'stop_sequence',
        additionalModelResponseFields: {
          delta: {
            stop_sequence: 'CUSTOM_STOP',
          },
          // Additional fields that might be present
          otherField: 'value',
        },
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      stopSequences: ['CUSTOM_STOP'],
    });

    expect(result.providerMetadata?.bedrock.stopSequence).toBe('CUSTOM_STOP');
    expect(result.finishReason).toEqual({
      unified: 'stop',
      raw: 'stop_sequence',
    });
  });

  it('should include response headers in rawResponse', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      headers: {
        'x-amzn-requestid': 'test-request-id',
        'x-amzn-trace-id': 'test-trace-id',
      },
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Testing' }],
          },
        },
        usage: {
          inputTokens: 4,
          outputTokens: 34,
          totalTokens: 38,
        },
        stopReason: 'stop_sequence',
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.response?.headers).toEqual({
      'x-amzn-requestid': 'test-request-id',
      'x-amzn-trace-id': 'test-trace-id',
      'content-type': 'application/json',
      'content-length': '164',
    });
  });

  it('should extract response metadata', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      headers: {
        'x-amzn-requestid': 'test-request-id',
        date: 'Wed, 01 Jan 2025 00:00:00 GMT',
      },
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'Testing' }],
          },
        },
        usage: {
          inputTokens: 4,
          outputTokens: 34,
          totalTokens: 38,
        },
        stopReason: 'end_turn',
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.response?.id).toMatchInlineSnapshot(`"test-request-id"`);
    expect(result.response?.timestamp).toMatchInlineSnapshot(
      `2025-01-01T00:00:00.000Z`,
    );
    expect(result.response?.modelId).toMatchInlineSnapshot(
      `"anthropic.claude-3-haiku-20240307-v1:0"`,
    );
  });

  it('should pass tools and tool choice correctly', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      tools: [
        {
          type: 'function',
          name: 'test-tool-1',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
              param2: { type: 'number' },
            },
            required: ['param1'],
            additionalProperties: false,
          },
        },
      ],
      toolChoice: { type: 'auto' },
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: 'test-tool-1',
              description: 'A test tool',
              inputSchema: {
                json: {
                  type: 'object',
                  properties: {
                    param1: { type: 'string' },
                    param2: { type: 'number' },
                  },
                  required: ['param1'],
                  additionalProperties: false,
                },
              },
            },
          },
        ],
      },
    });
  });

  it('should only send the forced tool when toolChoice specifies a specific tool', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      tools: [
        {
          type: 'function',
          name: 'getWeatherByCity',
          description: 'Get weather by city',
          inputSchema: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
          },
        },
        {
          type: 'function',
          name: 'getCurrentWeather',
          description: 'Get current weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
            additionalProperties: false,
          },
        },
        {
          type: 'function',
          name: 'getWeatherForecast',
          description: 'Get forecast',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              days: { type: 'number' },
            },
            required: ['location', 'days'],
            additionalProperties: false,
          },
        },
      ],
      toolChoice: { type: 'tool', toolName: 'getWeatherByCity' },
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.toolConfig.tools).toHaveLength(1);
    expect(requestBody.toolConfig.tools[0].toolSpec.name).toBe(
      'getWeatherByCity',
    );
    expect(requestBody.toolConfig.toolChoice).toEqual({
      tool: { name: 'getWeatherByCity' },
    });
  });

  it('should send all tools when toolChoice is auto', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      tools: [
        {
          type: 'function',
          name: 'getWeatherByCity',
          description: 'Get weather by city',
          inputSchema: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
          },
        },
        {
          type: 'function',
          name: 'getCurrentWeather',
          description: 'Get current weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
            additionalProperties: false,
          },
        },
      ],
      toolChoice: { type: 'auto' },
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.toolConfig.tools).toHaveLength(2);
    expect(requestBody.toolConfig.tools[0].toolSpec.name).toBe(
      'getWeatherByCity',
    );
    expect(requestBody.toolConfig.tools[1].toolSpec.name).toBe(
      'getCurrentWeather',
    );
  });

  it('should omit empty tool descriptions to avoid Bedrock validation errors', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      tools: [
        {
          type: 'function',
          name: 'tool-with-empty-desc',
          description: '', // Empty string should be omitted
          inputSchema: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
            },
            required: ['param1'],
            additionalProperties: false,
          },
        },
        {
          type: 'function',
          name: 'tool-with-whitespace-desc',
          description: '   ', // Whitespace-only should be omitted
          inputSchema: {
            type: 'object',
            properties: {
              param2: { type: 'number' },
            },
            required: ['param2'],
            additionalProperties: false,
          },
        },
        {
          type: 'function',
          name: 'tool-with-valid-desc',
          description: 'Valid description',
          inputSchema: {
            type: 'object',
            properties: {
              param3: { type: 'boolean' },
            },
            required: ['param3'],
            additionalProperties: false,
          },
        },
      ],
      toolChoice: { type: 'auto' },
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.calls[0].requestBodyJson;

    // Tool with empty description should not have description field
    expect(requestBody.toolConfig.tools[0].toolSpec).not.toHaveProperty(
      'description',
    );
    expect(requestBody.toolConfig.tools[0].toolSpec.name).toBe(
      'tool-with-empty-desc',
    );

    // Tool with whitespace-only description should not have description field
    expect(requestBody.toolConfig.tools[1].toolSpec).not.toHaveProperty(
      'description',
    );
    expect(requestBody.toolConfig.tools[1].toolSpec.name).toBe(
      'tool-with-whitespace-desc',
    );

    // Tool with valid description should have description field
    expect(requestBody.toolConfig.tools[2].toolSpec.description).toBe(
      'Valid description',
    );
    expect(requestBody.toolConfig.tools[2].toolSpec.name).toBe(
      'tool-with-valid-desc',
    );
  });

  it('should handle Anthropic provider-defined tools', async () => {
    mockPrepareAnthropicTools.mockReturnValue(
      Promise.resolve({
        tools: [
          { name: 'bash', type: 'bash_20241022', cache_control: undefined },
        ],
        toolChoice: { type: 'auto' },
        toolWarnings: [],
        betas: new Set(['computer-use-2024-10-22']),
      }),
    );

    // Set up the mock response for this specific URL and test case
    server.urls[anthropicGenerateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                toolUse: {
                  toolUseId: 'tool-use-id',
                  name: 'bash',
                  input: { command: 'ls -l' },
                },
              },
            ],
          },
        },
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        stopReason: 'tool_use',
      },
    };

    const anthropicModel = new AmazonBedrockChatLanguageModel(
      anthropicModelId,
      {
        baseUrl: () => baseUrl,
        headers: {},
        // No fetch property: defaults to global fetch, which is mocked by the test server.
        generateId: () => 'test-id',
      },
    );

    const result = await anthropicModel.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'provider',
          id: 'anthropic.bash_20241022',
          name: 'bash',
          args: {},
        },
      ],
      toolChoice: { type: 'auto' },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.additionalModelRequestFields).toEqual({
      tool_choice: { type: 'auto' },
      anthropic_beta: ['computer-use-2024-10-22'],
    });

    expect(requestBody.toolConfig).toBeDefined();
    expect(requestBody.toolConfig.tools).toHaveLength(1);
    expect(requestBody.toolConfig.tools[0].toolSpec.name).toBe('bash');
    expect(requestBody.toolConfig.tools[0].toolSpec.inputSchema.json).toEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        command: { type: 'string' },
        restart: { type: 'boolean' },
      },
      required: ['command'],
      additionalProperties: false,
    });

    expect(result.warnings).toEqual([]);
    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "input": "{"command":"ls -l"}",
          "toolCallId": "tool-use-id",
          "toolName": "bash",
          "type": "tool-call",
        },
      ]
    `);
  });

  it('should include anthropic_beta in additionalModelRequestFields when using extended context', async () => {
    server.urls[anthropicGenerateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'test response' }],
          },
        },
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        stopReason: 'stop',
      },
    };

    const anthropicModel = new AmazonBedrockChatLanguageModel(
      anthropicModelId,
      {
        baseUrl: () => baseUrl,
        headers: {},
        generateId: () => 'test-id',
      },
    );

    await anthropicModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        bedrock: {
          anthropicBeta: ['context-1m-2025-08-07'],
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.additionalModelRequestFields).toEqual({
      anthropic_beta: ['context-1m-2025-08-07'],
    });
  });

  it('should not include anthropic-beta in HTTP headers', async () => {
    server.urls[anthropicGenerateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'test response' }],
          },
        },
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        stopReason: 'stop',
      },
    };

    const anthropicModel = new AmazonBedrockChatLanguageModel(
      anthropicModelId,
      {
        baseUrl: () => baseUrl,
        headers: {},
        generateId: () => 'test-id',
      },
    );

    await anthropicModel.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'provider',
          id: 'anthropic.bash_20241022',
          name: 'bash',
          args: {},
        },
      ],
    });

    const requestHeaders = server.calls[0].requestHeaders;

    expect(requestHeaders['anthropic-beta']).toBeUndefined();
  });

  it('should combine user-provided and tool-generated betas in body', async () => {
    server.urls[anthropicGenerateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-use-id',
                name: 'bash',
                input: { command: 'ls -l' },
              },
            ],
          },
        },
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        stopReason: 'tool_use',
      },
    };

    const anthropicModel = new AmazonBedrockChatLanguageModel(
      anthropicModelId,
      {
        baseUrl: () => baseUrl,
        headers: {},
        generateId: () => 'test-id',
      },
    );

    await anthropicModel.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'provider',
          id: 'anthropic.bash_20241022',
          name: 'bash',
          args: {},
        },
      ],
      providerOptions: {
        bedrock: {
          anthropicBeta: ['context-1m-2025-08-07'],
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.additionalModelRequestFields.anthropic_beta).toEqual([
      'context-1m-2025-08-07',
      'computer-use-2024-10-22',
    ]);
  });

  it('should properly combine headers from all sources', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    const optionsHeaders = {
      'options-header': 'options-value',
      'shared-header': 'options-shared',
    };

    const model = new AmazonBedrockChatLanguageModel(modelId, {
      baseUrl: () => baseUrl,
      headers: {
        'model-header': 'model-value',
        'shared-header': 'model-shared',
      },
      fetch: injectFetchHeaders({
        'options-header': 'options-value',
        'model-header': 'model-value',
        'shared-header': 'options-shared',
        'signed-header': 'signed-value',
        authorization: 'AWS4-HMAC-SHA256...',
      }),
      generateId: () => 'test-id',
    });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      headers: optionsHeaders,
    });

    const requestHeaders = server.calls[0].requestHeaders;
    expect(requestHeaders['options-header']).toBe('options-value');
    expect(requestHeaders['model-header']).toBe('model-value');
    expect(requestHeaders['signed-header']).toBe('signed-value');
    expect(requestHeaders['authorization']).toBe('AWS4-HMAC-SHA256...');
    expect(requestHeaders['shared-header']).toBe('options-shared');
  });

  it('should work with partial headers', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    const model = new AmazonBedrockChatLanguageModel(modelId, {
      baseUrl: () => baseUrl,
      headers: {
        'model-header': 'model-value',
      },
      fetch: injectFetchHeaders({
        'model-header': 'model-value',
        'signed-header': 'signed-value',
        authorization: 'AWS4-HMAC-SHA256...',
      }),
      generateId: () => 'test-id',
    });

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const requestHeaders = server.calls[0].requestHeaders;
    expect(requestHeaders['model-header']).toBe('model-value');
    expect(requestHeaders['signed-header']).toBe('signed-value');
    expect(requestHeaders['authorization']).toBe('AWS4-HMAC-SHA256...');
  });

  it('should include providerOptions in the request for generate calls', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        bedrock: {
          foo: 'bar',
        },
      },
    });

    const body = await server.calls[0].requestBodyJson;
    expect(body).toMatchObject({ foo: 'bar' });
  });

  it('should include cache token usage in providerMetadata', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Testing' }],
          },
        },
        usage: {
          inputTokens: 4,
          outputTokens: 34,
          totalTokens: 38,
          cacheReadInputTokens: 2,
          cacheWriteInputTokens: 3,
        },
        stopReason: 'stop_sequence',
      },
    };

    const response = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response.providerMetadata).toMatchInlineSnapshot(`
      {
        "amazonBedrock": {
          "stopSequence": null,
          "usage": {
            "cacheWriteInputTokens": 3,
          },
        },
        "bedrock": {
          "stopSequence": null,
          "usage": {
            "cacheWriteInputTokens": 3,
          },
        },
      }
    `);
    expect(response.usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 2,
          "cacheWrite": 3,
          "noCache": 4,
          "total": 9,
        },
        "outputTokens": {
          "reasoning": undefined,
          "text": 34,
          "total": 34,
        },
        "raw": {
          "cacheReadInputTokens": 2,
          "cacheWriteInputTokens": 3,
          "inputTokens": 4,
          "outputTokens": 34,
          "totalTokens": 38,
        },
      }
    `);
  });

  it('should include performanceConfig in providerMetadata', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello' }],
          },
        },
        usage: {
          inputTokens: 4,
          outputTokens: 34,
          totalTokens: 38,
        },
        stopReason: 'end_turn',
        performanceConfig: { latency: 'optimized' },
      },
    };

    const response = await model.doGenerate({ prompt: TEST_PROMPT });

    expect(response.providerMetadata).toMatchInlineSnapshot(`
      {
        "amazonBedrock": {
          "performanceConfig": {
            "latency": "optimized",
          },
          "stopSequence": null,
        },
        "bedrock": {
          "performanceConfig": {
            "latency": "optimized",
          },
          "stopSequence": null,
        },
      }
    `);
  });

  it('should include serviceTier in providerMetadata', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello' }],
          },
        },
        usage: {
          inputTokens: 4,
          outputTokens: 34,
          totalTokens: 38,
        },
        stopReason: 'end_turn',
        serviceTier: { type: 'on-demand' },
      },
    };

    const response = await model.doGenerate({ prompt: TEST_PROMPT });

    expect(response.providerMetadata).toMatchInlineSnapshot(`
      {
        "amazonBedrock": {
          "serviceTier": {
            "type": "on-demand",
          },
          "stopSequence": null,
        },
        "bedrock": {
          "serviceTier": {
            "type": "on-demand",
          },
          "stopSequence": null,
        },
      }
    `);
  });

  it('should include cacheDetails in providerMetadata', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello' }],
          },
        },
        usage: {
          inputTokens: 4,
          outputTokens: 34,
          totalTokens: 38,
          cacheDetails: [{ inputTokens: 100, ttl: 'T5M' }],
        },
        stopReason: 'end_turn',
      },
    };

    const response = await model.doGenerate({ prompt: TEST_PROMPT });

    expect(response.providerMetadata).toMatchInlineSnapshot(`
      {
        "amazonBedrock": {
          "stopSequence": null,
          "usage": {
            "cacheDetails": [
              {
                "inputTokens": 100,
                "ttl": "T5M",
              },
            ],
          },
        },
        "bedrock": {
          "stopSequence": null,
          "usage": {
            "cacheDetails": [
              {
                "inputTokens": 100,
                "ttl": "T5M",
              },
            ],
          },
        },
      }
    `);
  });

  it('should handle system messages with cache points', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: [
        {
          role: 'system',
          content: 'System Prompt',
          providerOptions: { bedrock: { cachePoint: { type: 'default' } } },
        },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      system: [{ text: 'System Prompt' }, { cachePoint: { type: 'default' } }],
      messages: [{ role: 'user', content: [{ text: 'Hello' }] }],
    });
  });

  it('should transform reasoningConfig to thinking in additionalModelRequestFields', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      maxOutputTokens: 100,
      providerOptions: {
        bedrock: {
          reasoningConfig: {
            type: 'enabled',
            budgetTokens: 2000,
          },
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    // Should contain thinking in additionalModelRequestFields
    expect(requestBody).toMatchObject({
      additionalModelRequestFields: {
        thinking: {
          type: 'enabled',
          budget_tokens: 2000,
        },
      },
      inferenceConfig: {
        maxTokens: 2100,
      },
    });

    // Should NOT contain reasoningConfig at the top level
    expect(requestBody).not.toHaveProperty('reasoningConfig');
  });

  it('merges user additionalModelRequestFields with derived thinking (generate)', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        bedrock: {
          reasoningConfig: { type: 'enabled', budgetTokens: 1234 },
          additionalModelRequestFields: { foo: 'bar', custom: 42 },
        },
      },
    });

    const body = await server.calls[0].requestBodyJson;
    expect(body).not.toHaveProperty('reasoningConfig');
    expect(body.additionalModelRequestFields).toMatchObject({
      foo: 'bar',
      custom: 42,
      thinking: { type: 'enabled', budget_tokens: 1234 },
    });
  });

  it('should forward display in adaptive reasoningConfig to thinking', async () => {
    server.urls[newerAnthropicGenerateUrl].response = {
      type: 'json-value' as const,
      body: {
        output: {
          message: { content: [{ text: 'Hello' }], role: 'assistant' },
        },
        stopReason: 'stop_sequence',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    };

    await newerAnthropicModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        bedrock: {
          reasoningConfig: {
            type: 'adaptive',
            display: 'summarized',
          },
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.additionalModelRequestFields?.thinking).toEqual({
      type: 'adaptive',
      display: 'summarized',
    });
  });

  it('should pass serviceTier provider option in generate requests', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        bedrock: {
          serviceTier: 'priority',
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody).toMatchObject({
      serviceTier: {
        type: 'priority',
      },
    });
    expect(
      requestBody.additionalModelRequestFields?.serviceTier,
    ).toBeUndefined();
  });

  it('maps maxReasoningEffort for Nova without thinking (generate)', async () => {
    server.urls[novaGenerateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: { content: [{ text: 'Hello' }], role: 'assistant' },
        },
        stopReason: 'stop_sequence',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    };

    await novaModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        bedrock: {
          reasoningConfig: {
            type: 'enabled',
            maxReasoningEffort: 'medium',
            budgetTokens: 2048,
          },
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody).toMatchObject({
      additionalModelRequestFields: {
        reasoningConfig: {
          type: 'enabled',
          maxReasoningEffort: 'medium',
        },
      },
    });
    expect(requestBody.additionalModelRequestFields?.thinking).toBeUndefined();
  });

  it('maps maxReasoningEffort to reasoning_effort for OpenAI models (generate)', async () => {
    server.urls[openaiGenerateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: { content: [{ text: 'Hello' }], role: 'assistant' },
        },
        stopReason: 'stop_sequence',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    };

    await openaiModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        bedrock: {
          reasoningConfig: {
            maxReasoningEffort: 'medium',
          },
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody).toMatchObject({
      additionalModelRequestFields: {
        reasoning_effort: 'medium',
      },
    });
    expect(
      requestBody.additionalModelRequestFields?.reasoningConfig,
    ).toBeUndefined();
    expect(requestBody.additionalModelRequestFields?.thinking).toBeUndefined();
  });

  it('should pass maxReasoningEffort as output_config.effort for Anthropic models (generate)', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        bedrock: {
          reasoningConfig: {
            type: 'enabled',
            maxReasoningEffort: 'medium',
          },
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(
      requestBody.additionalModelRequestFields?.reasoningConfig,
    ).toBeUndefined();
    expect(requestBody.additionalModelRequestFields?.output_config).toEqual({
      effort: 'medium',
    });
  });

  it('should use native output_config.format instead of json tool when thinking is enabled with structured output', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Generate a recipe' }],
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            recipe: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                ingredients: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'ingredients'],
            },
          },
          required: ['recipe'],
        },
      },
      providerOptions: {
        bedrock: {
          reasoningConfig: {
            type: 'enabled',
            budgetTokens: 2000,
          },
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.toolConfig).toBeUndefined();

    expect(requestBody.additionalModelRequestFields?.output_config).toEqual({
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            recipe: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                ingredients: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'ingredients'],
            },
          },
          required: ['recipe'],
        },
      },
    });

    expect(requestBody.additionalModelRequestFields?.thinking).toBeDefined();
  });

  it('should merge output_config.effort and output_config.format when thinking with maxReasoningEffort and structured output', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    await model.doGenerate({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Generate a recipe' }],
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
      providerOptions: {
        bedrock: {
          reasoningConfig: {
            type: 'enabled',
            budgetTokens: 2000,
            maxReasoningEffort: 'medium',
          },
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.toolConfig).toBeUndefined();

    expect(requestBody.additionalModelRequestFields?.output_config).toEqual({
      effort: 'medium',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
    });
  });

  it('should still use json tool fallback for structured output without thinking enabled', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                toolUse: {
                  toolUseId: 'json-tool-id',
                  name: 'json',
                  input: { name: 'Test' },
                },
              },
            ],
          },
        },
        usage: { inputTokens: 4, outputTokens: 10, totalTokens: 14 },
        stopReason: 'tool_use',
      },
    };

    const result = await model.doGenerate({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Generate a name' }],
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.toolConfig).toBeDefined();
    expect(requestBody.toolConfig.tools).toHaveLength(1);
    expect(requestBody.toolConfig.tools[0].toolSpec.name).toBe('json');
    expect(requestBody.toolConfig.toolChoice).toEqual({ any: {} });

    expect(
      requestBody.additionalModelRequestFields?.output_config?.format,
    ).toBeUndefined();

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "{"name":"Test"}",
          "type": "text",
        },
      ]
    `);
    expect(result.providerMetadata?.bedrock?.isJsonResponseFromTool).toBe(true);
  });

  it('should use native output_config.format for models with structured output support even without thinking enabled', async () => {
    server.urls[newerAnthropicGenerateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            content: [{ text: '{"name":"Test"}' }],
            role: 'assistant',
          },
        },
        usage: { inputTokens: 4, outputTokens: 10, totalTokens: 14 },
        stopReason: 'end_turn',
      },
    };

    await newerAnthropicModel.doGenerate({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Generate a name' }],
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.toolConfig).toBeUndefined();

    expect(requestBody.additionalModelRequestFields?.output_config)
      .toMatchInlineSnapshot(`
      {
        "format": {
          "schema": {
            "properties": {
              "name": {
                "type": "string",
              },
            },
            "required": [
              "name",
            ],
            "type": "object",
          },
          "type": "json_schema",
        },
      }
    `);
  });

  it('should extract reasoning text with signature', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                reasoningContent: {
                  reasoningText: {
                    text: 'I need to think about this problem carefully...',
                    signature: 'abc123signature',
                  },
                },
              },
              { type: 'text', text: 'The answer is 42.' },
            ],
          },
        },
        usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
        stopReason: 'stop_sequence',
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": {
            "amazonBedrock": {
              "signature": "abc123signature",
            },
            "bedrock": {
              "signature": "abc123signature",
            },
          },
          "text": "I need to think about this problem carefully...",
          "type": "reasoning",
        },
        {
          "text": "The answer is 42.",
          "type": "text",
        },
      ]
    `);
  });

  it('should preserve empty text blocks between reasoning blocks', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                reasoningContent: {
                  reasoningText: {
                    text: 'thinking...',
                    signature: 'sig-1',
                  },
                },
              },
              { text: '' },
              {
                reasoningContent: {
                  reasoningText: {
                    text: 'more thinking...',
                    signature: 'sig-2',
                  },
                },
              },
              { text: 'The answer is 42.' },
            ],
          },
        },
        usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
        stopReason: 'stop_sequence',
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": {
            "amazonBedrock": {
              "signature": "sig-1",
            },
            "bedrock": {
              "signature": "sig-1",
            },
          },
          "text": "thinking...",
          "type": "reasoning",
        },
        {
          "text": "",
          "type": "text",
        },
        {
          "providerMetadata": {
            "amazonBedrock": {
              "signature": "sig-2",
            },
            "bedrock": {
              "signature": "sig-2",
            },
          },
          "text": "more thinking...",
          "type": "reasoning",
        },
        {
          "text": "The answer is 42.",
          "type": "text",
        },
      ]
    `);
  });

  it('should extract reasoning text without signature', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                reasoningContent: {
                  reasoningText: {
                    text: 'I need to think about this problem carefully...',
                  },
                },
              },
              { type: 'text', text: 'The answer is 42.' },
            ],
          },
        },
        usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
        stopReason: 'stop_sequence',
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "I need to think about this problem carefully...",
          "type": "reasoning",
        },
        {
          "text": "The answer is 42.",
          "type": "text",
        },
      ]
    `);
  });

  it('should extract redacted reasoning', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                reasoningContent: {
                  redactedReasoning: {
                    data: 'redacted-reasoning-data',
                  },
                },
              },
              { type: 'text', text: 'The answer is 42.' },
            ],
          },
        },
        usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
        stopReason: 'stop_sequence',
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": {
            "amazonBedrock": {
              "redactedData": "redacted-reasoning-data",
            },
            "bedrock": {
              "redactedData": "redacted-reasoning-data",
            },
          },
          "text": "",
          "type": "reasoning",
        },
        {
          "text": "The answer is 42.",
          "type": "text",
        },
      ]
    `);
  });

  it('should handle multiple reasoning blocks', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                reasoningContent: {
                  reasoningText: {
                    text: 'First reasoning block',
                    signature: 'sig1',
                  },
                },
              },
              {
                reasoningContent: {
                  redactedReasoning: {
                    data: 'redacted-data',
                  },
                },
              },
              { type: 'text', text: 'The answer is 42.' },
            ],
          },
        },
        usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
        stopReason: 'stop_sequence',
      },
    };

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": {
            "amazonBedrock": {
              "signature": "sig1",
            },
            "bedrock": {
              "signature": "sig1",
            },
          },
          "text": "First reasoning block",
          "type": "reasoning",
        },
        {
          "providerMetadata": {
            "amazonBedrock": {
              "redactedData": "redacted-data",
            },
            "bedrock": {
              "redactedData": "redacted-data",
            },
          },
          "text": "",
          "type": "reasoning",
        },
        {
          "text": "The answer is 42.",
          "type": "text",
        },
      ]
    `);
  });

  it('should omit toolConfig and filter tool content when conversation has tool calls but no active tools', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    const conversationWithToolCalls: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'What is the weather in Toronto?' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool-call-1',
            toolName: 'weather',
            input: { city: 'Toronto' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool-call-1',
            toolName: 'weather',
            output: {
              type: 'text',
              value: 'The weather in Toronto is 20°C.',
            },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Now give me a summary.' }],
      },
    ];

    const result = await model.doGenerate({
      prompt: conversationWithToolCalls,
      tools: [],
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.toolConfig).toMatchInlineSnapshot(`undefined`);

    expect(requestBody.messages).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "text": "What is the weather in Toronto?",
            },
            {
              "text": "Now give me a summary.",
            },
          ],
          "role": "user",
        },
      ]
    `);

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "Tool calls and results removed from conversation because Bedrock does not support tool content without active tools.",
          "feature": "toolContent",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should handle JSON response format with schema', async () => {
    server.urls[generateUrl].response = {
      type: 'json-value',
      body: {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                toolUse: {
                  toolUseId: 'json-tool-id',
                  name: 'json',
                  input: {
                    recipe: {
                      name: 'Lasagna',
                      ingredients: ['pasta', 'cheese'],
                    },
                  },
                },
              },
            ],
          },
        },
        usage: { inputTokens: 4, outputTokens: 34, totalTokens: 38 },
        stopReason: 'tool_use',
      },
    };

    const result = await model.doGenerate({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Generate a recipe' }],
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            recipe: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                ingredients: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'ingredients'],
            },
          },
          required: ['recipe'],
        },
      },
    });

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "{"recipe":{"name":"Lasagna","ingredients":["pasta","cheese"]}}",
          "type": "text",
        },
      ]
    `);

    expect(result.providerMetadata?.bedrock?.isJsonResponseFromTool).toBe(true);
    expect(result.finishReason).toMatchInlineSnapshot(`
      {
        "raw": "tool_use",
        "unified": "stop",
      }
    `);

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.toolConfig.tools).toHaveLength(1);
    expect(requestBody.toolConfig.tools[0].toolSpec.name).toBe('json');
    expect(requestBody.toolConfig.tools[0].toolSpec.description).toBe(
      'Respond with a JSON object.',
    );
    expect(requestBody.toolConfig.toolChoice).toEqual({ any: {} });
  });

  describe('json schema response format with json tool response', () => {
    let result: Awaited<ReturnType<typeof model.doGenerate>>;

    beforeEach(async () => {
      prepareJsonFixtureResponse('amazon-bedrock-json-tool.1');

      result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              elements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    location: { type: 'string' },
                    temperature: { type: 'number' },
                    condition: { type: 'string' },
                  },
                  required: ['location', 'temperature', 'condition'],
                },
              },
            },
            required: ['elements'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      });
    });

    it('should pass json schema response format as a tool', async () => {
      const requestBody = await server.calls[0].requestBodyJson;

      expect(requestBody.toolConfig).toBeDefined();
      expect(requestBody.toolConfig.tools).toHaveLength(1);
      expect(requestBody.toolConfig.tools[0].toolSpec.name).toBe('json');
      expect(requestBody.toolConfig.tools[0].toolSpec.description).toBe(
        'Respond with a JSON object.',
      );
      expect(requestBody.toolConfig.toolChoice).toEqual({ any: {} });
    });

    it('should return the json response as text', async () => {
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "{"elements":[{"location":"San Francisco","temperature":-5,"condition":"snowy"},{"location":"London","temperature":0,"condition":"snowy"}]}",
            "type": "text",
          },
        ]
      `);
    });

    it('should send stop finish reason when json tool is used', async () => {
      expect(result.finishReason).toMatchInlineSnapshot(`
        {
          "raw": "tool_use",
          "unified": "stop",
        }
      `);
    });

    it('should set isJsonResponseFromTool in provider metadata', async () => {
      expect(result.providerMetadata?.bedrock?.isJsonResponseFromTool).toBe(
        true,
      );
    });
  });

  describe('json schema response format with other tool response', () => {
    let result: Awaited<ReturnType<typeof model.doGenerate>>;

    beforeEach(async () => {
      prepareJsonFixtureResponse('amazon-bedrock-json-other-tool.1');

      result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        tools: [
          {
            type: 'function',
            name: 'get-weather',
            description: 'Get the weather in a location',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
              required: ['location'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              weather: { type: 'string' },
              temperature: { type: 'number' },
            },
            required: ['weather', 'temperature'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      });
    });

    it('should pass the tool and the json schema response format as tools', async () => {
      const requestBody = await server.calls[0].requestBodyJson;

      expect(requestBody.toolConfig).toBeDefined();
      expect(requestBody.toolConfig.tools).toHaveLength(2);
      expect(requestBody.toolConfig.tools[0].toolSpec.name).toBe('get-weather');
      expect(requestBody.toolConfig.tools[1].toolSpec.name).toBe('json');
      expect(requestBody.toolConfig.toolChoice).toEqual({ any: {} });
    });

    it('should return the regular tool call', async () => {
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "input": "{"location":"San Francisco"}",
            "toolCallId": "toolu_01PQjhxo3eirCdKNvCJrKc8f",
            "toolName": "get-weather",
            "type": "tool-call",
          },
        ]
      `);
    });

    it('should send tool-calls finish reason', async () => {
      expect(result.finishReason).toMatchInlineSnapshot(`
        {
          "raw": "tool_use",
          "unified": "tool-calls",
        }
      `);
    });
  });

  it('should handle unsupported response format types', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: { type: 'xml' as any },
    });

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "Only text and json response formats are supported.",
          "feature": "responseFormat",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should omit toolConfig when conversation has tool calls but toolChoice is none', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    const conversationWithToolCalls: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'What is the weather in Toronto?' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool-call-1',
            toolName: 'weather',
            input: { city: 'Toronto' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool-call-1',
            toolName: 'weather',
            output: {
              type: 'text',
              value: 'The weather in Toronto is 20°C.',
            },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Now give me a summary.' }],
      },
    ];

    await model.doGenerate({
      prompt: conversationWithToolCalls,
      tools: [
        {
          type: 'function',
          name: 'weather',
          inputSchema: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      toolChoice: { type: 'none' },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.toolConfig).toMatchInlineSnapshot(`undefined`);
  });

  it('should clamp temperature above 1 to 1 and add warning', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      temperature: 1.5,
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.inferenceConfig.temperature).toBe(1);
    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "1.5 exceeds bedrock maximum of 1.0. clamped to 1.0",
          "feature": "temperature",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should clamp temperature below 0 to 0 and add warning', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      temperature: -0.5,
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.inferenceConfig.temperature).toBe(0);
    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "details": "-0.5 is below bedrock minimum of 0. clamped to 0",
          "feature": "temperature",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should not clamp valid temperature between 0 and 1', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-text');

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
      temperature: 0.7,
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.inferenceConfig.temperature).toBe(0.7);
    expect(result.warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should include text content before JSON tool call in doGenerate', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-json-tool.2');

    const result = await model.doGenerate({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Generate JSON' }] },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value'],
        },
      },
    });

    // Text before the JSON tool call should be included
    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "Let me generate that JSON for you.",
          "type": "text",
        },
        {
          "text": "{"value":"test data"}",
          "type": "text",
        },
      ]
    `);

    expect(result.providerMetadata?.bedrock?.isJsonResponseFromTool).toBe(true);
    expect(result.finishReason).toMatchInlineSnapshot(`
      {
        "raw": "tool_use",
        "unified": "stop",
      }
    `);
  });

  it('should preserve text response before JSON output (answering question then returning structured data)', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-json-tool-with-answer.1');

    const result = await model.doGenerate({
      prompt: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: "What's 2+2? Also the name to use is John Doe",
            },
          ],
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
          required: ['firstName', 'lastName'],
          additionalProperties: false,
          $schema: 'http://json-schema.org/draft-07/schema#',
        },
      },
    });

    // Should preserve the answer text AND the structured JSON output
    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "2 + 2 equals 4.",
          "type": "text",
        },
        {
          "text": "{"firstName":"John","lastName":"Doe"}",
          "type": "text",
        },
      ]
    `);

    expect(result.finishReason).toMatchInlineSnapshot(`
      {
        "raw": "tool_use",
        "unified": "stop",
      }
    `);
    expect(result.providerMetadata?.bedrock?.isJsonResponseFromTool).toBe(true);
  });

  it('should include multiple text blocks before JSON tool call in doGenerate', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-json-tool.3');

    const result = await model.doGenerate({
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Generate data' }] },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { result: { type: 'number' } },
          required: ['result'],
        },
      },
    });

    // All text blocks before the JSON tool call should be included
    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "First text block.",
          "type": "text",
        },
        {
          "text": "Second text block.",
          "type": "text",
        },
        {
          "text": "Third text block before JSON.",
          "type": "text",
        },
        {
          "text": "{"result":42}",
          "type": "text",
        },
      ]
    `);

    expect(result.providerMetadata?.bedrock?.isJsonResponseFromTool).toBe(true);
  });

  it('should handle regular tool call before JSON tool call in doGenerate', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-json-with-tool.1');

    const result = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      tools: [
        {
          type: 'function',
          name: 'get-weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
          },
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { result: { type: 'string' } },
          required: ['result'],
        },
      },
    });

    // Should include text, regular tool call, more text, and JSON as text
    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "Let me call a tool first.",
          "type": "text",
        },
        {
          "input": "{"location":"SF"}",
          "toolCallId": "tool-1",
          "toolName": "get-weather",
          "type": "tool-call",
        },
        {
          "text": "Now the JSON.",
          "type": "text",
        },
        {
          "text": "{"result":"data"}",
          "type": "text",
        },
      ]
    `);

    expect(result.providerMetadata?.bedrock?.isJsonResponseFromTool).toBe(true);
    expect(result.finishReason).toMatchInlineSnapshot(`
      {
        "raw": "tool_use",
        "unified": "stop",
      }
    `);
  });

  it('should handle multiple regular tool calls before JSON tool call in doGenerate', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-json-with-tools.1');

    const result = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
      tools: [
        {
          type: 'function',
          name: 'tool-a',
          inputSchema: {
            type: 'object',
            properties: { param: { type: 'string' } },
          },
        },
        {
          type: 'function',
          name: 'tool-b',
          inputSchema: {
            type: 'object',
            properties: { param: { type: 'string' } },
          },
        },
      ],
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { final: { type: 'string' } },
          required: ['final'],
        },
      },
    });

    // Should preserve all content
    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "Calling multiple tools.",
          "type": "text",
        },
        {
          "input": "{"param":"a"}",
          "toolCallId": "tool-1",
          "toolName": "tool-a",
          "type": "tool-call",
        },
        {
          "input": "{"param":"b"}",
          "toolCallId": "tool-2",
          "toolName": "tool-b",
          "type": "tool-call",
        },
        {
          "text": "Finally the JSON response.",
          "type": "text",
        },
        {
          "text": "{"final":"result"}",
          "type": "text",
        },
      ]
    `);

    expect(result.providerMetadata?.bedrock?.isJsonResponseFromTool).toBe(true);
    expect(result.finishReason).toMatchInlineSnapshot(`
      {
        "raw": "tool_use",
        "unified": "stop",
      }
    `);
  });

  it('should support tool calls with empty input (no arguments)', async () => {
    prepareJsonFixtureResponse('amazon-bedrock-tool-no-args');

    const result = await model.doGenerate({
      tools: [
        {
          type: 'function',
          name: 'updateIssueList',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    expect(result.content).toMatchInlineSnapshot(`
      [
        {
          "text": "I'll update the issue list for you.",
          "type": "text",
        },
        {
          "input": "{}",
          "toolCallId": "tool-use-id",
          "toolName": "updateIssueList",
          "type": "tool-call",
        },
      ]
    `);
  });

  describe('top-level reasoning parameter', () => {
    const simpleResponse = {
      type: 'json-value' as const,
      body: {
        output: {
          message: { content: [{ text: 'Hello' }], role: 'assistant' },
        },
        stopReason: 'stop_sequence',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    };

    it('should not set reasoning config when reasoning is "provider-default" for newer Anthropic models', async () => {
      server.urls[newerAnthropicGenerateUrl].response = simpleResponse;

      await newerAnthropicModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'provider-default',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(
        requestBody.additionalModelRequestFields?.thinking,
      ).toBeUndefined();
      expect(
        requestBody.additionalModelRequestFields?.output_config,
      ).toBeUndefined();
    });

    it('should map reasoning to adaptive thinking with effort for newer Anthropic models', async () => {
      server.urls[newerAnthropicGenerateUrl].response = simpleResponse;

      await newerAnthropicModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.additionalModelRequestFields?.thinking).toEqual({
        type: 'adaptive',
      });
      expect(
        requestBody.additionalModelRequestFields?.output_config?.effort,
      ).toBe('high');
    });

    it('should map reasoning "xhigh" to effort "max" for newer Anthropic models', async () => {
      server.urls[newerAnthropicGenerateUrl].response = simpleResponse;

      await newerAnthropicModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'xhigh',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.additionalModelRequestFields?.thinking).toEqual({
        type: 'adaptive',
      });
      expect(
        requestBody.additionalModelRequestFields?.output_config?.effort,
      ).toBe('max');
    });

    it('should warn when reasoning "minimal" is mapped for newer Anthropic models', async () => {
      server.urls[newerAnthropicGenerateUrl].response = simpleResponse;

      const result = await newerAnthropicModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'minimal',
      });

      expect(result.warnings).toContainEqual({
        type: 'compatibility',
        feature: 'reasoning',
        details:
          'reasoning "minimal" is not directly supported by this model. mapped to effort "low".',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(
        requestBody.additionalModelRequestFields?.output_config?.effort,
      ).toBe('low');
    });

    it('should map reasoning to budget-based thinking for older Anthropic models', async () => {
      prepareJsonFixtureResponse('amazon-bedrock-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.additionalModelRequestFields?.thinking).toEqual({
        type: 'enabled',
        budget_tokens: Math.max(1024, Math.round(4096 * 0.6)),
      });
    });

    it('should map reasoning to budget with minimum of 1024 tokens for older Anthropic models', async () => {
      prepareJsonFixtureResponse('amazon-bedrock-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'minimal',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(
        requestBody.additionalModelRequestFields?.thinking?.budget_tokens,
      ).toBe(1024);
    });

    it('should map reasoning directly to reasoning_effort for OpenAI models', async () => {
      server.urls[openaiGenerateUrl].response = simpleResponse;

      await openaiModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'medium',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.additionalModelRequestFields?.reasoning_effort).toBe(
        'medium',
      );
      expect(
        requestBody.additionalModelRequestFields?.thinking,
      ).toBeUndefined();
      expect(
        requestBody.additionalModelRequestFields?.reasoningConfig,
      ).toBeUndefined();
    });

    it('should map reasoning to reasoningConfig.maxReasoningEffort for other models', async () => {
      server.urls[novaGenerateUrl].response = simpleResponse;

      await novaModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(
        requestBody.additionalModelRequestFields?.reasoningConfig
          ?.maxReasoningEffort,
      ).toBe('high');
    });

    it('should let explicit reasoningConfig fields win over derived reasoning values', async () => {
      prepareJsonFixtureResponse('amazon-bedrock-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
        providerOptions: {
          bedrock: {
            reasoningConfig: {
              type: 'enabled',
              budgetTokens: 5000,
            },
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.additionalModelRequestFields?.thinking).toEqual({
        type: 'enabled',
        budget_tokens: 5000,
      });
    });

    it('should merge top-level reasoning with partial reasoningConfig for newer Anthropic models', async () => {
      server.urls[newerAnthropicGenerateUrl].response = simpleResponse;

      await newerAnthropicModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
        providerOptions: {
          bedrock: {
            reasoningConfig: { display: 'summarized' },
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.additionalModelRequestFields?.thinking).toEqual({
        type: 'adaptive',
        display: 'summarized',
      });
      expect(
        requestBody.additionalModelRequestFields?.output_config?.effort,
      ).toBe('high');
    });

    it('should honor reasoning "none" even when partial reasoningConfig is provided', async () => {
      server.urls[newerAnthropicGenerateUrl].response = simpleResponse;

      await newerAnthropicModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
        providerOptions: {
          bedrock: {
            reasoningConfig: { display: 'summarized' },
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(
        requestBody.additionalModelRequestFields?.thinking,
      ).toBeUndefined();
      expect(
        requestBody.additionalModelRequestFields?.output_config,
      ).toBeUndefined();
    });

    it('should let user-specified type win while still deriving maxReasoningEffort from reasoning', async () => {
      server.urls[newerAnthropicGenerateUrl].response = simpleResponse;

      await newerAnthropicModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
        providerOptions: {
          bedrock: {
            reasoningConfig: { type: 'enabled', budgetTokens: 3000 },
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.additionalModelRequestFields?.thinking).toEqual({
        type: 'enabled',
        budget_tokens: 3000,
      });
      expect(
        requestBody.additionalModelRequestFields?.output_config?.effort,
      ).toBe('high');
    });

    it('should let user-specified maxReasoningEffort win over derived for non-Anthropic models', async () => {
      server.urls[novaGenerateUrl].response = simpleResponse;

      await novaModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
        providerOptions: {
          bedrock: {
            reasoningConfig: { maxReasoningEffort: 'low' },
          },
        },
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(
        requestBody.additionalModelRequestFields?.reasoningConfig
          ?.maxReasoningEffort,
      ).toBe('low');
    });

    it('should strip temperature, topP, topK for Anthropic models when reasoning enables thinking', async () => {
      prepareJsonFixtureResponse('amazon-bedrock-text');

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'high',
        temperature: 0.7,
        topP: 0.9,
        topK: 5,
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(requestBody.inferenceConfig?.temperature).toBeUndefined();
      expect(requestBody.inferenceConfig?.topP).toBeUndefined();
      expect(requestBody.inferenceConfig?.topK).toBeUndefined();
      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'temperature',
        details: 'temperature is not supported when thinking is enabled',
      });
      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'topP',
        details: 'topP is not supported when thinking is enabled',
      });
      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'topK',
        details: 'topK is not supported when thinking is enabled',
      });
    });

    it('should handle reasoning "none" for Anthropic models', async () => {
      prepareJsonFixtureResponse('amazon-bedrock-text');

      await model.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(
        requestBody.additionalModelRequestFields?.thinking,
      ).toBeUndefined();
    });

    it('should handle reasoning "none" for OpenAI models', async () => {
      server.urls[openaiGenerateUrl].response = simpleResponse;

      await openaiModel.doGenerate({
        prompt: TEST_PROMPT,
        reasoning: 'none',
      });

      const requestBody = await server.calls[0].requestBodyJson;
      expect(
        requestBody.additionalModelRequestFields?.reasoning_effort,
      ).toBeUndefined();
    });
  });
});
