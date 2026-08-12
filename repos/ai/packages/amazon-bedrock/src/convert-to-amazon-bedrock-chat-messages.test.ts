import type { AmazonBedrockReasoningMetadata } from './amazon-bedrock-chat-language-model';
import { convertToAmazonBedrockChatMessages } from './convert-to-amazon-bedrock-chat-messages';
import { describe, it, expect } from 'vitest';

describe('system messages', () => {
  it('should combine multiple leading system messages into a single system message', async () => {
    const { system } = await convertToAmazonBedrockChatMessages([
      { role: 'system', content: 'Hello' },
      { role: 'system', content: 'World' },
    ]);

    expect(system).toEqual([{ text: 'Hello' }, { text: 'World' }]);
  });

  it('should throw an error if a system message is provided after a non-system message', async () => {
    await expect(
      convertToAmazonBedrockChatMessages([
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { role: 'system', content: 'World' },
      ]),
    ).rejects.toThrowError();
  });

  it('should set isSystemCachePoint when system message has cache point', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'system',
        content: 'Hello',
        providerOptions: { bedrock: { cachePoint: { type: 'default' } } },
      },
    ]);

    expect(result).toEqual({
      system: [{ text: 'Hello' }, { cachePoint: { type: 'default' } }],
      messages: [],
    });
  });

  it('should add cache point with 5m TTL to system message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'system',
        content: 'Hello',
        providerOptions: {
          bedrock: { cachePoint: { type: 'default', ttl: '5m' } },
        },
      },
    ]);

    expect(result).toEqual({
      system: [
        { text: 'Hello' },
        { cachePoint: { type: 'default', ttl: '5m' } },
      ],
      messages: [],
    });
  });

  it('should add cache point with 1h TTL to system message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'system',
        content: 'Hello',
        providerOptions: {
          bedrock: { cachePoint: { type: 'default', ttl: '1h' } },
        },
      },
    ]);

    expect(result).toEqual({
      system: [
        { text: 'Hello' },
        { cachePoint: { type: 'default', ttl: '1h' } },
      ],
      messages: [],
    });
  });
});

describe('user messages', () => {
  it('should convert messages with image parts', async () => {
    const imageData = new Uint8Array([0, 1, 2, 3]);

    const { messages } = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(imageData).toString('base64'),
            },
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          { text: 'Hello' },
          {
            image: {
              format: 'png',
              source: { bytes: 'AAECAw==' },
            },
          },
        ],
      },
    ]);
  });

  it('should convert messages with document parts', async () => {
    const fileData = new Uint8Array([0, 1, 2, 3]);

    const { messages } = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(fileData).toString('base64'),
            },
            mediaType: 'application/pdf',
          },
        ],
      },
    ]);

    expect(messages).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "text": "Hello",
            },
            {
              "document": {
                "format": "pdf",
                "name": "document-1",
                "source": {
                  "bytes": "AAECAw==",
                },
              },
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should strip file extension when filename is provided', async () => {
    const fileData = new Uint8Array([0, 1, 2, 3]);

    const { messages } = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(fileData).toString('base64'),
            },
            mediaType: 'application/pdf',
            filename: 'custom-filename.pdf',
          },
        ],
      },
    ]);

    expect(messages).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "text": "Hello",
            },
            {
              "document": {
                "format": "pdf",
                "name": "custom-filename",
                "source": {
                  "bytes": "AAECAw==",
                },
              },
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should preserve filename without extension when provided', async () => {
    const fileData = new Uint8Array([0, 1, 2, 3]);

    const { messages } = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(fileData).toString('base64'),
            },
            mediaType: 'application/pdf',
            filename: 'custom-filename',
          },
        ],
      },
    ]);

    expect(messages).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "document": {
                "format": "pdf",
                "name": "custom-filename",
                "source": {
                  "bytes": "AAECAw==",
                },
              },
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should use consistent document names for prompt cache effectiveness', async () => {
    const fileData1 = new Uint8Array([0, 1, 2, 3]);
    const fileData2 = new Uint8Array([4, 5, 6, 7]);

    const { messages } = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(fileData1).toString('base64'),
            },
            mediaType: 'application/pdf',
          },
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(fileData2).toString('base64'),
            },
            mediaType: 'application/pdf',
          },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'OK' }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(fileData1).toString('base64'),
            },
            mediaType: 'application/pdf',
          },
        ],
      },
    ]);

    expect(messages).toMatchInlineSnapshot(`
      [
        {
          "content": [
            {
              "document": {
                "format": "pdf",
                "name": "document-1",
                "source": {
                  "bytes": "AAECAw==",
                },
              },
            },
            {
              "document": {
                "format": "pdf",
                "name": "document-2",
                "source": {
                  "bytes": "BAUGBw==",
                },
              },
            },
          ],
          "role": "user",
        },
        {
          "content": [
            {
              "text": "OK",
            },
          ],
          "role": "assistant",
        },
        {
          "content": [
            {
              "document": {
                "format": "pdf",
                "name": "document-3",
                "source": {
                  "bytes": "AAECAw==",
                },
              },
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should extract the system message', async () => {
    const { system } = await convertToAmazonBedrockChatMessages([
      {
        role: 'system',
        content: 'Hello',
      },
    ]);

    expect(system).toEqual([{ text: 'Hello' }]);
  });

  it('should add cache point to user message content when specified', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
        providerOptions: { bedrock: { cachePoint: { type: 'default' } } },
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'Hello' }, { cachePoint: { type: 'default' } }],
        },
      ],
      system: [],
    });
  });

  it('should add cache point with 5m TTL to user message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
        providerOptions: {
          bedrock: { cachePoint: { type: 'default', ttl: '5m' } },
        },
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [
            { text: 'Hello' },
            { cachePoint: { type: 'default', ttl: '5m' } },
          ],
        },
      ],
      system: [],
    });
  });

  it('should add cache point with 1h TTL to user message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
        providerOptions: {
          bedrock: { cachePoint: { type: 'default', ttl: '1h' } },
        },
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [
            { text: 'Hello' },
            { cachePoint: { type: 'default', ttl: '1h' } },
          ],
        },
      ],
      system: [],
    });
  });

  it('should throw for file parts with provider references', async () => {
    await expect(
      convertToAmazonBedrockChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'reference' as const,
                reference: { bedrock: 'file-ref-123' },
              },
              mediaType: 'image/png',
            },
          ],
        },
      ]),
    ).rejects.toThrow(
      "'file parts with provider references' functionality not supported",
    );
  });

  it('should add cache point to user content part when specified', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'text',
            text: 'cached',
            providerOptions: {
              bedrock: { cachePoint: { type: 'default', ttl: '5m' } },
            },
          },
          { type: 'text', text: 'World' },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [
            { text: 'Hello' },
            { text: 'cached' },
            { cachePoint: { type: 'default', ttl: '5m' } },
            { text: 'World' },
          ],
        },
      ],
      system: [],
    });
  });
});

describe('assistant messages', () => {
  it('should remove trailing whitespace from last assistant message when there is no further user message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'user content' }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'assistant content  ' }],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'user content' }],
        },
        {
          role: 'assistant',
          content: [{ text: 'assistant content' }],
        },
      ],
      system: [],
    });
  });

  it('should remove trailing whitespace from last assistant message with multi-part content when there is no further user message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'user content' }],
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'assistant ' },
          { type: 'text', text: 'content  ' },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'user content' }],
        },
        {
          role: 'assistant',
          content: [{ text: 'assistant ' }, { text: 'content' }],
        },
      ],
      system: [],
    });
  });

  it('should keep trailing whitespace from assistant message when there is a further user message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'user content' }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'assistant content  ' }],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'user content 2' }],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'user content' }],
        },
        {
          role: 'assistant',
          content: [{ text: 'assistant content  ' }],
        },
        {
          role: 'user',
          content: [{ text: 'user content 2' }],
        },
      ],
      system: [],
    });
  });

  it('should combine multiple sequential assistant messages into a single message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      { role: 'user', content: [{ type: 'text', text: 'Hi!' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'World' }] },
      { role: 'assistant', content: [{ type: 'text', text: '!' }] },
    ]);

    expect(result).toEqual({
      messages: [
        { role: 'user', content: [{ text: 'Hi!' }] },
        {
          role: 'assistant',
          content: [{ text: 'Hello' }, { text: 'World' }, { text: '!' }],
        },
      ],
      system: [],
    });
  });

  it('should add cache point to assistant message content when specified', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        providerOptions: { bedrock: { cachePoint: { type: 'default' } } },
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'assistant',
          content: [{ text: 'Hello' }, { cachePoint: { type: 'default' } }],
        },
      ],
      system: [],
    });
  });

  it('should add cache point with 5m TTL to assistant message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        providerOptions: {
          bedrock: { cachePoint: { type: 'default', ttl: '5m' } },
        },
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'assistant',
          content: [
            { text: 'Hello' },
            { cachePoint: { type: 'default', ttl: '5m' } },
          ],
        },
      ],
      system: [],
    });
  });

  it('should add cache point with 1h TTL to assistant message', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        providerOptions: {
          bedrock: { cachePoint: { type: 'default', ttl: '1h' } },
        },
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'assistant',
          content: [
            { text: 'Hello' },
            { cachePoint: { type: 'default', ttl: '1h' } },
          ],
        },
      ],
      system: [],
    });
  });

  it('should add cache point to assistant content part when specified', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'text',
            text: 'cached',
            providerOptions: {
              bedrock: { cachePoint: { type: 'default', ttl: '1h' } },
            },
          },
          { type: 'text', text: 'World' },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'assistant',
          content: [
            { text: 'Hello' },
            { text: 'cached' },
            { cachePoint: { type: 'default', ttl: '1h' } },
            { text: 'World' },
          ],
        },
      ],
      system: [],
    });
  });

  it('should properly convert reasoning content type', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Explain your reasoning' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'This is my step-by-step reasoning process',
            providerOptions: {
              bedrock: {
                signature: 'test-signature',
              } satisfies AmazonBedrockReasoningMetadata,
            },
          },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'Explain your reasoning' }],
        },
        {
          role: 'assistant',
          content: [
            {
              reasoningContent: {
                reasoningText: {
                  text: 'This is my step-by-step reasoning process',
                  signature: 'test-signature',
                },
              },
            },
          ],
        },
      ],
      system: [],
    });
  });

  it('should properly convert redacted-reasoning content type', async () => {
    const reasoningData = 'Redacted reasoning information';
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Explain your reasoning' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: '',
            providerOptions: { bedrock: { redactedData: reasoningData } },
          },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'Explain your reasoning' }],
        },
        {
          role: 'assistant',
          content: [
            {
              reasoningContent: {
                redactedReasoning: {
                  data: reasoningData,
                },
              },
            },
          ],
        },
      ],
      system: [],
    });
  });

  it('should omit assistant message reasoning parts signed by a foreign provider', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Explain your reasoning' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Anthropic-signed reasoning replayed to Bedrock',
            providerOptions: {
              anthropic: { signature: 'anthropic-signature' },
            },
          },
          { type: 'text', text: 'final answer' },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'Explain your reasoning' }],
        },
        {
          role: 'assistant',
          content: [{ text: 'final answer' }],
        },
      ],
      system: [],
    });
  });

  it('should preserve assistant message reasoning parts with amazonBedrock providerOptions', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Explain your reasoning' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Bedrock-signed reasoning round-tripped to Bedrock',
            providerOptions: {
              amazonBedrock: { signature: 'bedrock-signature' },
            },
          },
          { type: 'text', text: 'final answer' },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'Explain your reasoning' }],
        },
        {
          role: 'assistant',
          content: [
            {
              reasoningContent: {
                reasoningText: {
                  text: 'Bedrock-signed reasoning round-tripped to Bedrock',
                  signature: 'bedrock-signature',
                },
              },
            },
            { text: 'final answer' },
          ],
        },
      ],
      system: [],
    });
  });

  it('should not trim reasoning text when a signature is present', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Explain your reasoning' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'This is my reasoning with trailing space    ',
            providerOptions: {
              bedrock: {
                signature: 'test-signature',
              } satisfies AmazonBedrockReasoningMetadata,
            },
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": [
              {
                "text": "Explain your reasoning",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "reasoningContent": {
                  "reasoningText": {
                    "signature": "test-signature",
                    "text": "This is my reasoning with trailing space    ",
                  },
                },
              },
            ],
            "role": "assistant",
          },
        ],
        "system": [],
      }
    `);
  });

  it('should omit reasoning content without signature', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Explain your reasoning' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'This is my reasoning with trailing space    ',
          },
          { type: 'text', text: 'final answer' },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": [
              {
                "text": "Explain your reasoning",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "text": "final answer",
              },
            ],
            "role": "assistant",
          },
        ],
        "system": [],
      }
    `);
  });

  it('should omit multiple reasoning parts without signatures', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Explain your reasoning' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'First reasoning with trailing space    ',
          },
          {
            type: 'reasoning',
            text: 'Second reasoning with trailing space    ',
          },
          { type: 'text', text: 'final answer' },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": [
              {
                "text": "Explain your reasoning",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "text": "final answer",
              },
            ],
            "role": "assistant",
          },
        ],
        "system": [],
      }
    `);
  });

  it('should omit unsigned reasoning while preserving tool calls in multi-turn tool use', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'What is the weather?' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'I should call the weather tool.',
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            input: { city: 'SF' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            output: { type: 'text', value: 'Sunny, 72F' },
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": [
              {
                "text": "What is the weather?",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "toolUse": {
                  "input": {
                    "city": "SF",
                  },
                  "name": "getWeather",
                  "toolUseId": "call-1",
                },
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "toolResult": {
                  "content": [
                    {
                      "text": "Sunny, 72F",
                    },
                  ],
                  "toolUseId": "call-1",
                },
              },
            ],
            "role": "user",
          },
        ],
        "system": [],
      }
    `);
  });

  it('should preserve reasoning text with signature in multi-turn tool use', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'What is the weather?' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Let me check the weather API.\n',
            providerOptions: {
              bedrock: {
                signature: 'sig-abc123',
              } satisfies AmazonBedrockReasoningMetadata,
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            input: { city: 'SF' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            output: { type: 'text', value: 'Sunny, 72F' },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'The weather is sunny and warm.\n',
            providerOptions: {
              bedrock: {
                signature: 'sig-def456',
              } satisfies AmazonBedrockReasoningMetadata,
            },
          },
          { type: 'text', text: 'It is sunny and 72F in SF.' },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": [
              {
                "text": "What is the weather?",
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "reasoningContent": {
                  "reasoningText": {
                    "signature": "sig-abc123",
                    "text": "Let me check the weather API.
      ",
                  },
                },
              },
              {
                "toolUse": {
                  "input": {
                    "city": "SF",
                  },
                  "name": "getWeather",
                  "toolUseId": "call-1",
                },
              },
            ],
            "role": "assistant",
          },
          {
            "content": [
              {
                "toolResult": {
                  "content": [
                    {
                      "text": "Sunny, 72F",
                    },
                  ],
                  "toolUseId": "call-1",
                },
              },
            ],
            "role": "user",
          },
          {
            "content": [
              {
                "reasoningContent": {
                  "reasoningText": {
                    "signature": "sig-def456",
                    "text": "The weather is sunny and warm.
      ",
                  },
                },
              },
              {
                "text": "It is sunny and 72F in SF.",
              },
            ],
            "role": "assistant",
          },
        ],
        "system": [],
      }
    `);
  });

  it('should handle a mix of text and reasoning content types', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Explain your reasoning' }],
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'My answer is 42.' },
          {
            type: 'reasoning',
            text: 'I calculated this by analyzing the meaning of life',
            providerOptions: {
              bedrock: {
                signature: 'reasoning-process',
              } satisfies AmazonBedrockReasoningMetadata,
            },
          },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'Explain your reasoning' }],
        },
        {
          role: 'assistant',
          content: [
            { text: 'My answer is 42.' },
            {
              reasoningContent: {
                reasoningText: {
                  text: 'I calculated this by analyzing the meaning of life',
                  signature: 'reasoning-process',
                },
              },
            },
          ],
        },
      ],
      system: [],
    });
  });

  it('should filter out empty text blocks in assistant messages', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '\n\n' },
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'test',
            input: {},
          },
          { type: 'text', text: '  ' },
          { type: 'text', text: 'actual content' },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'Hello' }],
        },
        {
          role: 'assistant',
          content: [
            { toolUse: { toolUseId: 'call-123', name: 'test', input: {} } },
            { text: 'actual content' },
          ],
        },
      ],
      system: [],
    });
  });

  it('should preserve empty text blocks when reasoning blocks are present', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'thinking...',
            providerOptions: {
              bedrock: { signature: 'sig-1' },
            },
          },
          { type: 'text', text: '' },
          {
            type: 'reasoning',
            text: 'more thinking...',
            providerOptions: {
              bedrock: { signature: 'sig-2' },
            },
          },
          { type: 'text', text: 'response text' },
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'test',
            input: {},
          },
        ],
      },
    ]);

    expect(result).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ text: 'Hello' }],
        },
        {
          role: 'assistant',
          content: [
            {
              reasoningContent: {
                reasoningText: { text: 'thinking...', signature: 'sig-1' },
              },
            },
            { text: '' },
            {
              reasoningContent: {
                reasoningText: { text: 'more thinking...', signature: 'sig-2' },
              },
            },
            { text: 'response text' },
            { toolUse: { toolUseId: 'call-123', name: 'test', input: {} } },
          ],
        },
      ],
      system: [],
    });
  });
});

describe('tool messages', () => {
  it('should convert tool result with content array containing text', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'calculator',
            output: {
              type: 'content',
              value: [{ type: 'text', text: 'The result is 42' }],
            },
          },
        ],
      },
    ]);

    expect(result.messages[0]).toEqual({
      role: 'user',
      content: [
        {
          toolResult: {
            toolUseId: 'call-123',
            content: [{ text: 'The result is 42' }],
          },
        },
      ],
    });
  });

  it('should convert tool result with content array containing image', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'image-generator',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file',
                  data: { type: 'data', data: 'base64data' },
                  mediaType: 'image/jpeg',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.messages[0]).toEqual({
      role: 'user',
      content: [
        {
          toolResult: {
            toolUseId: 'call-123',
            content: [
              {
                image: {
                  format: 'jpeg',
                  source: { bytes: 'base64data' },
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('should convert tool result with content array containing PDF', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'document-reader',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file',
                  data: { type: 'data', data: 'base64data' },
                  mediaType: 'application/pdf',
                  filename: 'tool-result.pdf',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.messages[0]).toEqual({
      role: 'user',
      content: [
        {
          toolResult: {
            toolUseId: 'call-123',
            content: [
              {
                document: {
                  format: 'pdf',
                  name: 'tool-result',
                  source: { bytes: 'base64data' },
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('should throw error for unsupported image format in tool result content', async () => {
    await expect(
      convertToAmazonBedrockChatMessages([
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-123',
              toolName: 'image-generator',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'file',
                    data: { type: 'data', data: 'base64data' },
                    mediaType: 'image/avif', // unsupported format
                  },
                ],
              },
            },
          ],
        },
      ]),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AI_UnsupportedFunctionalityError: Unsupported image mime type: image/avif, expected one of: image/jpeg, image/png, image/gif, image/webp]`,
    );
  });

  it('should throw error for unsupported mime type in tool result file content', async () => {
    await expect(
      convertToAmazonBedrockChatMessages([
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-123',
              toolName: 'image-generator',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'file',
                    data: { type: 'data', data: 'base64data' },
                    mediaType: 'unsupported/mime-type',
                  },
                ],
              },
            },
          ],
        },
      ]),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AI_UnsupportedFunctionalityError: Unsupported file mime type: unsupported/mime-type, expected one of: application/pdf, text/csv, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/html, text/plain, text/markdown]`,
    );
  });

  it('should fallback to stringified result when content is undefined', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'calculator',
            output: { type: 'json', value: { value: 42 } },
          },
        ],
      },
    ]);

    expect(result.messages[0]).toEqual({
      role: 'user',
      content: [
        {
          toolResult: {
            toolUseId: 'call-123',
            content: [{ text: '{"value":42}' }],
          },
        },
      ],
    });
  });
});

describe('citations', () => {
  it('should handle citations enabled for PDF', async () => {
    const pdfData = new Uint8Array([0, 1, 2, 3]);

    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(pdfData).toString('base64'),
            },
            mediaType: 'application/pdf',
            providerOptions: {
              bedrock: {
                citations: {
                  enabled: true,
                },
              },
            },
          },
        ],
      },
    ]);

    expect(result.messages[0].content[0]).toEqual({
      document: {
        format: 'pdf',
        name: 'document-1',
        source: {
          bytes: 'AAECAw==',
        },
        citations: {
          enabled: true,
        },
      },
    });
  });

  it('should handle citations disabled for PDF', async () => {
    const pdfData = new Uint8Array([0, 1, 2, 3]);

    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(pdfData).toString('base64'),
            },
            mediaType: 'application/pdf',
            providerOptions: {
              bedrock: {
                citations: {
                  enabled: false,
                },
              },
            },
          },
        ],
      },
    ]);

    expect(result.messages[0].content[0]).toEqual({
      document: {
        format: 'pdf',
        name: 'document-1',
        source: {
          bytes: 'AAECAw==',
        },
      },
    });
  });

  it('should handle no citations specified for PDF (default)', async () => {
    const pdfData = new Uint8Array([0, 1, 2, 3]);

    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(pdfData).toString('base64'),
            },
            mediaType: 'application/pdf',
          },
        ],
      },
    ]);

    expect(result.messages[0].content[0]).toEqual({
      document: {
        format: 'pdf',
        name: 'document-1',
        source: {
          bytes: 'AAECAw==',
        },
      },
    });
  });

  it('should handle multiple PDFs with different citation settings', async () => {
    const pdfData1 = new Uint8Array([0, 1, 2, 3]);
    const pdfData2 = new Uint8Array([4, 5, 6, 7]);

    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(pdfData1).toString('base64'),
            },
            mediaType: 'application/pdf',
            providerOptions: {
              bedrock: {
                citations: {
                  enabled: true,
                },
              },
            },
          },
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(pdfData2).toString('base64'),
            },
            mediaType: 'application/pdf',
            providerOptions: {
              bedrock: {
                citations: {
                  enabled: false,
                },
              },
            },
          },
        ],
      },
    ]);

    expect(result.messages[0].content).toEqual([
      {
        document: {
          format: 'pdf',
          name: 'document-1',
          source: {
            bytes: 'AAECAw==',
          },
          citations: {
            enabled: true,
          },
        },
      },
      {
        document: {
          format: 'pdf',
          name: 'document-2',
          source: {
            bytes: 'BAUGBw==',
          },
        },
      },
    ]);
  });
});

describe('additional file format tests', () => {
  it('should throw an error for unsupported file mime type in user message content', async () => {
    await expect(
      convertToAmazonBedrockChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data' as const, data: 'base64data' },
              mediaType: 'application/rtf',
            },
          ],
        },
      ]),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AI_UnsupportedFunctionalityError: Unsupported file mime type: application/rtf, expected one of: application/pdf, text/csv, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/html, text/plain, text/markdown]`,
    );
  });

  it('should handle xlsx files correctly', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: 'base64data' },
            mediaType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": [
              {
                "document": {
                  "format": "xlsx",
                  "name": "document-1",
                  "source": {
                    "bytes": "base64data",
                  },
                },
              },
            ],
            "role": "user",
          },
        ],
        "system": [],
      }
    `);
  });

  it('should handle docx files correctly', async () => {
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: 'base64data' },
            mediaType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": [
              {
                "document": {
                  "format": "docx",
                  "name": "document-1",
                  "source": {
                    "bytes": "base64data",
                  },
                },
              },
            ],
            "role": "user",
          },
        ],
        "system": [],
      }
    `);
  });
});

describe('Mistral tool call ID normalization', () => {
  it('should normalize tool call IDs in tool results when isMistral is true', async () => {
    const result = await convertToAmazonBedrockChatMessages(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'tooluse_bpe71yCfRu2b5i-nKGDr5g',
              toolName: 'calculator',
              output: { type: 'text', value: 'The result is 42' },
            },
          ],
        },
      ],
      true,
    );

    expect(result.messages[0]).toEqual({
      role: 'user',
      content: [
        {
          toolResult: {
            toolUseId: 'toolusebp',
            content: [{ text: 'The result is 42' }],
          },
        },
      ],
    });
  });

  it('should normalize tool call IDs in tool calls when isMistral is true', async () => {
    const result = await convertToAmazonBedrockChatMessages(
      [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'tooluse_xyz123ABC456-def',
              toolName: 'test-tool',
              input: { query: 'test' },
            },
          ],
        },
      ],
      true,
    );

    expect(result.messages[0]).toEqual({
      role: 'assistant',
      content: [
        {
          toolUse: {
            toolUseId: 'toolusexy',
            name: 'test-tool',
            input: { query: 'test' },
          },
        },
      ],
    });
  });

  it('should not normalize tool call IDs when isMistral is false', async () => {
    const originalId = 'tooluse_bpe71yCfRu2b5i-nKGDr5g';
    const result = await convertToAmazonBedrockChatMessages(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: originalId,
              toolName: 'calculator',
              output: { type: 'text', value: 'The result is 42' },
            },
          ],
        },
      ],
      false,
    );

    expect(result.messages[0]).toEqual({
      role: 'user',
      content: [
        {
          toolResult: {
            toolUseId: originalId,
            content: [{ text: 'The result is 42' }],
          },
        },
      ],
    });
  });

  it('should default to not normalizing when isMistral is not provided', async () => {
    const originalId = 'tooluse_bpe71yCfRu2b5i-nKGDr5g';
    const result = await convertToAmazonBedrockChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: originalId,
            toolName: 'calculator',
            output: { type: 'text', value: 'The result is 42' },
          },
        ],
      },
    ]);

    expect(result.messages[0]).toEqual({
      role: 'user',
      content: [
        {
          toolResult: {
            toolUseId: originalId,
            content: [{ text: 'The result is 42' }],
          },
        },
      ],
    });
  });
});

describe('top-level-only mediaType resolution', () => {
  const PNG_BYTES = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const PDF_BYTES = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
  ]);

  it('should pass through a full image mediaType unchanged', async () => {
    const { messages } = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(PNG_BYTES).toString('base64'),
            },
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          {
            image: {
              format: 'png',
              source: { bytes: 'iVBORw0KGgo=' },
            },
          },
        ],
      },
    ]);
  });

  it('should detect subtype from inline bytes when mediaType is top-level-only (image)', async () => {
    const { messages } = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(PNG_BYTES).toString('base64'),
            },
            mediaType: 'image',
          },
        ],
      },
    ]);

    expect(messages[0]).toEqual({
      role: 'user',
      content: [
        {
          image: {
            format: 'png',
            source: { bytes: 'iVBORw0KGgo=' },
          },
        },
      ],
    });
  });

  it('should detect subtype from inline bytes when mediaType is top-level-only (application/pdf)', async () => {
    const { messages } = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: Buffer.from(PDF_BYTES).toString('base64'),
            },
            mediaType: 'application',
          },
        ],
      },
    ]);

    expect(messages[0]).toEqual({
      role: 'user',
      content: [
        {
          document: {
            format: 'pdf',
            name: 'document-1',
            source: { bytes: 'JVBERi0xLjQ=' },
          },
        },
      ],
    });
  });

  it('should route to document slot for non-image top-level type via getTopLevelMediaType', async () => {
    const { messages } = await convertToAmazonBedrockChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: 'base64data' },
            mediaType: 'text/plain',
          },
        ],
      },
    ]);

    expect(messages[0]).toEqual({
      role: 'user',
      content: [
        {
          document: {
            format: 'txt',
            name: 'document-1',
            source: { bytes: 'base64data' },
          },
        },
      ],
    });
  });

  it('should throw UnsupportedFunctionalityError for URL data (File URL)', async () => {
    await expect(
      convertToAmazonBedrockChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'url' as const,
                url: new URL('https://example.com/image.png'),
              },
              mediaType: 'image',
            },
          ],
        },
      ]),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AI_UnsupportedFunctionalityError: 'File URL data' functionality not supported.]`,
    );
  });

  it('should throw UnsupportedFunctionalityError for unsupported full image mediaType', async () => {
    await expect(
      convertToAmazonBedrockChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: { type: 'data' as const, data: 'base64data' },
              mediaType: 'image/avif',
            },
          ],
        },
      ]),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AI_UnsupportedFunctionalityError: Unsupported image mime type: image/avif, expected one of: image/jpeg, image/png, image/gif, image/webp]`,
    );
  });

  it('should throw UnsupportedFunctionalityError when top-level-only bytes cannot be detected', async () => {
    await expect(
      convertToAmazonBedrockChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'data' as const,
                data: Buffer.from(new Uint8Array([0x00, 0x01, 0x02])).toString(
                  'base64',
                ),
              },
              mediaType: 'image',
            },
          ],
        },
      ]),
    ).rejects.toThrowError(/media type "image".*could not be auto-detected/);
  });
});
