import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import {
  type Experimental_SandboxSession as SandboxSession,
  tool,
} from '@ai-sdk/provider-utils';
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockSandboxSessionFileStubs } from '../test/mock-sandbox';
import { z } from 'zod/v4';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { createAgentUIStreamResponse } from './create-agent-ui-stream-response';
import { ToolLoopAgent } from './tool-loop-agent';

describe('createAgentUIStreamResponse', () => {
  describe('when using tools toModelOutput', () => {
    let recordedInputs: LanguageModelV4CallOptions[];
    let response: Response;
    let decodedChunks: string[];

    beforeEach(async () => {
      recordedInputs = [];

      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4({
          doStream: async input => {
            recordedInputs.push(input);
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
                      total: 10,
                      noCache: 10,
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
        }),
        tools: {
          example: tool({
            description: 'Example tool',
            inputSchema: z.object({
              input: z.string(),
            }),
            outputSchema: z.object({
              value: z.string(),
            }),
            // important: tool has toModelOutput that needs to be called
            toModelOutput: ({ output }) => ({
              type: 'content',
              value: [{ type: 'text', text: output.value }],
            }),
          }),
        },
      });

      response = await createAgentUIStreamResponse({
        agent,
        uiMessages: [
          {
            role: 'user',
            id: 'msg-1',
            parts: [
              {
                type: 'text' as const,
                text: 'Hello, world!',
              },
            ],
          },
          {
            role: 'assistant',
            id: 'msg-2',
            parts: [
              {
                type: 'tool-example' as const,
                toolCallId: 'call-1',
                state: 'output-available',
                input: {
                  input: 'Hello, world!',
                },
                output: {
                  value: 'Example tool: Hello, world!',
                },
              },
            ],
          },
        ],
      });

      // consume the response
      const decoder = new TextDecoder();
      const encodedStream = response.body!;
      const chunks = await convertReadableStreamToArray(encodedStream);
      decodedChunks = chunks.map(chunk => decoder.decode(chunk));
    });

    it('should have a single call that contains the tool result as text', () => {
      expect(recordedInputs).toMatchInlineSnapshot(`
        [
          {
            "abortSignal": undefined,
            "frequencyPenalty": undefined,
            "headers": {
              "user-agent": "ai-sdk-agent/tool-loop",
            },
            "includeRawChunks": false,
            "maxOutputTokens": undefined,
            "presencePenalty": undefined,
            "prompt": [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "Hello, world!",
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
                      "input": "Hello, world!",
                    },
                    "providerExecuted": undefined,
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "example",
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
                      "type": "content",
                      "value": [
                        {
                          "text": "Example tool: Hello, world!",
                          "type": "text",
                        },
                      ],
                    },
                    "providerOptions": undefined,
                    "toolCallId": "call-1",
                    "toolName": "example",
                    "type": "tool-result",
                  },
                ],
                "providerOptions": undefined,
                "role": "tool",
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
            "tools": [
              {
                "description": "Example tool",
                "inputSchema": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "additionalProperties": false,
                  "properties": {
                    "input": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "input",
                  ],
                  "type": "object",
                },
                "name": "example",
                "type": "function",
              },
            ],
            "topK": undefined,
            "topP": undefined,
          },
        ]
      `);
    });

    it('should return the UI message stream response', () => {
      expect(decodedChunks).toMatchInlineSnapshot(`
        [
          "data: {"type":"start","messageId":"msg-2"}

        ",
          "data: {"type":"start-step"}

        ",
          "data: {"type":"text-start","id":"1"}

        ",
          "data: {"type":"text-delta","id":"1","delta":"Hello"}

        ",
          "data: {"type":"text-delta","id":"1","delta":", "}

        ",
          "data: {"type":"text-delta","id":"1","delta":"world!"}

        ",
          "data: {"type":"text-end","id":"1"}

        ",
          "data: {"type":"finish-step"}

        ",
          "data: {"type":"finish","finishReason":"stop"}

        ",
          "data: [DONE]

        ",
        ]
      `);
    });
  });

  describe('when using onFinish without originalMessages', () => {
    it('should call onFinish callback and complete stream without errors', async () => {
      let onFinishCalled = false;
      let finishMessages: unknown[] | undefined;

      const agent = new ToolLoopAgent({
        model: new MockLanguageModelV4({
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
                { type: 'text-delta', id: '1', delta: 'Done!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 5,
                      noCache: 5,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 5,
                      text: 5,
                      reasoning: undefined,
                    },
                  },
                  providerMetadata: undefined,
                },
              ]),
            };
          },
        }),
        tools: {
          testTool: tool({
            description: 'Test tool',
            inputSchema: z.object({ value: z.string() }),
            outputSchema: z.object({ result: z.string() }),
          }),
        },
      });

      const response = await createAgentUIStreamResponse({
        agent,
        uiMessages: [
          {
            role: 'user',
            id: 'msg-1',
            parts: [{ type: 'text' as const, text: 'Run test tool' }],
          },
          {
            role: 'assistant',
            id: 'msg-2',
            parts: [
              {
                type: 'tool-testTool' as const,
                toolCallId: 'call-1',
                state: 'output-available',
                input: { value: 'test' },
                output: { result: 'success' },
              },
            ],
          },
        ],
        // Note: originalMessages is NOT provided, relying on auto-population
        onFinish: ({ messages }) => {
          onFinishCalled = true;
          finishMessages = messages;
        },
      });

      // Consume the response to trigger onFinish
      const decoder = new TextDecoder();
      const encodedStream = response.body!;
      const chunks = await convertReadableStreamToArray(encodedStream);
      const decodedChunks = chunks.map(chunk => decoder.decode(chunk));

      // Verify stream completed successfully
      expect(
        decodedChunks.some(chunk => chunk.includes('"type":"finish"')),
      ).toBe(true);

      // Verify onFinish was called with messages
      expect(onFinishCalled).toBe(true);
      expect(finishMessages).toBeDefined();
      expect(finishMessages!.length).toBe(2);
    });
  });

  it('should pass sandbox to tool execution', async () => {
    const sandbox = {
      description: 'test sandbox',
      run: async () => ({
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
      }),
      ...mockSandboxSessionFileStubs,
    } satisfies SandboxSession;
    let receivedSandbox: SandboxSession | undefined;
    let callCount = 0;

    const agent = new ToolLoopAgent({
      model: new MockLanguageModelV4({
        doStream: async () => {
          callCount++;

          if (callCount === 1) {
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
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'testTool',
                  input: '{ "value": "test" }',
                },
                {
                  type: 'finish',
                  finishReason: {
                    unified: 'tool-calls',
                    raw: 'tool-calls',
                  },
                  usage: {
                    inputTokens: {
                      total: 5,
                      noCache: 5,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 5,
                      text: 5,
                      reasoning: undefined,
                    },
                  },
                  providerMetadata: undefined,
                },
              ]),
            };
          }

          return {
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-1',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Done' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: {
                  unified: 'stop',
                  raw: 'stop',
                },
                usage: {
                  inputTokens: {
                    total: 5,
                    noCache: 5,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 5,
                    text: 5,
                    reasoning: undefined,
                  },
                },
                providerMetadata: undefined,
              },
            ]),
          };
        },
      }),
      tools: {
        testTool: tool({
          description: 'Test tool',
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }, { experimental_sandbox: sandbox }) => {
            receivedSandbox = sandbox;
            return `${value}-result`;
          },
        }),
      },
    });

    const response = await createAgentUIStreamResponse({
      agent,
      uiMessages: [
        {
          role: 'user',
          id: 'msg-1',
          parts: [{ type: 'text' as const, text: 'Run the test tool' }],
        },
      ],
      experimental_sandbox: sandbox,
    });

    await convertReadableStreamToArray(response.body!);

    expect(receivedSandbox).toBe(sandbox);
  });
});
