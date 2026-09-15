import { tool } from '@ai-sdk/provider-utils';
import z from 'zod/v4';
import { DefaultGeneratedFile } from './generated-file';
import { toResponseMessages } from './to-response-messages';
import { describe, it, expect } from 'vitest';

describe('toResponseMessages', () => {
  it('should return an assistant message with text when no tool calls or results', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Hello, world!',
        },
      ],
      tools: {
        testTool: tool({
          description: 'A test tool',
          inputSchema: z.object({}),
        }),
      },
    });

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, world!' }],
      },
    ]);
  });

  it('should include tool calls in the assistant message', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Using a tool',
        },
        {
          type: 'tool-call',
          toolCallId: '123',
          toolName: 'testTool',
          input: {},
        },
      ],
      tools: {
        testTool: tool({
          description: 'A test tool',
          inputSchema: z.object({}),
        }),
      },
    });

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Using a tool' },
          {
            type: 'tool-call',
            toolCallId: '123',
            toolName: 'testTool',
            input: {},
          },
        ],
      },
    ]);
  });

  it('should include tool calls with metadata in the assistant message', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Using a tool',
        },
        {
          type: 'tool-call',
          toolCallId: '123',
          toolName: 'testTool',
          input: {},
          providerMetadata: {
            testProvider: {
              signature: 'sig',
            },
          },
        },
      ],
      tools: {
        testTool: tool({
          description: 'A test tool',
          inputSchema: z.object({}),
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "providerOptions": undefined,
              "text": "Using a tool",
              "type": "text",
            },
            {
              "input": {},
              "providerExecuted": undefined,
              "providerOptions": {
                "testProvider": {
                  "signature": "sig",
                },
              },
              "toolCallId": "123",
              "toolName": "testTool",
              "type": "tool-call",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should include custom parts in the assistant message', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'custom',
          kind: 'mock-provider.compaction',
          providerMetadata: {
            openai: {
              itemId: 'cmp_123',
            },
          },
        },
      ],
      tools: undefined,
    });

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'custom',
            kind: 'mock-provider.compaction',
            providerOptions: {
              openai: {
                itemId: 'cmp_123',
              },
            },
          },
        ],
      },
    ]);
  });

  it('should include tool results as a separate message', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Tool used',
        },
        {
          type: 'tool-call',
          toolCallId: '123',
          toolName: 'testTool',
          input: {},
        },
        {
          type: 'tool-result',
          toolCallId: '123',
          toolName: 'testTool',
          output: 'Tool result',
          input: {},
        },
      ],
      tools: {
        testTool: tool({
          description: 'A test tool',
          inputSchema: z.object({}),
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "providerOptions": undefined,
              "text": "Tool used",
              "type": "text",
            },
            {
              "input": {},
              "providerExecuted": undefined,
              "providerOptions": undefined,
              "toolCallId": "123",
              "toolName": "testTool",
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
                "value": "Tool result",
              },
              "toolCallId": "123",
              "toolName": "testTool",
              "type": "tool-result",
            },
          ],
          "role": "tool",
        },
      ]
    `);
  });

  it('should include tool errors as a separate message', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Tool used',
        },
        {
          type: 'tool-call',
          toolCallId: '123',
          toolName: 'testTool',
          input: {},
        },
        {
          type: 'tool-error',
          toolCallId: '123',
          toolName: 'testTool',
          error: 'Tool error',
          input: {},
        },
      ],
      tools: {
        testTool: tool({
          description: 'A test tool',
          inputSchema: z.object({}),
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "providerOptions": undefined,
              "text": "Tool used",
              "type": "text",
            },
            {
              "input": {},
              "providerExecuted": undefined,
              "providerOptions": undefined,
              "toolCallId": "123",
              "toolName": "testTool",
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
                "value": "Tool error",
              },
              "toolCallId": "123",
              "toolName": "testTool",
              "type": "tool-result",
            },
          ],
          "role": "tool",
        },
      ]
    `);
  });

  it('should serialize parallel tool results in tool call order', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Using tools',
        },
        {
          type: 'tool-call',
          toolCallId: 'call-a',
          toolName: 'toolA',
          input: {},
        },
        {
          type: 'tool-call',
          toolCallId: 'call-b',
          toolName: 'toolB',
          input: {},
        },
        // Simulates parallel execution where toolB resolved before toolA.
        {
          type: 'tool-result',
          toolCallId: 'call-b',
          toolName: 'toolB',
          output: 'B result',
          input: {},
        },
        {
          type: 'tool-result',
          toolCallId: 'call-a',
          toolName: 'toolA',
          output: 'A result',
          input: {},
        },
      ],
      tools: {
        toolA: tool({
          description: 'Tool A',
          inputSchema: z.object({}),
        }),
        toolB: tool({
          description: 'Tool B',
          inputSchema: z.object({}),
        }),
      },
    });

    const toolMessage = result[1];
    expect(toolMessage?.role).toBe('tool');
    if (toolMessage?.role !== 'tool') {
      throw new Error('Expected a tool message');
    }
    expect(
      toolMessage.content
        .filter(part => part.type === 'tool-result')
        .map(part => part.toolCallId),
    ).toEqual(['call-a', 'call-b']);
  });

  it('should handle undefined text', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'reasoning',
          text: 'Thinking text',
          providerMetadata: {
            testProvider: {
              signature: 'sig',
            },
          },
        },
      ],
      tools: {},
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "providerOptions": {
                "testProvider": {
                  "signature": "sig",
                },
              },
              "text": "Thinking text",
              "type": "reasoning",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should include reasoning array with redacted reasoning in the assistant message', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'reasoning',
          text: 'redacted-data',
          providerMetadata: {
            testProvider: { isRedacted: true },
          },
        },
        {
          type: 'reasoning',
          text: 'Thinking text',
          providerMetadata: {
            testProvider: { signature: 'sig' },
          },
        },
        {
          type: 'text',
          text: 'Final text',
        },
      ],
      tools: {},
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "providerOptions": {
                "testProvider": {
                  "isRedacted": true,
                },
              },
              "text": "redacted-data",
              "type": "reasoning",
            },
            {
              "providerOptions": {
                "testProvider": {
                  "signature": "sig",
                },
              },
              "text": "Thinking text",
              "type": "reasoning",
            },
            {
              "providerOptions": undefined,
              "text": "Final text",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should handle multipart tool results', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'multipart tool result',
        },
        {
          type: 'tool-call',
          toolCallId: '123',
          toolName: 'testTool',
          input: {},
        },
        {
          type: 'tool-result',
          toolCallId: '123',
          toolName: 'testTool',
          output: 'image-base64',
          input: {},
        },
      ],
      tools: {
        testTool: tool({
          description: 'A test tool',
          inputSchema: z.object({}),
          toModelOutput: () => ({
            type: 'json',
            value: {
              proof: 'that toModelOutput is called',
            },
          }),
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "providerOptions": undefined,
              "text": "multipart tool result",
              "type": "text",
            },
            {
              "input": {},
              "providerExecuted": undefined,
              "providerOptions": undefined,
              "toolCallId": "123",
              "toolName": "testTool",
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
                  "proof": "that toModelOutput is called",
                },
              },
              "toolCallId": "123",
              "toolName": "testTool",
              "type": "tool-result",
            },
          ],
          "role": "tool",
        },
      ]
    `);
  });

  it('should include reasoning-file parts in the assistant message', async () => {
    const pngFile = new DefaultGeneratedFile({
      data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      mediaType: 'image/png',
    });

    const result = await toResponseMessages({
      content: [
        {
          type: 'reasoning-file',
          file: pngFile,
          providerMetadata: {
            testProvider: { signature: 'sig' },
          },
        },
        {
          type: 'text',
          text: 'Here is my analysis',
        },
      ],
      tools: {},
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "data": "iVBORw0KGgo=",
              "mediaType": "image/png",
              "providerOptions": {
                "testProvider": {
                  "signature": "sig",
                },
              },
              "type": "reasoning-file",
            },
            {
              "providerOptions": undefined,
              "text": "Here is my analysis",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should include images in the assistant message', async () => {
    const pngFile = new DefaultGeneratedFile({
      data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      mediaType: 'image/png',
    });

    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Here is an image',
        },
        { type: 'file', file: pngFile },
      ],
      tools: {},
    });

    expect(result).toStrictEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Here is an image',
            providerOptions: undefined,
          },
          {
            type: 'file',
            data: pngFile.base64,
            mediaType: pngFile.mediaType,
            providerOptions: undefined,
          },
        ],
      },
    ]);
  });

  it('should handle multiple images in the assistant message', async () => {
    const pngFile = new DefaultGeneratedFile({
      data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      mediaType: 'image/png',
    });
    const jpegFile = new DefaultGeneratedFile({
      data: new Uint8Array([255, 216, 255]),
      mediaType: 'image/jpeg',
    });

    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Here are multiple images',
        },
        { type: 'file', file: pngFile },
        { type: 'file', file: jpegFile },
      ],
      tools: {},
    });

    expect(result).toStrictEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Here are multiple images',
            providerOptions: undefined,
          },
          {
            type: 'file',
            data: pngFile.base64,
            mediaType: pngFile.mediaType,
            providerOptions: undefined,
          },
          {
            type: 'file',
            data: jpegFile.base64,
            mediaType: jpegFile.mediaType,
            providerOptions: undefined,
          },
        ],
      },
    ]);
  });

  it('should handle Uint8Array images', async () => {
    const pngFile = new DefaultGeneratedFile({
      data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      mediaType: 'image/png',
    });

    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Here is a binary image',
        },
        { type: 'file', file: pngFile },
      ],
      tools: {},
    });

    expect(result).toStrictEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Here is a binary image',
            providerOptions: undefined,
          },
          {
            type: 'file',
            data: pngFile.base64,
            mediaType: pngFile.mediaType,
            providerOptions: undefined,
          },
        ],
      },
    ]);
  });

  it('should include images, reasoning, and tool calls in the correct order', async () => {
    const pngFile = new DefaultGeneratedFile({
      data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      mediaType: 'image/png',
    });

    const result = await toResponseMessages({
      content: [
        {
          type: 'reasoning',
          text: 'Thinking text',
          providerMetadata: { testProvider: { signature: 'sig' } },
        },
        { type: 'file', file: pngFile },
        {
          type: 'text',
          text: 'Combined response',
        },
        {
          type: 'tool-call',
          toolCallId: '123',
          toolName: 'testTool',
          input: {},
        },
      ],
      tools: {
        testTool: tool({
          description: 'A test tool',
          inputSchema: z.object({}),
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "providerOptions": {
                "testProvider": {
                  "signature": "sig",
                },
              },
              "text": "Thinking text",
              "type": "reasoning",
            },
            {
              "data": "iVBORw0KGgo=",
              "mediaType": "image/png",
              "providerOptions": undefined,
              "type": "file",
            },
            {
              "providerOptions": undefined,
              "text": "Combined response",
              "type": "text",
            },
            {
              "input": {},
              "providerExecuted": undefined,
              "providerOptions": undefined,
              "toolCallId": "123",
              "toolName": "testTool",
              "type": "tool-call",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should not append text parts if text is empty string', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: '',
        },
        {
          type: 'tool-call',
          toolCallId: '123',
          toolName: 'testTool',
          input: {},
        },
      ],
      tools: {
        testTool: tool({
          description: 'A test tool',
          inputSchema: z.object({}),
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "input": {},
              "providerExecuted": undefined,
              "providerOptions": undefined,
              "toolCallId": "123",
              "toolName": "testTool",
              "type": "tool-call",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should not append assistant message if there is no content', async () => {
    const result = await toResponseMessages({
      content: [],
      tools: {},
    });

    expect(result).toEqual([]);
  });

  describe('provider-executed tool calls', () => {
    it('should include provider-executed tool calls and results', async () => {
      const result = await toResponseMessages({
        content: [
          {
            type: 'text',
            text: 'Let me search for recent news from San Francisco.',
          },
          {
            type: 'tool-call',
            toolCallId: 'srvtoolu_011cNtbtzFARKPcAcp7w4nh9',
            toolName: 'web_search',
            input: {
              query: 'San Francisco major news events June 22 2025',
            },
            providerExecuted: true,
          },
          {
            type: 'tool-result',
            toolCallId: 'srvtoolu_011cNtbtzFARKPcAcp7w4nh9',
            toolName: 'web_search',
            input: {
              query: 'San Francisco major news events June 22 2025',
            },
            output: [
              { url: 'https://patch.com/california/san-francisco/calendar' },
            ],
            providerExecuted: true,
          },
          {
            type: 'text',
            text: 'Based on the search results, several significant events took place in San Francisco yesterday (June 22, 2025). Here are the main highlights:\n\n1. Juneteenth Celebration:\n',
          },
        ],
        tools: {
          web_search: tool({
            type: 'provider',
            id: 'test.web_search',
            isProviderExecuted: true,
            inputSchema: z.object({
              query: z.string(),
            }),
            outputSchema: z.array(
              z.object({
                url: z.string(),
              }),
            ),
            args: {},
          }),
        },
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "providerOptions": undefined,
                "text": "Let me search for recent news from San Francisco.",
                "type": "text",
              },
              {
                "input": {
                  "query": "San Francisco major news events June 22 2025",
                },
                "providerExecuted": true,
                "providerOptions": undefined,
                "toolCallId": "srvtoolu_011cNtbtzFARKPcAcp7w4nh9",
                "toolName": "web_search",
                "type": "tool-call",
              },
              {
                "output": {
                  "type": "json",
                  "value": [
                    {
                      "url": "https://patch.com/california/san-francisco/calendar",
                    },
                  ],
                },
                "providerOptions": undefined,
                "toolCallId": "srvtoolu_011cNtbtzFARKPcAcp7w4nh9",
                "toolName": "web_search",
                "type": "tool-result",
              },
              {
                "providerOptions": undefined,
                "text": "Based on the search results, several significant events took place in San Francisco yesterday (June 22, 2025). Here are the main highlights:

        1. Juneteenth Celebration:
        ",
                "type": "text",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });

  describe('tool approval request', () => {
    it('should include tool approval request in the assistant message', async () => {
      const result = await toResponseMessages({
        content: [
          {
            type: 'text',
            text: 'Let me check the weather',
          },
          {
            type: 'tool-call',
            toolCallId: '123',
            toolName: 'weather',
            input: { city: 'Tokyo' },
          },
          {
            type: 'tool-approval-request',
            approvalId: 'approval-1',
            toolCall: {
              type: 'tool-call',
              toolCallId: '123',
              toolName: 'weather',
              input: { city: 'Tokyo' },
            },
          },
        ],
        tools: {
          weather: tool({
            description: 'Get weather information',
            inputSchema: z.object({ city: z.string() }),
          }),
        },
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "providerOptions": undefined,
                "text": "Let me check the weather",
                "type": "text",
              },
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "123",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": undefined,
                "toolCallId": "123",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should include tool approval request for provider-executed tools', async () => {
      const result = await toResponseMessages({
        content: [
          {
            type: 'tool-call',
            toolCallId: 'mcp-call-1',
            toolName: 'mcp_tool',
            input: { query: 'test' },
            providerExecuted: true,
            dynamic: true,
          },
          {
            type: 'tool-approval-request',
            approvalId: 'mcp-approval-1',
            toolCall: {
              type: 'tool-call',
              toolCallId: 'mcp-call-1',
              toolName: 'mcp_tool',
              input: { query: 'test' },
              providerExecuted: true,
              dynamic: true,
            },
          },
        ],
        tools: {},
      });

      expect(result).toMatchInlineSnapshot(`
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

    it('should preserve automatic approval request stage in the assistant message', async () => {
      const result = await toResponseMessages({
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'weather',
            input: { city: 'Tokyo' },
          },
          {
            type: 'tool-approval-request',
            approvalId: 'approval-1',
            toolCall: {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'weather',
              input: { city: 'Tokyo' },
            },
            isAutomatic: true,
          },
        ],
        tools: {
          weather: tool({
            description: 'Get weather information',
            inputSchema: z.object({ city: z.string() }),
          }),
        },
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
                "isAutomatic": true,
                "toolCallId": "call-1",
                "type": "tool-approval-request",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });

    it('should include approval response and tool result stages in the tool message', async () => {
      const result = await toResponseMessages({
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'weather',
            input: { city: 'Tokyo' },
          },
          {
            type: 'tool-approval-request',
            approvalId: 'approval-1',
            toolCall: {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'weather',
              input: { city: 'Tokyo' },
            },
            isAutomatic: true,
          },
          {
            type: 'tool-approval-response',
            approvalId: 'approval-1',
            approved: true,
            toolCall: {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'weather',
              input: { city: 'Tokyo' },
            },
          },
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'weather',
            input: { city: 'Tokyo' },
            output: '72F and sunny',
          },
        ],
        tools: {
          weather: tool({
            description: 'Get weather information',
            inputSchema: z.object({ city: z.string() }),
          }),
        },
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
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
                "approvalId": "approval-1",
                "approved": true,
                "providerExecuted": undefined,
                "reason": undefined,
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "type": "text",
                  "value": "72F and sunny",
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should add an execution-denied tool result when tool approval is denied', async () => {
      const result = await toResponseMessages({
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'weather',
            input: { city: 'Tokyo' },
          },
          {
            type: 'tool-approval-request',
            approvalId: 'approval-1',
            toolCall: {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'weather',
              input: { city: 'Tokyo' },
            },
          },
          {
            type: 'tool-approval-response',
            approvalId: 'approval-1',
            approved: false,
            reason: 'User denied access',
            toolCall: {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'weather',
              input: { city: 'Tokyo' },
            },
          },
        ],
        tools: {
          weather: tool({
            description: 'Get weather information',
            inputSchema: z.object({ city: z.string() }),
          }),
        },
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "input": {
                  "city": "Tokyo",
                },
                "providerExecuted": undefined,
                "providerOptions": undefined,
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-call",
              },
              {
                "approvalId": "approval-1",
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
                "approvalId": "approval-1",
                "approved": false,
                "providerExecuted": undefined,
                "reason": "User denied access",
                "type": "tool-approval-response",
              },
              {
                "output": {
                  "reason": "User denied access",
                  "type": "execution-denied",
                },
                "toolCallId": "call-1",
                "toolName": "weather",
                "type": "tool-result",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should include provider-executed approval response stages in the tool message', async () => {
      const result = await toResponseMessages({
        content: [
          {
            type: 'tool-call',
            toolCallId: 'mcp-call-1',
            toolName: 'mcp_tool',
            input: { query: 'test' },
            providerExecuted: true,
            dynamic: true,
          },
          {
            type: 'tool-approval-request',
            approvalId: 'mcp-approval-1',
            toolCall: {
              type: 'tool-call',
              toolCallId: 'mcp-call-1',
              toolName: 'mcp_tool',
              input: { query: 'test' },
              providerExecuted: true,
              dynamic: true,
            },
          },
          {
            type: 'tool-approval-response',
            approvalId: 'mcp-approval-1',
            approved: true,
            providerExecuted: true,
            toolCall: {
              type: 'tool-call',
              toolCallId: 'mcp-call-1',
              toolName: 'mcp_tool',
              input: { query: 'test' },
              providerExecuted: true,
              dynamic: true,
            },
          },
        ],
        tools: {},
      });

      expect(result).toMatchInlineSnapshot(`
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
          {
            "content": [
              {
                "approvalId": "mcp-approval-1",
                "approved": true,
                "providerExecuted": true,
                "reason": undefined,
                "type": "tool-approval-response",
              },
            ],
            "role": "tool",
          },
        ]
      `);
    });

    it('should keep provider-executed tool result stages in the assistant message only', async () => {
      const result = await toResponseMessages({
        content: [
          {
            type: 'tool-call',
            toolCallId: 'mcp-call-1',
            toolName: 'mcp_tool',
            input: { query: 'test' },
            providerExecuted: true,
            dynamic: true,
          },
          {
            type: 'tool-result',
            toolCallId: 'mcp-call-1',
            toolName: 'mcp_tool',
            input: { query: 'test' },
            output: { value: 'provider result' },
            providerExecuted: true,
            dynamic: true,
          },
        ],
        tools: {},
      });

      expect(result).toMatchInlineSnapshot(`
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
                "output": {
                  "type": "json",
                  "value": {
                    "value": "provider result",
                  },
                },
                "providerOptions": undefined,
                "toolCallId": "mcp-call-1",
                "toolName": "mcp_tool",
                "type": "tool-result",
              },
            ],
            "role": "assistant",
          },
        ]
      `);
    });
  });

  it('should sanitize invalid tool call with non-object input to empty object', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'weather',
          input: '{ city: San Francisco, }',
          dynamic: true,
          invalid: true,
          error: new Error('JSON parsing failed'),
        },
        {
          type: 'tool-error',
          toolCallId: 'call-1',
          toolName: 'weather',
          input: '{ city: San Francisco, }',
          error: 'Invalid input for tool weather: JSON parsing failed',
          dynamic: true,
        },
      ],
      tools: {
        weather: tool({
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "input": {},
              "providerExecuted": undefined,
              "providerOptions": undefined,
              "toolCallId": "call-1",
              "toolName": "weather",
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
                "value": "Invalid input for tool weather: JSON parsing failed",
              },
              "toolCallId": "call-1",
              "toolName": "weather",
              "type": "tool-result",
            },
          ],
          "role": "tool",
        },
      ]
    `);
  });

  it('should preserve valid object input on invalid tool call', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'weather',
          input: { cities: 'San Francisco' },
          dynamic: true,
          invalid: true,
          error: new Error('Type validation failed'),
        },
        {
          type: 'tool-error',
          toolCallId: 'call-1',
          toolName: 'weather',
          input: { cities: 'San Francisco' },
          error: 'Invalid input for tool weather: Type validation failed',
          dynamic: true,
        },
      ],
      tools: {
        weather: tool({
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
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
              "toolName": "weather",
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
                "value": "Invalid input for tool weather: Type validation failed",
              },
              "toolCallId": "call-1",
              "toolName": "weather",
              "type": "tool-result",
            },
          ],
          "role": "tool",
        },
      ]
    `);
  });

  it('should include provider metadata in the text parts', async () => {
    const result = await toResponseMessages({
      content: [
        {
          type: 'text',
          text: 'Here is a text',
          providerMetadata: { testProvider: { signature: 'sig' } },
        },
      ],
      tools: {},
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "providerOptions": {
                "testProvider": {
                  "signature": "sig",
                },
              },
              "text": "Here is a text",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });
});
