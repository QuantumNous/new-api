import { describe, expect, it } from 'vitest';
import { pruneMessages } from './prune-messages';
import { convertToModelMessages } from '../ui/convert-to-model-messages';
import type { ModelMessage } from '@ai-sdk/provider-utils';

const messagesFixture1: ModelMessage[] = [
  {
    role: 'user',
    content: [{ type: 'text', text: 'Weather in Tokyo and Busan?' }],
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'reasoning',
        text: 'I need to get the weather in Tokyo and Busan.',
      },
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get-weather-tool-1',
        input: '{"city": "Tokyo"}',
      },
      {
        type: 'tool-call',
        toolCallId: 'call-2',
        toolName: 'get-weather-tool-2',
        input: '{"city": "Busan"}',
      },
      {
        type: 'tool-approval-request',
        toolCallId: 'call-2',
        approvalId: 'approval-1',
      },
    ],
  },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-approval-response',
        approvalId: 'approval-1',
        approved: true,
      },
      {
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'get-weather-tool-1',
        output: {
          type: 'text',
          value: 'sunny',
        },
      },
      {
        type: 'tool-result',
        toolCallId: 'call-2',
        toolName: 'get-weather-tool-2',
        output: {
          type: 'error-text',
          value: 'Error: Fetching weather data failed',
        },
      },
    ],
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'reasoning',
        text: 'I have got the weather in Tokyo and Busan.',
      },
      {
        type: 'text',
        text: 'The weather in Tokyo is sunny. I could not get the weather in Busan.',
      },
    ],
  },
];

const messagesFixture2: ModelMessage[] = [
  {
    role: 'user',
    content: [{ type: 'text', text: 'Weather in Tokyo and Busan?' }],
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'reasoning',
        text: 'I need to get the weather in Tokyo and Busan.',
      },
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get-weather-tool-1',
        input: '{"city": "Tokyo"}',
      },
      {
        type: 'tool-call',
        toolCallId: 'call-2',
        toolName: 'get-weather-tool-2',
        input: '{"city": "Busan"}',
      },
      {
        type: 'tool-approval-request',
        toolCallId: 'call-1',
        approvalId: 'approval-1',
      },
    ],
  },
];

const multiTurnToolCallMessagesFixture: ModelMessage[] = [
  {
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'ask me a question',
      },
    ],
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'What can i help you with',
      },
      {
        type: 'tool-call',
        toolCallId: 'toolu_01P9s4havAQSjDmS4eWT1N2V',
        toolName: 'AskUserQuestion',
        input: {
          question: 'What would you like help with today?',
          options: ['Tool 1 Option 1', 'Tool 1 Option 2', 'Tool 1 Option 3'],
        },
      },
    ],
  },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'toolu_01P9s4havAQSjDmS4eWT1N2V',
        toolName: 'AskUserQuestion',
        output: { type: 'text', value: 'Something else' },
      },
    ],
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'toolu_01TMAuwWKLmBoQtx7K88dxsQ',
        toolName: 'AskUserQuestion',
        input: {
          question: 'Ok what else?',
          options: ['Tool 2 Option 1', 'Tool 2 Option 2', 'Tool 2 Option 3'],
        },
      },
    ],
  },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'toolu_01TMAuwWKLmBoQtx7K88dxsQ',
        toolName: 'AskUserQuestion',
        output: {
          type: 'text',
          value: "Other - I'll describe it",
        },
      },
    ],
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'What would you like to discuss or work on?',
      },
    ],
  },
  {
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'never mind. lets end this conversation',
      },
    ],
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'ok, have a nice day',
      },
    ],
  },
  {
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'thank you',
      },
    ],
  },
];

describe('pruneMessages', () => {
  describe('reasoning', () => {
    describe('all', () => {
      it('should prune all reasoning parts', () => {
        const result = pruneMessages({
          messages: messagesFixture1,
          reasoning: 'all',
        });

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Weather in Tokyo and Busan?",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "input": "{"city": "Tokyo"}",
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
                  "type": "tool-call",
                },
                {
                  "input": "{"city": "Busan"}",
                  "toolCallId": "call-2",
                  "toolName": "get-weather-tool-2",
                  "type": "tool-call",
                },
                {
                  "approvalId": "approval-1",
                  "toolCallId": "call-2",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "approvalId": "approval-1",
                  "approved": true,
                  "type": "tool-approval-response",
                },
                {
                  "output": {
                    "type": "text",
                    "value": "sunny",
                  },
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
                  "type": "tool-result",
                },
                {
                  "output": {
                    "type": "error-text",
                    "value": "Error: Fetching weather data failed",
                  },
                  "toolCallId": "call-2",
                  "toolName": "get-weather-tool-2",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "text": "The weather in Tokyo is sunny. I could not get the weather in Busan.",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('before-trailing-message', () => {
      it('should prune the trailing message', () => {
        const result = pruneMessages({
          messages: messagesFixture1,
          reasoning: 'before-last-message',
        });

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Weather in Tokyo and Busan?",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "input": "{"city": "Tokyo"}",
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
                  "type": "tool-call",
                },
                {
                  "input": "{"city": "Busan"}",
                  "toolCallId": "call-2",
                  "toolName": "get-weather-tool-2",
                  "type": "tool-call",
                },
                {
                  "approvalId": "approval-1",
                  "toolCallId": "call-2",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "approvalId": "approval-1",
                  "approved": true,
                  "type": "tool-approval-response",
                },
                {
                  "output": {
                    "type": "text",
                    "value": "sunny",
                  },
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
                  "type": "tool-result",
                },
                {
                  "output": {
                    "type": "error-text",
                    "value": "Error: Fetching weather data failed",
                  },
                  "toolCallId": "call-2",
                  "toolName": "get-weather-tool-2",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "text": "I have got the weather in Tokyo and Busan.",
                  "type": "reasoning",
                },
                {
                  "text": "The weather in Tokyo is sunny. I could not get the weather in Busan.",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });
  });

  describe('toolCalls', () => {
    describe('all', () => {
      it('should prune all tool calls, results, errors, and approvals', () => {
        const result = pruneMessages({
          messages: messagesFixture1,
          toolCalls: 'all',
        });

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Weather in Tokyo and Busan?",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "text": "I need to get the weather in Tokyo and Busan.",
                  "type": "reasoning",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "text": "I have got the weather in Tokyo and Busan.",
                  "type": "reasoning",
                },
                {
                  "text": "The weather in Tokyo is sunny. I could not get the weather in Busan.",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('before-last-message', () => {
      it('should prune tool calls before last message', () => {
        const result = pruneMessages({
          messages: messagesFixture2,
          toolCalls: 'before-last-message',
        });

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Weather in Tokyo and Busan?",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "text": "I need to get the weather in Tokyo and Busan.",
                  "type": "reasoning",
                },
                {
                  "input": "{"city": "Tokyo"}",
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
                  "type": "tool-call",
                },
                {
                  "input": "{"city": "Busan"}",
                  "toolCallId": "call-2",
                  "toolName": "get-weather-tool-2",
                  "type": "tool-call",
                },
                {
                  "approvalId": "approval-1",
                  "toolCallId": "call-1",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });

      it('should prune tool calls and results from multi-turn conversation when last message has no tool calls', () => {
        const result = pruneMessages({
          messages: multiTurnToolCallMessagesFixture,
          toolCalls: 'before-last-message',
        });

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "ask me a question",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "text": "What can i help you with",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "text": "What would you like to discuss or work on?",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "text": "never mind. lets end this conversation",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "text": "ok, have a nice day",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "text": "thank you",
                  "type": "text",
                },
              ],
              "role": "user",
            },
          ]
        `);
      });
    });

    describe('before-last-2-messages', () => {
      it('should prune all tool calls, results, errors, and approvals', () => {
        const result = pruneMessages({
          messages: messagesFixture1,
          toolCalls: 'before-last-2-messages',
        });

        // there is backwards tracing from the included tool results to ensure
        // that the tool calls are included and there are no unassociated tool
        // result or approvals
        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Weather in Tokyo and Busan?",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "text": "I need to get the weather in Tokyo and Busan.",
                  "type": "reasoning",
                },
                {
                  "input": "{"city": "Tokyo"}",
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
                  "type": "tool-call",
                },
                {
                  "input": "{"city": "Busan"}",
                  "toolCallId": "call-2",
                  "toolName": "get-weather-tool-2",
                  "type": "tool-call",
                },
                {
                  "approvalId": "approval-1",
                  "toolCallId": "call-2",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "approvalId": "approval-1",
                  "approved": true,
                  "type": "tool-approval-response",
                },
                {
                  "output": {
                    "type": "text",
                    "value": "sunny",
                  },
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
                  "type": "tool-result",
                },
                {
                  "output": {
                    "type": "error-text",
                    "value": "Error: Fetching weather data failed",
                  },
                  "toolCallId": "call-2",
                  "toolName": "get-weather-tool-2",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "text": "I have got the weather in Tokyo and Busan.",
                  "type": "reasoning",
                },
                {
                  "text": "The weather in Tokyo is sunny. I could not get the weather in Busan.",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('two tool settings', () => {
      it('should prune all tool calls, results, errors, and approvals', () => {
        const result = pruneMessages({
          messages: messagesFixture1,
          toolCalls: [
            { type: 'all', tools: ['get-weather-tool-1'] },
            { type: 'before-last-2-messages', tools: ['get-weather-tool-2'] },
          ],
        });

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Weather in Tokyo and Busan?",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "text": "I need to get the weather in Tokyo and Busan.",
                  "type": "reasoning",
                },
                {
                  "input": "{"city": "Busan"}",
                  "toolCallId": "call-2",
                  "toolName": "get-weather-tool-2",
                  "type": "tool-call",
                },
                {
                  "approvalId": "approval-1",
                  "toolCallId": "call-2",
                  "type": "tool-approval-request",
                },
              ],
              "role": "assistant",
            },
            {
              "content": [
                {
                  "approvalId": "approval-1",
                  "approved": true,
                  "type": "tool-approval-response",
                },
                {
                  "output": {
                    "type": "error-text",
                    "value": "Error: Fetching weather data failed",
                  },
                  "toolCallId": "call-2",
                  "toolName": "get-weather-tool-2",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
            {
              "content": [
                {
                  "text": "I have got the weather in Tokyo and Busan.",
                  "type": "reasoning",
                },
                {
                  "text": "The weather in Tokyo is sunny. I could not get the weather in Busan.",
                  "type": "text",
                },
              ],
              "role": "assistant",
            },
          ]
        `);
      });
    });

    describe('selective tool pruning with approvals (regression)', () => {
      it('should prune the approval response together with its request and tool-call', async () => {
        const messages = JSON.parse(
          JSON.stringify(
            await convertToModelMessages([
              {
                role: 'user',
                parts: [
                  {
                    type: 'text',
                    text: 'Weather in Tokyo and Busan?',
                  },
                ],
              },
              {
                role: 'assistant',
                parts: [
                  {
                    type: 'step-start',
                  },
                  {
                    type: 'tool-get-weather-tool-1',
                    toolCallId: 'call-1',
                    state: 'output-available',
                    input: { city: 'Tokyo' },
                    output: 'sunny',
                  },
                  {
                    type: 'tool-get-weather-tool-2',
                    toolCallId: 'call-2',
                    state: 'output-available',
                    input: { city: 'Busan' },
                    output: 'rainy',
                    approval: {
                      id: 'approval-1',
                      approved: true,
                    },
                  },
                ],
              },
            ]),
          ),
        ) as ModelMessage[];

        const result = pruneMessages({
          messages,
          toolCalls: [{ type: 'all', tools: ['get-weather-tool-2'] }],
        });

        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Weather in Tokyo and Busan?",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "input": {
                    "city": "Tokyo",
                  },
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
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
                    "value": "sunny",
                  },
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
                  "type": "tool-result",
                },
              ],
              "role": "tool",
            },
          ]
        `);

        // No orphaned approval responses remain in the pruned output.
        const approvalIds = new Set<string>();
        const responseIds = new Set<string>();
        for (const message of result) {
          if (typeof message.content === 'string') continue;
          for (const part of message.content) {
            if (part.type === 'tool-approval-request') {
              approvalIds.add(part.approvalId);
            } else if (part.type === 'tool-approval-response') {
              responseIds.add(part.approvalId);
            }
          }
        }
        for (const id of responseIds) {
          expect(approvalIds).toContain(id);
        }
      });

      it('should drop unresolved approval responses during selective pruning', () => {
        const messages: ModelMessage[] = [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Weather in Tokyo and Busan?' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'get-weather-tool-1',
                input: { city: 'Tokyo' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'unknown-approval',
                approved: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'get-weather-tool-1',
                output: { type: 'text', value: 'sunny' },
              },
            ],
          },
        ];

        const result = pruneMessages({
          messages,
          toolCalls: [{ type: 'all', tools: ['get-weather-tool-2'] }],
        });

        // The unresolved approval response must not survive as authority
        // context; only get-weather-tool-1 parts remain.
        expect(result).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "Weather in Tokyo and Busan?",
                  "type": "text",
                },
              ],
              "role": "user",
            },
            {
              "content": [
                {
                  "input": {
                    "city": "Tokyo",
                  },
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
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
                    "value": "sunny",
                  },
                  "toolCallId": "call-1",
                  "toolName": "get-weather-tool-1",
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
});
