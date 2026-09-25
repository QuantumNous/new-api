import { describe, it, expect } from 'vitest';
import {
  formatInputMessages,
  formatModelMessages,
  formatOutputMessages,
  formatObjectOutputMessages,
  formatSystemInstructions,
  extractSystemFromPrompt,
  mapProviderName,
  mapOperationName,
} from './gen-ai-format-messages';
import type { LanguageModelV4Prompt } from '@ai-sdk/provider';

describe('mapProviderName', () => {
  it('should map known providers to well-known values', () => {
    expect({
      anthropic: mapProviderName('anthropic.messages'),
      openai: mapProviderName('openai.chat'),
      googleGemini: mapProviderName('google.generative-ai'),
      mistral: mapProviderName('mistral.chat'),
      groq: mapProviderName('groq.chat'),
      deepseek: mapProviderName('deepseek.chat'),
    }).toMatchInlineSnapshot(`
      {
        "anthropic": "anthropic",
        "deepseek": "deepseek",
        "googleGemini": "gcp.gemini",
        "groq": "groq",
        "mistral": "mistral_ai",
        "openai": "openai",
      }
    `);
  });

  it('should map google vertex provider strings', () => {
    expect({
      vertexChat: mapProviderName('google.vertex.chat'),
      vertexEmbedding: mapProviderName('google.vertex.embedding'),
      vertexImage: mapProviderName('google.vertex.image'),
      googleVertex: mapProviderName('google-vertex'),
    }).toMatchInlineSnapshot(`
      {
        "googleVertex": "gcp.vertex_ai",
        "vertexChat": "gcp.vertex_ai",
        "vertexEmbedding": "gcp.vertex_ai",
        "vertexImage": "gcp.vertex_ai",
      }
    `);
  });

  it('should map bare google prefix to gcp.gemini', () => {
    expect(mapProviderName('google.chat')).toMatchInlineSnapshot(
      `"gcp.gemini"`,
    );
  });

  it('should map bedrock provider', () => {
    expect({
      amazonBedrock: mapProviderName('amazon-bedrock.chat'),
      bedrock: mapProviderName('bedrock.chat'),
    }).toMatchInlineSnapshot(`
      {
        "amazonBedrock": "aws.bedrock",
        "bedrock": "aws.bedrock",
      }
    `);
  });

  it('should map azure providers', () => {
    expect({
      azureChat: mapProviderName('azure.chat'),
      azureOpenai: mapProviderName('azure-openai.chat'),
    }).toMatchInlineSnapshot(`
      {
        "azureChat": "azure.ai.inference",
        "azureOpenai": "azure.ai.openai",
      }
    `);
  });

  it('should return the original string for unknown providers', () => {
    expect(mapProviderName('custom-provider.chat')).toMatchInlineSnapshot(
      `"custom-provider.chat"`,
    );
  });
});

describe('mapOperationName', () => {
  it('should map generateText/streamText to invoke_agent', () => {
    expect({
      generateText: mapOperationName('ai.generateText'),
      streamText: mapOperationName('ai.streamText'),
    }).toMatchInlineSnapshot(`
      {
        "generateText": "invoke_agent",
        "streamText": "invoke_agent",
      }
    `);
  });

  it('should map generateObject/streamObject to invoke_agent', () => {
    expect({
      generateObject: mapOperationName('ai.generateObject'),
      streamObject: mapOperationName('ai.streamObject'),
    }).toMatchInlineSnapshot(`
      {
        "generateObject": "invoke_agent",
        "streamObject": "invoke_agent",
      }
    `);
  });

  it('should map embed/embedMany to embeddings', () => {
    expect({
      embed: mapOperationName('ai.embed'),
      embedMany: mapOperationName('ai.embedMany'),
    }).toMatchInlineSnapshot(`
      {
        "embed": "embeddings",
        "embedMany": "embeddings",
      }
    `);
  });

  it('should map rerank to rerank', () => {
    expect(mapOperationName('ai.rerank')).toMatchInlineSnapshot(`"rerank"`);
  });

  it('should return the original string for unknown operations', () => {
    expect(mapOperationName('ai.unknown')).toMatchInlineSnapshot(
      `"ai.unknown"`,
    );
  });
});

describe('formatSystemInstructions', () => {
  it('should format a system string into SemConv system instructions', () => {
    expect(formatSystemInstructions('You are a helpful assistant.'))
      .toMatchInlineSnapshot(`
      [
        {
          "content": "You are a helpful assistant.",
          "type": "text",
        },
      ]
    `);
  });
});

describe('extractSystemFromPrompt', () => {
  it('should extract system message from prompt', () => {
    const prompt: LanguageModelV4Prompt = [
      { role: 'system', content: 'Be helpful' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
    ];
    expect(extractSystemFromPrompt(prompt)).toMatchInlineSnapshot(
      `"Be helpful"`,
    );
  });

  it('should return undefined when no system message', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
    ];
    expect(extractSystemFromPrompt(prompt)).toMatchInlineSnapshot(`undefined`);
  });
});

describe('formatInputMessages', () => {
  it('should convert user text messages', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'What is the weather?' }],
      },
    ];
    expect(formatInputMessages(prompt)).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "content": "What is the weather?",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should exclude system messages', () => {
    const prompt: LanguageModelV4Prompt = [
      { role: 'system', content: 'Be helpful' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
    ];
    expect(formatInputMessages(prompt)).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "content": "Hello",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should convert assistant messages with tool calls', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'get_weather',
            input: { city: 'Paris' },
          },
        ],
      },
    ];
    expect(formatInputMessages(prompt)).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "arguments": {
                "city": "Paris",
              },
              "id": "call_123",
              "name": "get_weather",
              "type": "tool_call",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should convert tool result messages', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'get_weather',
            output: { type: 'text', value: 'Sunny, 72°F' },
          },
        ],
      },
    ];
    expect(formatInputMessages(prompt)).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "id": "call_123",
              "response": "Sunny, 72°F",
              "type": "tool_call_response",
            },
          ],
          "role": "tool",
        },
      ]
    `);
  });

  it('should convert file parts to blob parts', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: 'base64data' },
            mediaType: 'image/png',
          },
        ],
      },
    ];
    expect(formatInputMessages(prompt)).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "content": "base64data",
              "mime_type": "image/png",
              "modality": "image",
              "type": "blob",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should convert URL file parts to uri parts', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'url' as const,
              url: new URL('https://example.com/image.png'),
            },
            mediaType: 'image/png',
          },
        ],
      },
    ];
    expect(formatInputMessages(prompt)).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "mime_type": "image/png",
              "modality": "image",
              "type": "uri",
              "uri": "https://example.com/image.png",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should convert reasoning parts', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Let me think about this...',
          },
        ],
      },
    ];
    expect(formatInputMessages(prompt)).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "content": "Let me think about this...",
              "type": "reasoning",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });
});

describe('formatOutputMessages', () => {
  it('should format text-only output', () => {
    expect(
      formatOutputMessages({
        text: 'Hello world',
        finishReason: 'stop',
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "finish_reason": "stop",
          "parts": [
            {
              "content": "Hello world",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should format output with reasoning', () => {
    expect(
      formatOutputMessages({
        text: 'The answer is 42',
        reasoning: [{ text: 'Let me think...' }],
        finishReason: 'stop',
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "finish_reason": "stop",
          "parts": [
            {
              "content": "Let me think...",
              "type": "reasoning",
            },
            {
              "content": "The answer is 42",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should format output with tool calls', () => {
    expect(
      formatOutputMessages({
        toolCalls: [
          {
            toolCallId: 'call_abc',
            toolName: 'get_weather',
            input: { city: 'Paris' },
          },
        ],
        finishReason: 'tool-calls',
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "finish_reason": "tool_call",
          "parts": [
            {
              "arguments": {
                "city": "Paris",
              },
              "id": "call_abc",
              "name": "get_weather",
              "type": "tool_call",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should format output with files', () => {
    expect(
      formatOutputMessages({
        files: [{ mediaType: 'image/png', base64: 'abc123' }],
        finishReason: 'stop',
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "finish_reason": "stop",
          "parts": [
            {
              "content": "abc123",
              "mime_type": "image/png",
              "modality": "image",
              "type": "blob",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should combine reasoning, text, tool calls, and files', () => {
    expect(
      formatOutputMessages({
        text: 'Here is the result',
        reasoning: [{ text: 'Thinking...' }],
        toolCalls: [
          {
            toolCallId: 'tc1',
            toolName: 'search',
            input: { q: 'test' },
          },
        ],
        files: [{ mediaType: 'image/jpeg', base64: 'data' }],
        finishReason: 'stop',
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "finish_reason": "stop",
          "parts": [
            {
              "content": "Thinking...",
              "type": "reasoning",
            },
            {
              "content": "Here is the result",
              "type": "text",
            },
            {
              "arguments": {
                "q": "test",
              },
              "id": "tc1",
              "name": "search",
              "type": "tool_call",
            },
            {
              "content": "data",
              "mime_type": "image/jpeg",
              "modality": "image",
              "type": "blob",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should map finish reasons correctly', () => {
    expect({
      stop: formatOutputMessages({ finishReason: 'stop' })[0].finish_reason,
      length: formatOutputMessages({ finishReason: 'length' })[0].finish_reason,
      toolCalls: formatOutputMessages({ finishReason: 'tool-calls' })[0]
        .finish_reason,
      contentFilter: formatOutputMessages({ finishReason: 'content-filter' })[0]
        .finish_reason,
    }).toMatchInlineSnapshot(`
      {
        "contentFilter": "content_filter",
        "length": "length",
        "stop": "stop",
        "toolCalls": "tool_call",
      }
    `);
  });
});

describe('formatObjectOutputMessages', () => {
  it('should format object output as text content', () => {
    expect(
      formatObjectOutputMessages({
        objectText: '{"name":"test"}',
        finishReason: 'stop',
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "finish_reason": "stop",
          "parts": [
            {
              "content": "{"name":"test"}",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });
});

describe('formatModelMessages', () => {
  it('should convert a prompt string to a user message', () => {
    expect(formatModelMessages({ prompt: 'Hello', messages: undefined }))
      .toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "content": "Hello",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should convert ModelMessage array from prompt', () => {
    expect(
      formatModelMessages({
        prompt: [
          { role: 'user', content: 'Hi there' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'tc1',
                toolName: 'weather',
                input: { city: 'NYC' },
              },
            ],
          },
        ],
        messages: undefined,
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "content": "Hi there",
              "type": "text",
            },
          ],
          "role": "user",
        },
        {
          "parts": [
            {
              "arguments": {
                "city": "NYC",
              },
              "id": "tc1",
              "name": "weather",
              "type": "tool_call",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should exclude system messages', () => {
    expect(
      formatModelMessages({
        prompt: undefined,
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "content": "Hello",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should convert tool messages', () => {
    expect(
      formatModelMessages({
        prompt: undefined,
        messages: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'tc1',
                toolName: 'weather',
                output: { type: 'text', value: 'Sunny' },
              },
            ],
          },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "id": "tc1",
              "response": "Sunny",
              "type": "tool_call_response",
            },
          ],
          "role": "tool",
        },
      ]
    `);
  });

  it('should combine prompt and messages', () => {
    expect(
      formatModelMessages({
        prompt: 'First message',
        messages: [{ role: 'user', content: 'Second message' }],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "parts": [
            {
              "content": "First message",
              "type": "text",
            },
          ],
          "role": "user",
        },
        {
          "parts": [
            {
              "content": "Second message",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should return empty array when both prompt and messages are undefined', () => {
    expect(
      formatModelMessages({ prompt: undefined, messages: undefined }),
    ).toMatchInlineSnapshot(`[]`);
  });
});
