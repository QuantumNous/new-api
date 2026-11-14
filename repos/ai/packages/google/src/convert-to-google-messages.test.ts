import { describe, expect, it, vi } from 'vitest';
import {
  convertToGoogleMessages,
  SKIP_THOUGHT_SIGNATURE_VALIDATOR,
} from './convert-to-google-messages';

describe('system messages', () => {
  it('should store system message in system instruction', async () => {
    const result = convertToGoogleMessages([
      { role: 'system', content: 'Test' },
    ]);

    expect(result).toEqual({
      systemInstruction: { parts: [{ text: 'Test' }] },
      contents: [],
    });
  });

  it('should throw error when there was already a user message', async () => {
    expect(() =>
      convertToGoogleMessages([
        { role: 'user', content: [{ type: 'text', text: 'Test' }] },
        { role: 'system', content: 'Test' },
      ]),
    ).toThrow(
      'system messages are only supported at the beginning of the conversation',
    );
  });
});

describe('thought signatures', () => {
  it('should preserve thought signatures in assistant messages', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Regular text',
            providerOptions: { google: { thoughtSignature: 'sig1' } },
          },
          {
            type: 'reasoning',
            text: 'Reasoning text',
            providerOptions: { google: { thoughtSignature: 'sig2' } },
          },
          {
            type: 'tool-call',
            toolCallId: 'call1',
            toolName: 'test',
            input: { value: 'test' },
            providerOptions: { google: { thoughtSignature: 'sig3' } },
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [
          {
            "parts": [
              {
                "text": "Regular text",
                "thoughtSignature": "sig1",
              },
              {
                "text": "Reasoning text",
                "thought": true,
                "thoughtSignature": "sig2",
              },
              {
                "functionCall": {
                  "args": {
                    "value": "test",
                  },
                  "id": "call1",
                  "name": "test",
                },
                "thoughtSignature": "sig3",
              },
            ],
            "role": "model",
          },
        ],
        "systemInstruction": undefined,
      }
    `);
  });
});

describe('thought signatures with vertex providerOptionsName', () => {
  it('should resolve thoughtSignature from google namespace when using vertex providerOptionsName', async () => {
    const result = convertToGoogleMessages(
      [
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Regular text',
              providerOptions: { google: { thoughtSignature: 'sig1' } },
            },
            {
              type: 'reasoning',
              text: 'Reasoning text',
              providerOptions: { google: { thoughtSignature: 'sig2' } },
            },
            {
              type: 'tool-call',
              toolCallId: 'call1',
              toolName: 'getWeather',
              input: { location: 'London' },
              providerOptions: { google: { thoughtSignature: 'sig3' } },
            },
          ],
        },
      ],
      { providerOptionsNames: ['googleVertex', 'vertex'] },
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [
          {
            "parts": [
              {
                "text": "Regular text",
                "thoughtSignature": "sig1",
              },
              {
                "text": "Reasoning text",
                "thought": true,
                "thoughtSignature": "sig2",
              },
              {
                "functionCall": {
                  "args": {
                    "location": "London",
                  },
                  "id": "call1",
                  "name": "getWeather",
                },
                "thoughtSignature": "sig3",
              },
            ],
            "role": "model",
          },
        ],
        "systemInstruction": undefined,
      }
    `);
  });

  it('should prefer vertex namespace over google namespace when both are present', async () => {
    const result = convertToGoogleMessages(
      [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call1',
              toolName: 'getWeather',
              input: { location: 'London' },
              providerOptions: {
                vertex: { thoughtSignature: 'vertex_sig' },
                google: { thoughtSignature: 'google_sig' },
              },
            },
          ],
        },
      ],
      { providerOptionsNames: ['googleVertex', 'vertex'] },
    );

    expect(result.contents[0].parts[0]).toEqual({
      functionCall: {
        id: 'call1',
        name: 'getWeather',
        args: { location: 'London' },
      },
      thoughtSignature: 'vertex_sig',
    });
  });

  it('should resolve thoughtSignature from vertex namespace directly', async () => {
    const result = convertToGoogleMessages(
      [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call1',
              toolName: 'getWeather',
              input: { location: 'London' },
              providerOptions: {
                vertex: { thoughtSignature: 'vertex_sig' },
              },
            },
          ],
        },
      ],
      { providerOptionsNames: ['googleVertex', 'vertex'] },
    );

    expect(result.contents[0].parts[0]).toEqual({
      functionCall: {
        id: 'call1',
        name: 'getWeather',
        args: { location: 'London' },
      },
      thoughtSignature: 'vertex_sig',
    });
  });
});

describe('thought signatures with google providerOptionsName (gateway failover)', () => {
  it('should resolve thoughtSignature from vertex namespace when using google providerOptionsName', async () => {
    const result = convertToGoogleMessages(
      [
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Regular text',
              providerOptions: { vertex: { thoughtSignature: 'sig1' } },
            },
            {
              type: 'reasoning',
              text: 'Reasoning text',
              providerOptions: { vertex: { thoughtSignature: 'sig2' } },
            },
            {
              type: 'tool-call',
              toolCallId: 'call1',
              toolName: 'getWeather',
              input: { location: 'London' },
              providerOptions: { vertex: { thoughtSignature: 'sig3' } },
            },
          ],
        },
      ],
      { providerOptionsNames: ['google'] },
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [
          {
            "parts": [
              {
                "text": "Regular text",
                "thoughtSignature": "sig1",
              },
              {
                "text": "Reasoning text",
                "thought": true,
                "thoughtSignature": "sig2",
              },
              {
                "functionCall": {
                  "args": {
                    "location": "London",
                  },
                  "id": "call1",
                  "name": "getWeather",
                },
                "thoughtSignature": "sig3",
              },
            ],
            "role": "model",
          },
        ],
        "systemInstruction": undefined,
      }
    `);
  });

  it('should prefer google namespace over vertex namespace when both are present', async () => {
    const result = convertToGoogleMessages(
      [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call1',
              toolName: 'getWeather',
              input: { location: 'London' },
              providerOptions: {
                google: { thoughtSignature: 'google_sig' },
                vertex: { thoughtSignature: 'vertex_sig' },
              },
            },
          ],
        },
      ],
      { providerOptionsNames: ['google'] },
    );

    expect(result.contents[0].parts[0]).toEqual({
      functionCall: {
        id: 'call1',
        name: 'getWeather',
        args: { location: 'London' },
      },
      thoughtSignature: 'google_sig',
    });
  });

  it('should resolve thoughtSignature from vertex namespace when google namespace is absent (default providerOptionsName)', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call1',
            toolName: 'getWeather',
            input: { location: 'London' },
            providerOptions: {
              vertex: { thoughtSignature: 'vertex_sig' },
            },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      functionCall: {
        id: 'call1',
        name: 'getWeather',
        args: { location: 'London' },
      },
      thoughtSignature: 'vertex_sig',
    });
  });
});

describe('Gemma model system instructions', () => {
  it('should prepend system instruction to first user message for Gemma models', async () => {
    const result = convertToGoogleMessages(
      [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
      { isGemmaModel: true },
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [
          {
            "parts": [
              {
                "text": "You are a helpful assistant.

      ",
              },
              {
                "text": "Hello",
              },
            ],
            "role": "user",
          },
        ],
        "systemInstruction": undefined,
      }
    `);
  });

  it('should handle multiple system messages for Gemma models', async () => {
    const result = convertToGoogleMessages(
      [
        { role: 'system', content: 'You are helpful.' },
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: [{ type: 'text', text: 'Hi' }] },
      ],
      { isGemmaModel: true },
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [
          {
            "parts": [
              {
                "text": "You are helpful.

      Be concise.

      ",
              },
              {
                "text": "Hi",
              },
            ],
            "role": "user",
          },
        ],
        "systemInstruction": undefined,
      }
    `);
  });

  it('should not affect non-Gemma models', async () => {
    const result = convertToGoogleMessages(
      [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
      { isGemmaModel: false },
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [
          {
            "parts": [
              {
                "text": "Hello",
              },
            ],
            "role": "user",
          },
        ],
        "systemInstruction": {
          "parts": [
            {
              "text": "You are helpful.",
            },
          ],
        },
      }
    `);
  });

  it('should handle Gemma model with system instruction but no user messages', async () => {
    const result = convertToGoogleMessages(
      [{ role: 'system', content: 'You are helpful.' }],
      { isGemmaModel: true },
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [],
        "systemInstruction": undefined,
      }
    `);
  });
});

describe('user messages', () => {
  it('should add image parts', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: 'AAECAw==' },
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: 'AAECAw==',
                mimeType: 'image/png',
              },
            },
          ],
        },
      ],
    });
  });

  it('should add file parts for base64 encoded files', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: 'AAECAw==' },
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: 'AAECAw==',
                mimeType: 'image/png',
              },
            },
          ],
        },
      ],
    });
  });

  it('should convert file parts with provider reference to fileData', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'reference' as const,
              reference: {
                google:
                  'https://generativelanguage.googleapis.com/v1beta/files/abc123',
                openai: 'file-xyz789',
              },
            },
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                mimeType: 'image/png',
                fileUri:
                  'https://generativelanguage.googleapis.com/v1beta/files/abc123',
              },
            },
          ],
        },
      ],
    });
  });

  it('should convert image file parts with provider reference to fileData', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'reference' as const,
              reference: {
                google:
                  'https://generativelanguage.googleapis.com/v1beta/files/img456',
              },
            },
            mediaType: 'image/jpeg',
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                mimeType: 'image/jpeg',
                fileUri:
                  'https://generativelanguage.googleapis.com/v1beta/files/img456',
              },
            },
          ],
        },
      ],
    });
  });

  it('should throw when provider reference is missing google key in user file part', async () => {
    expect(() =>
      convertToGoogleMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: {
                type: 'reference' as const,
                reference: { openai: 'file-xyz789' },
              },
              mediaType: 'image/png',
            },
          ],
        },
      ]),
    ).toThrow(
      "No provider reference found for provider 'google'. Available providers: openai",
    );
  });
});

describe('tool messages', () => {
  it('should convert tool result messages to function responses', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolName: 'testFunction',
            toolCallId: 'testCallId',
            output: { type: 'json', value: { someData: 'test result' } },
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'testCallId',
                name: 'testFunction',
                response: {
                  name: 'testFunction',
                  content: { someData: 'test result' },
                },
              },
            },
          ],
        },
      ],
    });
  });

  it('should convert tool result content with image-data into functionResponse parts', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolName: 'imageGenerator',
            toolCallId: 'testCallId',
            output: {
              type: 'content',
              value: [
                {
                  type: 'text',
                  text: 'Here is the generated image:',
                },
                {
                  type: 'file',
                  data: { type: 'data', data: 'base64encodedimagedata' },
                  mediaType: 'image/jpeg',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'testCallId',
                name: 'imageGenerator',
                response: {
                  name: 'imageGenerator',
                  content: 'Here is the generated image:',
                },
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: 'base64encodedimagedata',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  });

  it('should convert tool result content with file-data into functionResponse parts', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolName: 'documentReader',
            toolCallId: 'testCallId',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file',
                  data: { type: 'data', data: 'base64pdfdata' },
                  mediaType: 'application/pdf',
                  filename: 'report.pdf',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      functionResponse: {
        id: 'testCallId',
        name: 'documentReader',
        response: {
          name: 'documentReader',
          content: 'Tool executed successfully.',
        },
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: 'base64pdfdata',
            },
          },
        ],
      },
    });
  });

  it('should convert tool result content with image-url data URL into functionResponse parts', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolName: 'imageGenerator',
            toolCallId: 'testCallId',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file',
                  data: {
                    type: 'url',
                    url: new URL('data:image/png;base64,base64pngdata'),
                  },
                  mediaType: 'image/png',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      functionResponse: {
        id: 'testCallId',
        name: 'imageGenerator',
        response: {
          name: 'imageGenerator',
          content: 'Tool executed successfully.',
        },
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: 'base64pngdata',
            },
          },
        ],
      },
    });
  });

  it('should forward non-data image-url tool result parts as text content', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolName: 'imageGenerator',
            toolCallId: 'testCallId',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file',
                  data: {
                    type: 'url',
                    url: new URL('https://example.com/image.png'),
                  },
                  mediaType: 'image/png',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      functionResponse: {
        id: 'testCallId',
        name: 'imageGenerator',
        response: {
          name: 'imageGenerator',
          content: `{"type":"file","data":{"type":"url","url":"https://example.com/image.png"},"mediaType":"image/png"}`,
        },
      },
    });
  });

  it('should forward non-data file-url tool result parts as text content', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolName: 'documentReader',
            toolCallId: 'testCallId',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file',
                  data: {
                    type: 'url',
                    url: new URL('https://example.com/report.pdf'),
                  },
                  mediaType: 'application/pdf',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      functionResponse: {
        id: 'testCallId',
        name: 'documentReader',
        response: {
          name: 'documentReader',
          content: `{"type":"file","data":{"type":"url","url":"https://example.com/report.pdf"},"mediaType":"application/pdf"}`,
        },
      },
    });
  });

  it('should use legacy tool-result conversion when functionResponse parts are unsupported', async () => {
    const result = convertToGoogleMessages(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'imageGenerator',
              toolCallId: 'testCallId',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'text',
                    text: 'Here is the generated image:',
                  },
                  {
                    type: 'file',
                    data: { type: 'data', data: 'base64encodedimagedata' },
                    mediaType: 'image/jpeg',
                  },
                  {
                    type: 'file',
                    data: { type: 'data', data: 'base64pdfdata' },
                    mediaType: 'application/pdf',
                    filename: 'report.pdf',
                  },
                ],
              },
            },
          ],
        },
      ],
      { supportsFunctionResponseParts: false },
    );

    expect(result.contents[0].parts).toEqual([
      {
        functionResponse: {
          id: 'testCallId',
          name: 'imageGenerator',
          response: {
            name: 'imageGenerator',
            content: 'Here is the generated image:',
          },
        },
      },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: 'base64encodedimagedata',
        },
      },
      {
        text: 'Tool executed successfully and returned this image as a response',
      },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: 'base64pdfdata',
        },
      },
      {
        text: 'Tool executed successfully and returned this file as a response',
      },
    ]);
  });

  it('issue #16072: should not serialize PDF file tool results as text on the non-Gemini-3 path', async () => {
    const result = convertToGoogleMessages(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'catalogSearch',
              toolCallId: 'testCallId',
              output: {
                type: 'content',
                value: [
                  { type: 'text', text: 'metadata' },
                  {
                    type: 'file',
                    data: { type: 'data', data: 'JVBERi0xLjQK' },
                    mediaType: 'application/pdf',
                  },
                ],
              },
            },
          ],
        },
      ],
      { supportsFunctionResponseParts: false },
    );

    const textParts = result.contents.flatMap(content =>
      content.parts
        .filter(part => 'text' in part)
        .map(part => (part as { text: string }).text),
    );

    expect(textParts).not.toEqual(
      expect.arrayContaining([expect.stringContaining('JVBERi0xLjQK')]),
    );
    expect(result.contents[0].parts).toContainEqual({
      inlineData: {
        mimeType: 'application/pdf',
        data: 'JVBERi0xLjQK',
      },
    });
  });

  it('should keep URL tool result parts on the legacy path', async () => {
    const result = convertToGoogleMessages(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'documentReader',
              toolCallId: 'testCallId',
              output: {
                type: 'content',
                value: [
                  {
                    type: 'file',
                    data: {
                      type: 'url',
                      url: new URL('https://example.com/image.png'),
                    },
                    mediaType: 'image/png',
                  },
                  {
                    type: 'file',
                    data: {
                      type: 'url',
                      url: new URL('https://example.com/report.pdf'),
                    },
                    mediaType: 'application/pdf',
                  },
                ],
              },
            },
          ],
        },
      ],
      { supportsFunctionResponseParts: false },
    );

    expect(result.contents[0].parts).toEqual([
      {
        text: `{"type":"file","data":{"type":"url","url":"https://example.com/image.png"},"mediaType":"image/png"}`,
      },
      {
        text: `{"type":"file","data":{"type":"url","url":"https://example.com/report.pdf"},"mediaType":"application/pdf"}`,
      },
    ]);
  });
});

describe('assistant messages', () => {
  it('should add PNG image parts for base64 encoded files', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: 'AAECAw==' },
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'model',
          parts: [
            {
              inlineData: {
                data: 'AAECAw==',
                mimeType: 'image/png',
              },
            },
          ],
        },
      ],
    });
  });

  it('should include thought flag on file parts when set in providerOptions', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'file',
            data: { type: 'data' as const, data: 'AAECAw==' },
            mediaType: 'image/png',
            providerOptions: {
              google: { thought: true, thoughtSignature: 'sig1' },
            },
          },
          {
            type: 'file',
            data: { type: 'data' as const, data: 'BAUG' },
            mediaType: 'image/jpeg',
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'model',
          parts: [
            {
              inlineData: {
                data: 'AAECAw==',
                mimeType: 'image/png',
              },
              thought: true,
              thoughtSignature: 'sig1',
            },
            {
              inlineData: {
                data: 'BAUG',
                mimeType: 'image/jpeg',
              },
              thoughtSignature: undefined,
            },
          ],
        },
      ],
    });
  });

  it('should convert reasoning-file parts with thought flag and signature', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning-file',
            data: { type: 'data' as const, data: 'AAECAw==' },
            mediaType: 'image/png',
            providerOptions: {
              google: { thoughtSignature: 'sig_reasoning_file' },
            },
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [
          {
            "parts": [
              {
                "inlineData": {
                  "data": "AAECAw==",
                  "mimeType": "image/png",
                },
                "thought": true,
                "thoughtSignature": "sig_reasoning_file",
              },
            ],
            "role": "model",
          },
        ],
        "systemInstruction": undefined,
      }
    `);
  });

  it('should convert reasoning-file parts without thoughtSignature', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning-file',
            data: { type: 'data' as const, data: 'BAUG' },
            mediaType: 'image/jpeg',
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [
          {
            "parts": [
              {
                "inlineData": {
                  "data": "BAUG",
                  "mimeType": "image/jpeg",
                },
                "thought": true,
                "thoughtSignature": undefined,
              },
            ],
            "role": "model",
          },
        ],
        "systemInstruction": undefined,
      }
    `);
  });

  it('should throw error for URL file data in reasoning-file assistant messages', async () => {
    expect(() =>
      convertToGoogleMessages([
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning-file',
              data: {
                type: 'url' as const,
                url: new URL('https://example.com/image.png'),
              },
              mediaType: 'image/png',
            },
          ],
        },
      ]),
    ).toThrow('File data URLs in assistant messages are not supported');
  });

  it('should handle mixed reasoning, reasoning-file, text, and tool-call parts', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Thinking about this...',
            providerOptions: { google: { thoughtSignature: 'sig1' } },
          },
          {
            type: 'reasoning-file',
            data: { type: 'data' as const, data: 'AAECAw==' },
            mediaType: 'image/png',
            providerOptions: { google: { thoughtSignature: 'sig2' } },
          },
          {
            type: 'text',
            text: 'Here is my response',
            providerOptions: { google: { thoughtSignature: 'sig3' } },
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
      {
        "contents": [
          {
            "parts": [
              {
                "text": "Thinking about this...",
                "thought": true,
                "thoughtSignature": "sig1",
              },
              {
                "inlineData": {
                  "data": "AAECAw==",
                  "mimeType": "image/png",
                },
                "thought": true,
                "thoughtSignature": "sig2",
              },
              {
                "text": "Here is my response",
                "thoughtSignature": "sig3",
              },
            ],
            "role": "model",
          },
        ],
        "systemInstruction": undefined,
      }
    `);
  });

  it('should throw error for URL file data in assistant messages', async () => {
    expect(() =>
      convertToGoogleMessages([
        {
          role: 'assistant',
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
      ]),
    ).toThrow('File data URLs in assistant messages are not supported');
  });

  it('should convert assistant file parts with provider reference to fileData', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'file',
            data: {
              type: 'reference' as const,
              reference: {
                google:
                  'https://generativelanguage.googleapis.com/v1beta/files/abc123',
              },
            },
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'model',
          parts: [
            {
              fileData: {
                mimeType: 'image/png',
                fileUri:
                  'https://generativelanguage.googleapis.com/v1beta/files/abc123',
              },
              thoughtSignature: undefined,
            },
          ],
        },
      ],
    });
  });

  it('should convert assistant file parts with provider reference and thought flag', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'file',
            data: {
              type: 'reference' as const,
              reference: {
                google:
                  'https://generativelanguage.googleapis.com/v1beta/files/abc123',
              },
            },
            mediaType: 'image/png',
            providerOptions: {
              google: { thought: true, thoughtSignature: 'sig1' },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual({
      systemInstruction: undefined,
      contents: [
        {
          role: 'model',
          parts: [
            {
              fileData: {
                mimeType: 'image/png',
                fileUri:
                  'https://generativelanguage.googleapis.com/v1beta/files/abc123',
              },
              thought: true,
              thoughtSignature: 'sig1',
            },
          ],
        },
      ],
    });
  });

  it('should throw when provider reference is missing google key in assistant file part', async () => {
    expect(() =>
      convertToGoogleMessages([
        {
          role: 'assistant',
          content: [
            {
              type: 'file',
              data: {
                type: 'reference' as const,
                reference: { openai: 'file-xyz789' },
              },
              mediaType: 'image/png',
            },
          ],
        },
      ]),
    ).toThrow(
      "No provider reference found for provider 'google'. Available providers: openai",
    );
  });
});

describe('parallel tool calls', () => {
  it('should include thought signature on functionCall when provided', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call1',
            toolName: 'checkweather',
            input: { city: 'paris' },
            providerOptions: { google: { thoughtSignature: 'sig_parallel' } },
          },
          {
            type: 'tool-call',
            toolCallId: 'call2',
            toolName: 'checkweather',
            input: { city: 'london' },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      functionCall: {
        id: 'call1',
        args: { city: 'paris' },
        name: 'checkweather',
      },
      thoughtSignature: 'sig_parallel',
    });

    expect(result.contents[0].parts[1]).toEqual({
      functionCall: {
        id: 'call2',
        args: { city: 'london' },
        name: 'checkweather',
      },
      thoughtSignature: undefined,
    });
  });
});

describe('tool results with thought signatures', () => {
  it('should include thought signature on functionCall but not on functionResponse', async () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call1',
            toolName: 'readdata',
            input: { userId: '123' },
            providerOptions: { google: { thoughtSignature: 'sig_original' } },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call1',
            toolName: 'readdata',
            output: {
              type: 'error-text',
              value: 'file not found',
            },
            providerOptions: { google: { thoughtSignature: 'sig_original' } },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      functionCall: {
        id: 'call1',
        args: { userId: '123' },
        name: 'readdata',
      },
      thoughtSignature: 'sig_original',
    });

    expect(result.contents[1].parts[0]).toEqual({
      functionResponse: {
        id: 'call1',
        name: 'readdata',
        response: {
          content: 'file not found',
          name: 'readdata',
        },
      },
    });

    expect(result.contents[1].parts[0]).not.toHaveProperty('thoughtSignature');
  });
});

describe('server tool combination round-trip', () => {
  it('should convert assistant tool-call with serverToolCallId to toolCall wire format', () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc-1',
            toolName: 'server:GOOGLE_SEARCH_WEB',
            input: JSON.stringify({ query: 'test' }),
            providerOptions: {
              google: {
                serverToolCallId: 'server-id-1',
                serverToolType: 'GOOGLE_SEARCH_WEB',
                thoughtSignature: 'sig-abc',
              },
            },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      toolCall: {
        toolType: 'GOOGLE_SEARCH_WEB',
        args: { query: 'test' },
        id: 'server-id-1',
      },
      thoughtSignature: 'sig-abc',
    });
  });

  it('should convert assistant tool-call without serverToolCallId to functionCall wire format', () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc-1',
            toolName: 'weather',
            input: { location: 'SF' },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      functionCall: {
        id: 'tc-1',
        name: 'weather',
        args: { location: 'SF' },
      },
      thoughtSignature: undefined,
    });
  });

  it('should convert tool result with serverToolCallId to toolResponse on last model content', () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc-1',
            toolName: 'server:GOOGLE_SEARCH_WEB',
            input: JSON.stringify({ query: 'test' }),
            providerOptions: {
              google: {
                serverToolCallId: 'server-id-1',
                serverToolType: 'GOOGLE_SEARCH_WEB',
              },
            },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc-1',
            toolName: 'server:GOOGLE_SEARCH_WEB',
            output: { type: 'json', value: { results: ['a'] } },
            providerOptions: {
              google: {
                serverToolCallId: 'server-id-1',
                serverToolType: 'GOOGLE_SEARCH_WEB',
                thoughtSignature: 'sig-resp',
              },
            },
          },
        ],
      },
    ]);

    expect(result.contents[0].role).toBe('model');
    expect(result.contents[0].parts).toHaveLength(2);

    expect(result.contents[0].parts[0]).toEqual({
      toolCall: {
        toolType: 'GOOGLE_SEARCH_WEB',
        args: { query: 'test' },
        id: 'server-id-1',
      },
      thoughtSignature: undefined,
    });

    expect(result.contents[0].parts[1]).toEqual({
      toolResponse: {
        toolType: 'GOOGLE_SEARCH_WEB',
        response: { results: ['a'] },
        id: 'server-id-1',
      },
      thoughtSignature: 'sig-resp',
    });
  });

  it('should parse string input for server tool call args', () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc-1',
            toolName: 'server:GOOGLE_SEARCH_WEB',
            input: '{"query":"hello"}',
            providerOptions: {
              google: {
                serverToolCallId: 'sid-1',
                serverToolType: 'GOOGLE_SEARCH_WEB',
              },
            },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      toolCall: {
        toolType: 'GOOGLE_SEARCH_WEB',
        args: { query: 'hello' },
        id: 'sid-1',
      },
      thoughtSignature: undefined,
    });
  });

  it('should pass object input directly for server tool call args', () => {
    const result = convertToGoogleMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc-1',
            toolName: 'server:GOOGLE_SEARCH_WEB',
            input: { query: 'hello' },
            providerOptions: {
              google: {
                serverToolCallId: 'sid-1',
                serverToolType: 'GOOGLE_SEARCH_WEB',
              },
            },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      toolCall: {
        toolType: 'GOOGLE_SEARCH_WEB',
        args: { query: 'hello' },
        id: 'sid-1',
      },
      thoughtSignature: undefined,
    });
  });
});

describe('Gemini 3 missing thoughtSignature mitigation', () => {
  const promptWithToolCallMissingSignature = [
    { role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }] },
    {
      role: 'assistant' as const,
      content: [
        {
          type: 'tool-call' as const,
          toolCallId: 'tc_1',
          toolName: 'weather',
          input: { location: 'SF' },
        },
      ],
    },
    {
      role: 'tool' as const,
      content: [
        {
          type: 'tool-result' as const,
          toolCallId: 'tc_1',
          toolName: 'weather',
          output: { type: 'json' as const, value: { temperature: 72 } },
        },
      ],
    },
  ];

  it('injects skip_thought_signature_validator and emits a warning for Gemini 3 when a tool-call has no signature', () => {
    const onWarning = vi.fn();
    const result = convertToGoogleMessages(promptWithToolCallMissingSignature, {
      isGemini3Model: true,
      onWarning,
    });

    const assistant = result.contents.find(c => c.role === 'model');
    expect(assistant?.parts[0]).toMatchObject({
      functionCall: { id: 'tc_1', name: 'weather', args: { location: 'SF' } },
      thoughtSignature: SKIP_THOUGHT_SIGNATURE_VALIDATOR,
    });
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning.mock.calls[0][0]).toMatchObject({
      type: 'other',
      message: expect.stringContaining('skip_thought_signature_validator'),
    });
    expect(onWarning.mock.calls[0][0].message).toContain('`weather`');
  });

  it('does NOT inject the sentinel for non-Gemini-3 models', () => {
    const onWarning = vi.fn();
    const result = convertToGoogleMessages(promptWithToolCallMissingSignature, {
      isGemini3Model: false,
      onWarning,
    });

    const assistant = result.contents.find(c => c.role === 'model');
    expect(assistant?.parts[0]).toMatchObject({
      functionCall: { id: 'tc_1', name: 'weather', args: { location: 'SF' } },
      thoughtSignature: undefined,
    });
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('does NOT inject the sentinel when a real signature is present under `google`', () => {
    const onWarning = vi.fn();
    const result = convertToGoogleMessages(
      [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'tc_1',
              toolName: 'weather',
              input: { location: 'SF' },
              providerOptions: { google: { thoughtSignature: 'real_sig' } },
            },
          ],
        },
      ],
      { isGemini3Model: true, onWarning },
    );

    const assistant = result.contents.find(c => c.role === 'model');
    expect(assistant?.parts[0]).toMatchObject({
      thoughtSignature: 'real_sig',
    });
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('does NOT inject the sentinel when a real signature is present under `vertex`', () => {
    const onWarning = vi.fn();
    const result = convertToGoogleMessages(
      [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'tc_1',
              toolName: 'weather',
              input: { location: 'SF' },
              providerOptions: { vertex: { thoughtSignature: 'vertex_sig' } },
            },
          ],
        },
      ],
      {
        isGemini3Model: true,
        providerOptionsNames: ['googleVertex', 'vertex'],
        onWarning,
      },
    );

    const assistant = result.contents.find(c => c.role === 'model');
    expect(assistant?.parts[0]).toMatchObject({
      thoughtSignature: 'vertex_sig',
    });
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('does NOT inject the sentinel when a real signature is present under `googleVertex`', () => {
    const onWarning = vi.fn();
    const result = convertToGoogleMessages(
      [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'tc_1',
              toolName: 'weather',
              input: { location: 'SF' },
              providerOptions: {
                googleVertex: { thoughtSignature: 'google_vertex_sig' },
              },
            },
          ],
        },
      ],
      { isGemini3Model: true, onWarning },
    );

    const assistant = result.contents.find(c => c.role === 'model');
    expect(assistant?.parts[0]).toMatchObject({
      thoughtSignature: 'google_vertex_sig',
    });
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('emits one warning per request listing each affected tool name', () => {
    const onWarning = vi.fn();
    convertToGoogleMessages(
      [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'tc_1',
              toolName: 'weather',
              input: { location: 'SF' },
            },
            {
              type: 'tool-call',
              toolCallId: 'tc_2',
              toolName: 'weather',
              input: { location: 'NYC' },
            },
            {
              type: 'tool-call',
              toolCallId: 'tc_3',
              toolName: 'search',
              input: { query: 'q' },
            },
          ],
        },
      ],
      { isGemini3Model: true, onWarning },
    );

    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning.mock.calls[0][0].message).toContain('3 ');
    expect(onWarning.mock.calls[0][0].message).toContain('`weather`');
    expect(onWarning.mock.calls[0][0].message).toContain('`search`');
  });
});

describe('top-level-only media type resolution', () => {
  const pngBase64 = 'iVBORw0KGgo=';

  it('passes full image/png through unchanged for inline data', () => {
    const result = convertToGoogleMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: { type: 'data', data: pngBase64 },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      inlineData: { mimeType: 'image/png', data: pngBase64 },
    });
  });

  it('detects image subtype from inline bytes for top-level "image"', () => {
    const result = convertToGoogleMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image',
            data: { type: 'data', data: pngBase64 },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      inlineData: { mimeType: 'image/png', data: pngBase64 },
    });
  });

  it('throws for top-level-only image with URL source (no bytes to detect)', () => {
    expect(() =>
      convertToGoogleMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image',
              data: {
                type: 'url',
                url: new URL('https://example.com/x.png'),
              },
            },
          ],
        },
      ]),
    ).toThrow(/media type "image".*not passed as inline bytes/);
  });

  it('normalizes image/* wildcard via detection', () => {
    const result = convertToGoogleMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            mediaType: 'image/*',
            data: { type: 'data', data: pngBase64 },
          },
        ],
      },
    ]);

    expect(result.contents[0].parts[0]).toEqual({
      inlineData: { mimeType: 'image/png', data: pngBase64 },
    });
  });
});
