import {
  LanguageModelV4ProviderTool,
  type LanguageModelV4Prompt,
} from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import {
  GoogleLanguageModel,
  getGroundingMetadataSchema,
  getUrlContextMetadataSchema,
} from './google-language-model';

import type {
  GoogleGroundingMetadata,
  GoogleUrlContextMetadata,
} from './google-prompt';
import { createGoogle } from './google-provider';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const SAFETY_RATINGS = [
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    probability: 'NEGLIGIBLE',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    probability: 'NEGLIGIBLE',
  },
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    probability: 'NEGLIGIBLE',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    probability: 'NEGLIGIBLE',
  },
];

const provider = createGoogle({
  apiKey: 'test-api-key',
  generateId: () => 'test-id',
});
const model = provider.chat('gemini-pro');

const groundingMetadataSchema = getGroundingMetadataSchema();
const urlContextMetadataSchema = getUrlContextMetadataSchema();

describe('groundingMetadataSchema', () => {
  it('validates complete grounding metadata with web search results', () => {
    const metadata = {
      webSearchQueries: ["What's the weather in Chicago this weekend?"],
      searchEntryPoint: {
        renderedContent: 'Sample rendered content for search results',
      },
      groundingChunks: [
        {
          web: {
            uri: 'https://example.com/weather',
            title: 'Chicago Weather Forecast',
          },
        },
      ],
      groundingSupports: [
        {
          segment: {
            startIndex: 0,
            endIndex: 65,
            text: 'Chicago weather changes rapidly, so layers let you adjust easily.',
          },
          groundingChunkIndices: [0],
          confidenceScores: [0.99],
        },
      ],
      retrievalMetadata: {
        webDynamicRetrievalScore: 0.96879,
      },
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates groundingChunks[].web with missing title', () => {
    const metadata = {
      groundingChunks: [
        {
          web: {
            // Missing `title`
            uri: 'https://example.com/weather',
          },
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates complete grounding metadata with Vertex AI Search results', () => {
    const metadata = {
      retrievalQueries: ['How to make appointment to renew driving license?'],
      groundingChunks: [
        {
          retrievedContext: {
            uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AXiHM.....QTN92V5ePQ==',
            title: 'dmv',
          },
        },
      ],
      groundingSupports: [
        {
          segment: {
            startIndex: 25,
            endIndex: 147,
          },
          segment_text: 'ipsum lorem ...',
          supportChunkIndices: [1, 2],
          confidenceScore: [0.9541752, 0.97726375],
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates groundingChunks[].retrievedContext with missing title', () => {
    const metadata = {
      groundingChunks: [
        {
          retrievedContext: {
            // Missing `title`
            uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AXiHM.....QTN92V5ePQ==',
          },
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates groundingChunks[].retrievedContext with fileSearchStore (new format)', () => {
    const metadata = {
      groundingChunks: [
        {
          retrievedContext: {
            text: 'Sample content for testing...',
            fileSearchStore: 'fileSearchStores/test-store-xyz',
            title: 'Test Document',
          },
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates groundingChunks[].retrievedContext with fileSearchStore and missing uri', () => {
    const metadata = {
      groundingChunks: [
        {
          retrievedContext: {
            text: 'Content without uri field',
            fileSearchStore: 'fileSearchStores/store-abc',
            // Missing `uri` - should still be valid
          },
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates groundingChunks[].image', () => {
    const metadata = {
      imageSearchQueries: ['Super Bowl halftime show in space'],
      groundingChunks: [
        {
          image: {
            sourceUri: 'https://example.com/article',
            imageUri: 'https://example.com/image.jpg',
            title: 'Image Title',
            domain: 'example.com',
          },
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates groundingChunks[].image with missing optional fields', () => {
    const metadata = {
      groundingChunks: [
        {
          image: {
            sourceUri: 'https://example.com/article',
            imageUri: 'https://example.com/image.jpg',
          },
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates partial grounding metadata', () => {
    const metadata = {
      webSearchQueries: ['sample query'],
      // Missing other optional fields
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates empty grounding metadata', () => {
    const metadata = {};

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates grounding metadata with maps chunks', () => {
    const metadata = {
      groundingChunks: [
        {
          maps: {
            uri: 'https://maps.google.com/maps?cid=12345',
            title: 'Best Italian Restaurant',
            text: 'A great Italian restaurant',
            placeId: 'ChIJ12345',
          },
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates groundingChunks[].maps with missing optional fields', () => {
    const metadata = {
      groundingChunks: [
        {
          maps: {
            uri: 'https://maps.google.com/maps?cid=12345',
          },
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates metadata with empty retrievalMetadata', () => {
    const metadata = {
      webSearchQueries: ['sample query'],
      retrievalMetadata: {},
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates groundingSupports with missing segment', () => {
    const metadata = {
      groundingSupports: [
        {
          // Missing `segment`
          groundingChunkIndices: [0],
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('rejects invalid data types', () => {
    const metadata = {
      webSearchQueries: 'not an array', // Should be an array
      groundingSupports: [
        {
          confidenceScores: 'not an array', // Should be an array of numbers
        },
      ],
    };

    const result = groundingMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(false);
  });
});

describe('urlContextMetadata', () => {
  it('validates complete url context output', () => {
    const output = {
      urlMetadata: [
        {
          retrievedUrl: 'https://example.com/weather',
          urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS',
        },
      ],
    };

    const result = urlContextMetadataSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('validates empty url context output', () => {
    const output = {
      urlMetadata: [],
    };

    const result = urlContextMetadataSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('validates empty object without urlMetadata key', () => {
    const output = {};

    const result = urlContextMetadataSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe('doGenerate', () => {
  const TEST_URL_GEMINI_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  const TEST_URL_GEMINI_2_0_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent';

  const TEST_URL_GEMINI_2_0_FLASH_EXP =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

  const TEST_URL_GEMINI_1_0_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent';

  const TEST_URL_GEMINI_1_5_FLASH =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  const TEST_URL_GEMINI_3_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent';

  const TEST_URL_GEMINI_3_1_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent';

  const TEST_URL_GEMINI_2_5_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

  const TEST_URL_GEMINI_2_5_FLASH =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const TEST_URL_GEMINI_2_5_FLASH_LITE =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

  const server = createTestServer({
    [TEST_URL_GEMINI_PRO]: {},
    [TEST_URL_GEMINI_2_0_PRO]: {},
    [TEST_URL_GEMINI_2_0_FLASH_EXP]: {},
    [TEST_URL_GEMINI_1_0_PRO]: {},
    [TEST_URL_GEMINI_1_5_FLASH]: {},
    [TEST_URL_GEMINI_3_PRO]: {},
    [TEST_URL_GEMINI_3_1_PRO]: {},
    [TEST_URL_GEMINI_2_5_PRO]: {},
    [TEST_URL_GEMINI_2_5_FLASH_LITE]: {},
    [TEST_URL_GEMINI_2_5_FLASH]: {},
  });

  function prepareJsonFixtureResponse(
    filename: string,
    {
      headers,
      url = TEST_URL_GEMINI_PRO,
    }: {
      headers?: Record<string, string>;
      url?:
        | typeof TEST_URL_GEMINI_PRO
        | typeof TEST_URL_GEMINI_2_0_PRO
        | typeof TEST_URL_GEMINI_2_0_FLASH_EXP
        | typeof TEST_URL_GEMINI_1_0_PRO
        | typeof TEST_URL_GEMINI_1_5_FLASH;
    } = {},
  ) {
    server.urls[url].response = {
      type: 'json-value',
      headers,
      body: JSON.parse(
        fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
      ),
    };
  }

  const prepareJsonResponse = ({
    content = '',
    usage = {
      promptTokenCount: 1,
      candidatesTokenCount: 2,
      totalTokenCount: 3,
    },
    headers,
    groundingMetadata,
    url = TEST_URL_GEMINI_PRO,
  }: {
    content?: string;
    usage?: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    };
    headers?: Record<string, string>;
    groundingMetadata?: GoogleGroundingMetadata;
    url?:
      | typeof TEST_URL_GEMINI_PRO
      | typeof TEST_URL_GEMINI_2_0_PRO
      | typeof TEST_URL_GEMINI_2_0_FLASH_EXP
      | typeof TEST_URL_GEMINI_1_0_PRO
      | typeof TEST_URL_GEMINI_1_5_FLASH;
  }) => {
    server.urls[url].response = {
      type: 'json-value',
      headers,
      body: {
        candidates: [
          {
            content: {
              parts: [{ text: content }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
            ...(groundingMetadata && { groundingMetadata }),
          },
        ],
        promptFeedback: { safetyRatings: SAFETY_RATINGS },
        usageMetadata: usage,
      },
    };
  };

  it('should send PDF tool result data as inlineData for Gemini 2.5 legacy tool results', async () => {
    server.urls[TEST_URL_GEMINI_2_5_FLASH_LITE].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [{ text: 'done' }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
      },
    };

    const model = provider.chat('gemini-2.5-flash-lite');

    await model.doGenerate({
      prompt: [
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
    });

    const requestBody = await server.calls[0].requestBodyJson;
    const parts = requestBody.contents[0].parts;
    const textParts = parts
      .filter((part: any) => part.text != null)
      .map((part: any) => part.text);

    expect(textParts).not.toEqual(
      expect.arrayContaining([expect.stringContaining('JVBERi0xLjQK')]),
    );
    expect(parts).toEqual([
      {
        functionResponse: {
          id: 'testCallId',
          name: 'catalogSearch',
          response: {
            name: 'catalogSearch',
            content: 'metadata',
          },
        },
      },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: 'JVBERi0xLjQK',
        },
      },
      {
        text: 'Tool executed successfully and returned this file as a response',
      },
    ]);
  });

  describe('text', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('google-text');
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

      expect(usage).toMatchSnapshot();
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
          "modelId": undefined,
          "timestamp": undefined,
        }
      `);
    });
  });
  it('should handle MALFORMED_FUNCTION_CALL finish reason and empty content object', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {},
            finishReason: 'MALFORMED_FUNCTION_CALL',
          },
        ],
        usageMetadata: {
          promptTokenCount: 9056,
          totalTokenCount: 9056,
          promptTokensDetails: [
            {
              modality: 'TEXT',
              tokenCount: 9056,
            },
          ],
        },
        modelVersion: 'gemini-2.0-flash-lite',
      },
    };

    const { content, finishReason } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`[]`);
    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "MALFORMED_FUNCTION_CALL",
        "unified": "error",
      }
    `);
  });

  it('should expose finishMessage in provider metadata', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {},
            finishReason: 'MALFORMED_FUNCTION_CALL',
            finishMessage:
              "Malformed function call: print(default_api.create(name='test'))",
          },
        ],
        usageMetadata: {
          promptTokenCount: 130,
          totalTokenCount: 130,
          promptTokensDetails: [
            {
              modality: 'TEXT',
              tokenCount: 130,
            },
          ],
        },
      },
    };

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(providerMetadata?.google.finishMessage).toBe(
      "Malformed function call: print(default_api.create(name='test'))",
    );
  });

  it('should expose null finishMessage in provider metadata when not present', async () => {
    prepareJsonResponse({ content: 'test response' });

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(providerMetadata?.google.finishMessage).toBeNull();
  });

  it('should send serviceTier in request body when specified', async () => {
    prepareJsonResponse({ content: 'test response' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          serviceTier: 'flex',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      serviceTier: 'flex',
    });
  });

  it('should not send serviceTier in request body when not specified', async () => {
    prepareJsonResponse({ content: 'test response' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const body = await server.calls[0].requestBodyJson;
    expect(body).not.toHaveProperty('serviceTier');
  });

  it('should send sharedRequestType as X-Vertex-AI-LLM-Shared-Request-Type header on Vertex', async () => {
    prepareJsonResponse({ content: 'test response' });

    const vertexModel = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await vertexModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          sharedRequestType: 'flex',
        },
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      'x-vertex-ai-llm-shared-request-type': 'flex',
    });
    expect(await server.calls[0].requestBodyJson).not.toHaveProperty(
      'serviceTier',
    );
  });

  it('should send requestType as X-Vertex-AI-LLM-Request-Type header on Vertex', async () => {
    prepareJsonResponse({ content: 'test response' });

    const vertexModel = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await vertexModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          sharedRequestType: 'priority',
          requestType: 'shared',
        },
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      'x-vertex-ai-llm-shared-request-type': 'priority',
      'x-vertex-ai-llm-request-type': 'shared',
    });
  });

  it('should warn and drop serviceTier on Vertex provider', async () => {
    prepareJsonResponse({ content: 'test response' });

    const vertexModel = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    const { warnings } = await vertexModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          serviceTier: 'priority',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).not.toHaveProperty(
      'serviceTier',
    );
    expect(server.calls[0].requestHeaders).not.toHaveProperty(
      'x-vertex-ai-llm-shared-request-type',
    );
    expect(warnings).toContainEqual(
      expect.objectContaining({
        type: 'other',
        message: expect.stringContaining(
          "'serviceTier' is a Gemini API option",
        ),
      }),
    );
  });

  it('should warn when sharedRequestType is set on a non-Vertex provider', async () => {
    prepareJsonResponse({ content: 'test response' });

    const { warnings } = await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          sharedRequestType: 'priority',
        },
      },
    });

    expect(server.calls[0].requestHeaders).not.toHaveProperty(
      'x-vertex-ai-llm-shared-request-type',
    );
    expect(warnings).toContainEqual(
      expect.objectContaining({
        type: 'other',
        message: expect.stringContaining(
          "'sharedRequestType' and 'requestType'",
        ),
      }),
    );
  });

  it('should read serviceTier from usageMetadata.serviceTier', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'Blue.' }], role: 'model' },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        promptFeedback: { safetyRatings: SAFETY_RATINGS },
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 2,
          totalTokenCount: 3,
          serviceTier: 'priority',
        },
      },
    };

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(providerMetadata?.google.serviceTier).toBe('priority');
  });

  it('should expose null serviceTier in provider metadata when not present', async () => {
    prepareJsonResponse({ content: 'test response' });

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(providerMetadata?.google.serviceTier).toBeNull();
  });

  describe('tool-call', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('google-tool-call');
    });

    it('should extract tool calls', async () => {
      const result = await model.doGenerate({
        tools: [
          {
            type: 'function',
            name: 'weather',
            inputSchema: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('reasoning-gemini3', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('google-reasoning-gemini3');
    });

    it('should extract reasoning with thoughtSignature', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('tool-call-gemini3', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('google-tool-call-gemini3');
    });

    it('should extract tool call with thoughtSignature', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result).toMatchSnapshot();
    });
  });

  describe('no-args tool call (unary)', () => {
    it('should extract a no-args tool call with thoughtSignature as input "{}"', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'json-value',
        body: {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    functionCall: { name: 'read_theme' },
                    thoughtSignature: 'sig-no-args-unary',
                  },
                ],
              },
              finishReason: 'STOP',
              index: 0,
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 2,
            totalTokenCount: 3,
          },
        },
      };

      const result = await model.doGenerate({ prompt: TEST_PROMPT });

      const toolCalls = result.content.filter(c => c.type === 'tool-call');
      expect(toolCalls).toEqual([
        {
          type: 'tool-call',
          toolCallId: 'test-id',
          toolName: 'read_theme',
          input: '{}',
          providerMetadata: {
            google: { thoughtSignature: 'sig-no-args-unary' },
          },
        },
      ]);
    });
  });

  it('should expose the raw response headers', async () => {
    prepareJsonFixtureResponse('google-text', {
      headers: { 'test-header': 'test-value' },
    });

    const { response } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response?.headers).toMatchInlineSnapshot(`
      {
        "content-length": "549",
        "content-type": "application/json",
        "test-header": "test-value",
      }
    `);
  });

  it('should pass the model, messages, and options', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: [
        { role: 'system', content: 'test system instruction' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
      seed: 123,
      temperature: 0.5,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {
          "seed": 123,
          "temperature": 0.5,
        },
        "systemInstruction": {
          "parts": [
            {
              "text": "test system instruction",
            },
          ],
        },
      }
    `);
  });

  it('should only pass valid provider options', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: [
        { role: 'system', content: 'test system instruction' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
      seed: 123,
      temperature: 0.5,
      providerOptions: {
        google: { foo: 'bar', responseModalities: ['TEXT', 'IMAGE'] },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {
          "responseModalities": [
            "TEXT",
            "IMAGE",
          ],
          "seed": 123,
          "temperature": 0.5,
        },
        "systemInstruction": {
          "parts": [
            {
              "text": "test system instruction",
            },
          ],
        },
      }
    `);
  });

  it('should expand standalone threshold provider option into safetySettings', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          threshold: 'BLOCK_NONE',
        },
      },
    });

    const expectedSafetySettings = [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ];
    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.safetySettings).toEqual(
      expect.arrayContaining(expectedSafetySettings),
    );
    expect(requestBody.safetySettings).toHaveLength(
      expectedSafetySettings.length,
    );
  });

  it('should let safetySettings take precedence over standalone threshold provider option', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          threshold: 'BLOCK_NONE',
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_ONLY_HIGH',
            },
          ],
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;

    expect(requestBody.safetySettings).toEqual([
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ]);
  });

  it('should pass tools and toolChoice', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
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
      toolChoice: {
        type: 'tool',
        toolName: 'test-tool',
      },
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {},
        "toolConfig": {
          "functionCallingConfig": {
            "allowedFunctionNames": [
              "test-tool",
            ],
            "mode": "ANY",
          },
        },
        "tools": [
          {
            "functionDeclarations": [
              {
                "description": "",
                "name": "test-tool",
                "parameters": {
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
              },
            ],
          },
        ],
      }
    `);
  });

  it('should set response mime type with responseFormat', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { location: { type: 'string' } },
        },
      },
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {
          "responseMimeType": "application/json",
          "responseSchema": {
            "properties": {
              "location": {
                "type": "string",
              },
            },
            "type": "object",
          },
        },
      }
    `);
  });

  it('should pass specification with responseFormat and structuredOutputs = true (default)', async () => {
    prepareJsonFixtureResponse('google-text');

    await provider.languageModel('gemini-pro').doGenerate({
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            property1: { type: 'string' },
            property2: { type: 'number' },
          },
          required: ['property1', 'property2'],
          additionalProperties: false,
        },
      },
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {
          "responseMimeType": "application/json",
          "responseSchema": {
            "properties": {
              "property1": {
                "type": "string",
              },
              "property2": {
                "type": "number",
              },
            },
            "required": [
              "property1",
              "property2",
            ],
            "type": "object",
          },
        },
      }
    `);
  });

  it('should not pass specification with responseFormat and structuredOutputs = false', async () => {
    prepareJsonFixtureResponse('google-text');

    await provider.languageModel('gemini-pro').doGenerate({
      providerOptions: {
        google: {
          structuredOutputs: false,
        },
      },
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            property1: { type: 'string' },
            property2: { type: 'number' },
          },
          required: ['property1', 'property2'],
          additionalProperties: false,
        },
      },
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {
          "responseMimeType": "application/json",
        },
      }
    `);
  });

  it('should pass tools and toolChoice', async () => {
    prepareJsonFixtureResponse('google-text');

    await provider.languageModel('gemini-pro').doGenerate({
      tools: [
        {
          name: 'test-tool',
          type: 'function',
          inputSchema: {
            type: 'object',
            properties: {
              property1: { type: 'string' },
              property2: { type: 'number' },
            },
            required: ['property1', 'property2'],
            additionalProperties: false,
          },
        },
      ],
      toolChoice: { type: 'required' },
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {},
        "toolConfig": {
          "functionCallingConfig": {
            "mode": "ANY",
          },
        },
        "tools": [
          {
            "functionDeclarations": [
              {
                "description": "",
                "name": "test-tool",
                "parameters": {
                  "properties": {
                    "property1": {
                      "type": "string",
                    },
                    "property2": {
                      "type": "number",
                    },
                  },
                  "required": [
                    "property1",
                    "property2",
                  ],
                  "type": "object",
                },
              },
            ],
          },
        ],
      }
    `);
  });

  it('should pass headers', async () => {
    prepareJsonFixtureResponse('google-text');

    const provider = createGoogle({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.chat('gemini-pro').doGenerate({
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    const requestHeaders = server.calls[0].requestHeaders;

    expect(requestHeaders).toMatchInlineSnapshot(`
      {
        "content-type": "application/json",
        "custom-provider-header": "provider-header-value",
        "custom-request-header": "request-header-value",
        "x-goog-api-key": "test-api-key",
      }
    `);
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/google/0.0.0-test`,
    );
  });

  it('should pass response format', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
          required: ['text'],
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {
          "responseMimeType": "application/json",
          "responseSchema": {
            "properties": {
              "text": {
                "type": "string",
              },
            },
            "required": [
              "text",
            ],
            "type": "object",
          },
        },
      }
    `);
  });

  it('should send request body', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {},
      }
    `);
  });

  it('should extract sources from grounding metadata', async () => {
    prepareJsonResponse({
      content: 'test response',
      groundingMetadata: {
        groundingChunks: [
          {
            web: { uri: 'https://source.example.com', title: 'Source Title' },
          },
        ],
      },
    });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "test response",
          "type": "text",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "Source Title",
          "type": "source",
          "url": "https://source.example.com",
        },
      ]
    `);
  });

  it('should extract sources from RAG retrievedContext chunks', async () => {
    prepareJsonResponse({
      content: 'test response with RAG',
      groundingMetadata: {
        groundingChunks: [
          {
            web: { uri: 'https://web.example.com', title: 'Web Source' },
          },
          {
            retrievedContext: {
              uri: 'gs://rag-corpus/document.pdf',
              title: 'RAG Document',
              text: 'Retrieved context...',
            },
          },
          {
            retrievedContext: {
              uri: 'https://external-rag-source.com/page',
              title: 'External RAG Source',
              text: 'External retrieved context...',
            },
          },
        ],
      },
    });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "test response with RAG",
          "type": "text",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "Web Source",
          "type": "source",
          "url": "https://web.example.com",
        },
        {
          "filename": "document.pdf",
          "id": "test-id",
          "mediaType": "application/pdf",
          "sourceType": "document",
          "title": "RAG Document",
          "type": "source",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "External RAG Source",
          "type": "source",
          "url": "https://external-rag-source.com/page",
        },
      ]
    `);
  });

  it('should extract sources from File Search retrievedContext (new format)', async () => {
    prepareJsonResponse({
      content: 'test response with File Search',
      groundingMetadata: {
        groundingChunks: [
          {
            retrievedContext: {
              text: 'Sample content for testing...',
              fileSearchStore: 'fileSearchStores/test-store-xyz',
              title: 'Test Document',
            },
          },
          {
            retrievedContext: {
              text: 'Another document content...',
              fileSearchStore: 'fileSearchStores/another-store-abc',
              // Missing title - should default to 'Unknown Document'
            },
          },
        ],
      },
    });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "test response with File Search",
          "type": "text",
        },
        {
          "filename": "test-store-xyz",
          "id": "test-id",
          "mediaType": "application/octet-stream",
          "sourceType": "document",
          "title": "Test Document",
          "type": "source",
        },
        {
          "filename": "another-store-abc",
          "id": "test-id",
          "mediaType": "application/octet-stream",
          "sourceType": "document",
          "title": "Unknown Document",
          "type": "source",
        },
      ]
    `);
  });

  it('should handle URL sources with undefined title correctly', async () => {
    prepareJsonResponse({
      content: 'test response with URLs',
      groundingMetadata: {
        groundingChunks: [
          {
            web: {
              uri: 'https://example.com/page1',
              // No title provided
            },
          },
          {
            retrievedContext: {
              uri: 'https://example.com/page2',
              // No title provided
            },
          },
        ],
      },
    });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "test response with URLs",
          "type": "text",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": undefined,
          "type": "source",
          "url": "https://example.com/page1",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": undefined,
          "type": "source",
          "url": "https://example.com/page2",
        },
      ]
    `);
  });

  it('should extract sources from maps grounding metadata', async () => {
    prepareJsonResponse({
      content: 'test response with Maps',
      groundingMetadata: {
        groundingChunks: [
          {
            maps: {
              uri: 'https://maps.google.com/maps?cid=12345',
              title: 'Best Italian Restaurant',
              placeId: 'ChIJ12345',
            },
          },
          {
            maps: {
              uri: 'https://maps.google.com/maps?cid=67890',
            },
          },
        ],
      },
    });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "test response with Maps",
          "type": "text",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "Best Italian Restaurant",
          "type": "source",
          "url": "https://maps.google.com/maps?cid=12345",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": undefined,
          "type": "source",
          "url": "https://maps.google.com/maps?cid=67890",
        },
      ]
    `);
  });

  it('should extract sources from image grounding metadata', async () => {
    prepareJsonResponse({
      content: 'test response with image search',
      groundingMetadata: {
        groundingChunks: [
          {
            image: {
              sourceUri: 'https://example.com/article',
              imageUri: 'https://example.com/image.jpg',
              title: 'Image Result',
              domain: 'example.com',
            },
          },
          {
            image: {
              sourceUri: 'https://other.example.com/page',
              imageUri: 'https://other.example.com/photo.png',
            },
          },
        ],
      },
    });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "test response with image search",
          "type": "text",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "Image Result",
          "type": "source",
          "url": "https://example.com/article",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": undefined,
          "type": "source",
          "url": "https://other.example.com/page",
        },
      ]
    `);
  });

  it('should handle mixed source types with correct title defaults', async () => {
    prepareJsonResponse({
      content: 'test response with mixed sources',
      groundingMetadata: {
        groundingChunks: [
          {
            web: { uri: 'https://web.example.com' },
          },
          {
            retrievedContext: {
              uri: 'https://external.example.com',
            },
          },
          {
            retrievedContext: {
              uri: 'gs://bucket/document.pdf',
            },
          },
          {
            retrievedContext: {
              fileSearchStore: 'fileSearchStores/store-123',
            },
          },
        ],
      },
    });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "test response with mixed sources",
          "type": "text",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": undefined,
          "type": "source",
          "url": "https://web.example.com",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": undefined,
          "type": "source",
          "url": "https://external.example.com",
        },
        {
          "filename": "document.pdf",
          "id": "test-id",
          "mediaType": "application/pdf",
          "sourceType": "document",
          "title": "Unknown Document",
          "type": "source",
        },
        {
          "filename": "store-123",
          "id": "test-id",
          "mediaType": "application/octet-stream",
          "sourceType": "document",
          "title": "Unknown Document",
          "type": "source",
        },
      ]
    `);
  });

  describe('async headers handling', () => {
    it('merges async config headers with sync request headers', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'json-value',
        body: {
          candidates: [
            {
              content: {
                parts: [{ text: '' }],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          promptFeedback: { safetyRatings: SAFETY_RATINGS },
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 2,
            totalTokenCount: 3,
          },
        },
      };

      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.generative-ai',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: async () => ({
          'X-Async-Config': 'async-config-value',
          'X-Common': 'config-value',
        }),
        generateId: () => 'test-id',
        supportedUrls: () => ({
          '*': [/^https?:\/\/.*$/],
        }),
      });

      await model.doGenerate({
        prompt: TEST_PROMPT,
        headers: {
          'X-Sync-Request': 'sync-request-value',
          'X-Common': 'request-value', // Should override config value
        },
      });

      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "content-type": "application/json",
          "x-async-config": "async-config-value",
          "x-common": "request-value",
          "x-sync-request": "sync-request-value",
        }
      `);
    });

    it('handles Promise-based headers', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'json-value',
        body: {
          candidates: [
            {
              content: {
                parts: [{ text: '' }],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          promptFeedback: { safetyRatings: SAFETY_RATINGS },
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 2,
            totalTokenCount: 3,
          },
        },
      };

      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.generative-ai',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: async () => ({
          'X-Promise-Header': 'promise-value',
        }),
        generateId: () => 'test-id',
      });

      await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "content-type": "application/json",
          "x-promise-header": "promise-value",
        }
      `);
    });

    it('handles async function headers from config', async () => {
      prepareJsonFixtureResponse('google-text');
      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.generative-ai',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: async () => ({
          'X-Async-Header': 'async-value',
        }),
        generateId: () => 'test-id',
      });

      await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(server.calls[0].requestHeaders).toMatchInlineSnapshot(`
        {
          "content-type": "application/json",
          "x-async-header": "async-value",
        }
      `);
    });
  });

  it('should expose safety ratings in provider metadata', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [{ text: 'test response' }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: [
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                probability: 'NEGLIGIBLE',
                probabilityScore: 0.1,
                severity: 'LOW',
                severityScore: 0.2,
                blocked: false,
              },
            ],
          },
        ],
        promptFeedback: { safetyRatings: SAFETY_RATINGS },
      },
    };

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(providerMetadata?.google.safetyRatings).toMatchInlineSnapshot(`
      [
        {
          "blocked": false,
          "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
          "probability": "NEGLIGIBLE",
          "probabilityScore": 0.1,
          "severity": "LOW",
          "severityScore": 0.2,
        },
      ]
    `);
  });

  it('should expose PromptFeedback in provider metadata', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'No' }], role: 'model' },
            finishReason: 'SAFETY',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        promptFeedback: {
          blockReason: 'SAFETY',
          safetyRatings: SAFETY_RATINGS,
        },
      },
    };

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(providerMetadata?.google.promptFeedback).toMatchInlineSnapshot(`
      {
        "blockReason": "SAFETY",
        "safetyRatings": [
          {
            "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "probability": "NEGLIGIBLE",
          },
          {
            "category": "HARM_CATEGORY_HATE_SPEECH",
            "probability": "NEGLIGIBLE",
          },
          {
            "category": "HARM_CATEGORY_HARASSMENT",
            "probability": "NEGLIGIBLE",
          },
          {
            "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
            "probability": "NEGLIGIBLE",
          },
        ],
      }
    `);
  });

  it('should expose grounding metadata in provider metadata', async () => {
    prepareJsonResponse({
      content: 'test response',
      groundingMetadata: {
        webSearchQueries: ["What's the weather in Chicago this weekend?"],
        searchEntryPoint: {
          renderedContent: 'Sample rendered content for search results',
        },
        groundingChunks: [
          {
            web: {
              uri: 'https://example.com/weather',
              title: 'Chicago Weather Forecast',
            },
          },
        ],
        groundingSupports: [
          {
            segment: {
              startIndex: 0,
              endIndex: 65,
              text: 'Chicago weather changes rapidly, so layers let you adjust easily.',
            },
            groundingChunkIndices: [0],
            confidenceScores: [0.99],
          },
        ],
        retrievalMetadata: {
          webDynamicRetrievalScore: 0.96879,
        },
      },
    });

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(providerMetadata?.google.groundingMetadata).toMatchInlineSnapshot(`
      {
        "groundingChunks": [
          {
            "web": {
              "title": "Chicago Weather Forecast",
              "uri": "https://example.com/weather",
            },
          },
        ],
        "groundingSupports": [
          {
            "confidenceScores": [
              0.99,
            ],
            "groundingChunkIndices": [
              0,
            ],
            "segment": {
              "endIndex": 65,
              "startIndex": 0,
              "text": "Chicago weather changes rapidly, so layers let you adjust easily.",
            },
          },
        ],
        "retrievalMetadata": {
          "webDynamicRetrievalScore": 0.96879,
        },
        "searchEntryPoint": {
          "renderedContent": "Sample rendered content for search results",
        },
        "webSearchQueries": [
          "What's the weather in Chicago this weekend?",
        ],
      }
    `);
  });

  it('should handle code execution tool calls', async () => {
    server.urls[TEST_URL_GEMINI_2_0_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  executableCode: {
                    language: 'PYTHON',
                    code: 'print(1+1)',
                  },
                },
                {
                  codeExecutionResult: {
                    outcome: 'OUTCOME_OK',
                    output: '2',
                  },
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
      },
    };

    const model = provider.languageModel('gemini-2.0-pro');
    const { content } = await model.doGenerate({
      tools: [
        {
          type: 'provider',
          id: 'google.code_execution',
          name: 'code_execution',
          args: {},
        },
      ],
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.tools).toEqual([{ codeExecution: {} }]);

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "input": "{"language":"PYTHON","code":"print(1+1)"}",
          "providerExecuted": true,
          "toolCallId": "test-id",
          "toolName": "code_execution",
          "type": "tool-call",
        },
        {
          "result": {
            "outcome": "OUTCOME_OK",
            "output": "2",
          },
          "toolCallId": "test-id",
          "toolName": "code_execution",
          "type": "tool-result",
        },
      ]
    `);
  });

  it('should handle code execution result with missing output field', async () => {
    server.urls[TEST_URL_GEMINI_2_0_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  executableCode: {
                    language: 'PYTHON',
                    code: "import PIL.Image\nimg = PIL.Image.open('input.png')\nimg.save('output.png')\n",
                  },
                },
                {
                  codeExecutionResult: {
                    outcome: 'OUTCOME_OK',
                  },
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
      },
    };

    const model = provider.languageModel('gemini-2.0-pro');
    const { content } = await model.doGenerate({
      tools: [
        {
          type: 'provider',
          id: 'google.code_execution',
          name: 'code_execution',
          args: {},
        },
      ],
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "input": "{"language":"PYTHON","code":"import PIL.Image\\nimg = PIL.Image.open('input.png')\\nimg.save('output.png')\\n"}",
          "providerExecuted": true,
          "toolCallId": "test-id",
          "toolName": "code_execution",
          "type": "tool-call",
        },
        {
          "result": {
            "outcome": "OUTCOME_OK",
            "output": "",
          },
          "toolCallId": "test-id",
          "toolName": "code_execution",
          "type": "tool-result",
        },
      ]
    `);
  });

  it('should return stop finish reason for code execution (provider-executed tool)', async () => {
    server.urls[TEST_URL_GEMINI_2_0_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  executableCode: {
                    language: 'PYTHON',
                    code: 'print(1+1)',
                  },
                },
                {
                  codeExecutionResult: {
                    outcome: 'OUTCOME_OK',
                    output: '2',
                  },
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
      },
    };

    const model = provider.languageModel('gemini-2.0-pro');
    const { finishReason } = await model.doGenerate({
      tools: [
        {
          type: 'provider',
          id: 'google.code_execution',
          name: 'code_execution',
          args: {},
        },
      ],
      prompt: TEST_PROMPT,
    });

    // Provider-executed tools should not trigger 'tool-calls' finish reason
    // since they don't require SDK iteration
    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "STOP",
        "unified": "stop",
      }
    `);
  });

  it('should return stop finish reason for code execution with text response (structured output scenario)', async () => {
    server.urls[TEST_URL_GEMINI_2_0_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  executableCode: {
                    language: 'PYTHON',
                    code: 'primes = [2, 3, 5, 7, 11]\nprint(sum(primes))',
                  },
                },
                {
                  codeExecutionResult: {
                    outcome: 'OUTCOME_OK',
                    output: '28',
                  },
                },
                {
                  text: '{"answer": 28, "explanation": "Sum of first 5 primes"}',
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
      },
    };

    const model = provider.languageModel('gemini-2.0-pro');
    const { finishReason, content } = await model.doGenerate({
      tools: [
        {
          type: 'provider',
          id: 'google.code_execution',
          name: 'code_execution',
          args: {},
        },
      ],
      prompt: TEST_PROMPT,
    });

    // Should return 'stop' so structured output can be parsed
    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "STOP",
        "unified": "stop",
      }
    `);

    // Verify text content is included
    const textPart = content.find(part => part.type === 'text');
    expect(textPart).toBeDefined();
    expect((textPart as { type: 'text'; text: string }).text).toBe(
      '{"answer": 28, "explanation": "Sum of first 5 primes"}',
    );
  });

  it('should return tool-calls finish reason when code execution is combined with function tools', async () => {
    server.urls[TEST_URL_GEMINI_2_0_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  executableCode: {
                    language: 'PYTHON',
                    code: 'print(1+1)',
                  },
                },
                {
                  codeExecutionResult: {
                    outcome: 'OUTCOME_OK',
                    output: '2',
                  },
                },
                {
                  functionCall: {
                    name: 'test-tool',
                    args: { value: 'test' },
                  },
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
      },
    };

    const model = provider.languageModel('gemini-2.0-pro');
    const { finishReason } = await model.doGenerate({
      tools: [
        {
          type: 'provider',
          id: 'google.code_execution',
          name: 'code_execution',
          args: {},
        },
        {
          type: 'function',
          name: 'test-tool',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    // Should return 'tool-calls' because there's a client-executed function tool
    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "STOP",
        "unified": "tool-calls",
      }
    `);
  });

  it('should handle server-side toolCall and toolResponse parts (tool combination)', async () => {
    server.urls[TEST_URL_GEMINI_3_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  toolCall: {
                    toolType: 'GOOGLE_SEARCH_WEB',
                    args: { query: 'San Francisco weather' },
                    id: 'server-call-1',
                  },
                  thoughtSignature: 'sig-abc',
                },
                {
                  toolResponse: {
                    toolType: 'GOOGLE_SEARCH_WEB',
                    response: {
                      results: [{ title: 'Weather in SF' }],
                    },
                    id: 'server-call-1',
                  },
                  thoughtSignature: 'sig-def',
                },
                {
                  text: 'The weather in San Francisco is sunny.',
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      },
    };

    const model = provider.languageModel('gemini-3-pro-preview');
    const { content, finishReason } = await model.doGenerate({
      tools: [
        {
          type: 'provider',
          id: 'google.google_search',
          name: 'google_search',
          args: {},
        },
        {
          type: 'function',
          name: 'weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "dynamic": true,
          "input": "{"query":"San Francisco weather"}",
          "providerExecuted": true,
          "providerMetadata": {
            "google": {
              "serverToolCallId": "server-call-1",
              "serverToolType": "GOOGLE_SEARCH_WEB",
              "thoughtSignature": "sig-abc",
            },
          },
          "toolCallId": "server-call-1",
          "toolName": "server:GOOGLE_SEARCH_WEB",
          "type": "tool-call",
        },
        {
          "providerMetadata": {
            "google": {
              "serverToolCallId": "server-call-1",
              "serverToolType": "GOOGLE_SEARCH_WEB",
              "thoughtSignature": "sig-def",
            },
          },
          "result": {
            "results": [
              {
                "title": "Weather in SF",
              },
            ],
          },
          "toolCallId": "server-call-1",
          "toolName": "server:GOOGLE_SEARCH_WEB",
          "type": "tool-result",
        },
        {
          "providerMetadata": undefined,
          "text": "The weather in San Francisco is sunny.",
          "type": "text",
        },
      ]
    `);

    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "STOP",
        "unified": "stop",
      }
    `);
  });

  it('should return stop finish reason for server tool calls (provider-executed)', async () => {
    server.urls[TEST_URL_GEMINI_3_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  toolCall: {
                    toolType: 'GOOGLE_SEARCH_WEB',
                    args: {},
                    id: 'sc-1',
                  },
                },
                {
                  toolResponse: {
                    toolType: 'GOOGLE_SEARCH_WEB',
                    response: { results: [] },
                    id: 'sc-1',
                  },
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 10,
          totalTokenCount: 15,
        },
      },
    };

    const model = provider.languageModel('gemini-3-pro-preview');
    const { finishReason } = await model.doGenerate({
      tools: [
        {
          type: 'provider',
          id: 'google.google_search',
          name: 'google_search',
          args: {},
        },
      ],
      prompt: TEST_PROMPT,
    });

    expect(finishReason).toMatchInlineSnapshot(`
      {
        "raw": "STOP",
        "unified": "stop",
      }
    `);
  });

  describe('search tool selection', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
      generateId: () => 'test-id',
    });

    it('should use googleSearch for gemini-2.0-pro', async () => {
      prepareJsonFixtureResponse('google-text', {
        url: TEST_URL_GEMINI_2_0_PRO,
      });

      const gemini2Pro = provider.languageModel('gemini-2.0-pro');
      await gemini2Pro.doGenerate({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'provider',
            id: 'google.google_search',
            name: 'google_search',
            args: {},
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        tools: [{ googleSearch: {} }],
      });
    });

    it('should use googleSearch for gemini-2.0-flash-exp', async () => {
      prepareJsonFixtureResponse('google-text', {
        url: TEST_URL_GEMINI_2_0_FLASH_EXP,
      });

      const gemini2Flash = provider.languageModel('gemini-2.0-flash-exp');
      await gemini2Flash.doGenerate({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'provider',
            id: 'google.google_search',
            name: 'google_search',
            args: {},
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        tools: [{ googleSearch: {} }],
      });
    });

    it('should warn for google search on non-gemini-2 models', async () => {
      prepareJsonFixtureResponse('google-text', {
        url: TEST_URL_GEMINI_1_0_PRO,
      });

      const geminiPro = provider.languageModel('gemini-1.0-pro');
      const result = await geminiPro.doGenerate({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'provider',
            id: 'google.google_search',
            name: 'google_search',
            args: {},
          },
        ],
      });

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "Google Search requires Gemini 2.0 or newer.",
            "feature": "provider-defined tool google.google_search",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should use urlContextTool for gemini-2.0-pro', async () => {
      prepareJsonFixtureResponse('google-text', {
        url: TEST_URL_GEMINI_2_0_PRO,
      });

      const gemini2Pro = provider.languageModel('gemini-2.0-pro');
      await gemini2Pro.doGenerate({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'provider',
            id: 'google.url_context',
            name: 'url_context',
            args: {},
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        tools: [{ urlContext: {} }],
      });
    });
    it('should use vertexRagStore for gemini-2.0-pro', async () => {
      prepareJsonFixtureResponse('google-text', {
        url: TEST_URL_GEMINI_2_0_PRO,
      });

      const gemini2Pro = provider.languageModel('gemini-2.0-pro');
      await gemini2Pro.doGenerate({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'provider',
            id: 'google.vertex_rag_store',
            name: 'vertex_rag_store',
            args: {
              ragCorpus:
                'projects/my-project/locations/us-central1/ragCorpora/my-rag-corpus',
              topK: 5,
            },
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        tools: [
          {
            retrieval: {
              vertex_rag_store: {
                rag_resources: {
                  rag_corpus:
                    'projects/my-project/locations/us-central1/ragCorpora/my-rag-corpus',
                },
                similarity_top_k: 5,
              },
            },
          },
        ],
      });
    });
  });

  it('should extract image file outputs', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Here is an image:' },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: 'base64encodedimagedata',
                  },
                },
                { text: 'And another image:' },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: 'anotherbase64encodedimagedata',
                  },
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        promptFeedback: { safetyRatings: SAFETY_RATINGS },
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      },
    };

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "Here is an image:",
          "type": "text",
        },
        {
          "data": {
            "data": "base64encodedimagedata",
            "type": "data",
          },
          "mediaType": "image/jpeg",
          "providerMetadata": undefined,
          "type": "file",
        },
        {
          "providerMetadata": undefined,
          "text": "And another image:",
          "type": "text",
        },
        {
          "data": {
            "data": "anotherbase64encodedimagedata",
            "type": "data",
          },
          "mediaType": "image/png",
          "providerMetadata": undefined,
          "type": "file",
        },
      ]
    `);
  });

  it('should handle responses with only images and no text', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: 'imagedata1',
                  },
                },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: 'imagedata2',
                  },
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        promptFeedback: { safetyRatings: SAFETY_RATINGS },
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      },
    };

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "data": "imagedata1",
            "type": "data",
          },
          "mediaType": "image/jpeg",
          "providerMetadata": undefined,
          "type": "file",
        },
        {
          "data": {
            "data": "imagedata2",
            "type": "data",
          },
          "mediaType": "image/png",
          "providerMetadata": undefined,
          "type": "file",
        },
      ]
    `);
  });

  it('should preserve thought flag on file parts in providerMetadata', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: 'thoughtimagedata',
                  },
                  thought: true,
                  thoughtSignature: 'img_sig1',
                },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: 'regularimagedata',
                  },
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      },
    };

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "data": "thoughtimagedata",
            "type": "data",
          },
          "mediaType": "image/png",
          "providerMetadata": {
            "google": {
              "thoughtSignature": "img_sig1",
            },
          },
          "type": "reasoning-file",
        },
        {
          "data": {
            "data": "regularimagedata",
            "type": "data",
          },
          "mediaType": "image/jpeg",
          "providerMetadata": undefined,
          "type": "file",
        },
      ]
    `);
  });

  it('should pass responseModalities in provider options', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });
  });

  it('should pass mediaResolution in provider options', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          mediaResolution: 'MEDIA_RESOLUTION_LOW',
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        mediaResolution: 'MEDIA_RESOLUTION_LOW',
      },
    });
  });

  it('should pass imageConfig.aspectRatio in provider options', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          imageConfig: {
            aspectRatio: '16:9',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        imageConfig: {
          aspectRatio: '16:9',
        },
      },
    });
  });

  it('should pass imageConfig.imageSize in provider options', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          imageConfig: {
            imageSize: '4K',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        imageConfig: {
          imageSize: '4K',
        },
      },
    });
  });

  it('should pass imageConfig with both aspectRatio and imageSize', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '2K',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '2K',
        },
      },
    });
  });

  it('should pass imageConfig.personGeneration, imageConfig.prominentPeople and imageConfig.imageOutputOptions on Vertex', async () => {
    prepareJsonFixtureResponse('google-text');

    const vertexModel = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    const { warnings } = await vertexModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          imageConfig: {
            aspectRatio: '16:9',
            personGeneration: 'ALLOW_ADULT',
            prominentPeople: 'BLOCK_PROMINENT_PEOPLE',
            imageOutputOptions: {
              mimeType: 'image/jpeg',
              compressionQuality: 75,
            },
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        imageConfig: {
          aspectRatio: '16:9',
          personGeneration: 'ALLOW_ADULT',
          prominentPeople: 'BLOCK_PROMINENT_PEOPLE',
          imageOutputOptions: {
            mimeType: 'image/jpeg',
            compressionQuality: 75,
          },
        },
      },
    });
    expect(warnings).toEqual([]);
  });

  it('should warn and drop Vertex-only imageConfig fields on the Gemini API', async () => {
    prepareJsonFixtureResponse('google-text');

    const { warnings } = await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          imageConfig: {
            aspectRatio: '16:9',
            prominentPeople: 'BLOCK_PROMINENT_PEOPLE',
          },
        },
      },
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect(requestBody.generationConfig.imageConfig).toEqual({
      aspectRatio: '16:9',
    });
    expect(warnings).toEqual([
      {
        type: 'other',
        message:
          "'imageConfig.prominentPeople' is a Vertex AI option and is " +
          'ignored with the current Google provider (google.generative-ai).',
      },
    ]);
  });

  it('should pass retrievalConfig in provider options', async () => {
    prepareJsonFixtureResponse('google-text', {
      url: TEST_URL_GEMINI_2_0_FLASH_EXP,
    });

    const gemini2Model = provider.chat('gemini-2.0-flash-exp');

    await gemini2Model.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'provider',
          id: 'google.google_maps',
          name: 'google_maps',
          args: {},
        },
      ],
      providerOptions: {
        google: {
          retrievalConfig: {
            latLng: {
              latitude: 34.090199,
              longitude: -117.881081,
            },
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: 34.090199,
            longitude: -117.881081,
          },
        },
      },
    });
  });

  it('should include non-image inlineData parts', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Here is content:' },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: 'validimagedata',
                  },
                },
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: 'pdfdata',
                  },
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        promptFeedback: { safetyRatings: SAFETY_RATINGS },
      },
    };

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "Here is content:",
          "type": "text",
        },
        {
          "data": {
            "data": "validimagedata",
            "type": "data",
          },
          "mediaType": "image/jpeg",
          "providerMetadata": undefined,
          "type": "file",
        },
        {
          "data": {
            "data": "pdfdata",
            "type": "data",
          },
          "mediaType": "application/pdf",
          "providerMetadata": undefined,
          "type": "file",
        },
      ]
    `);
  });
  it('should correctly parse and separate reasoning parts from text output', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Visible text part 1. ' },
                { text: 'This is a thought process.', thought: true },
                { text: 'Visible text part 2.' },
                { text: 'Another internal thought.', thought: true },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      },
    };

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": undefined,
          "text": "Visible text part 1. ",
          "type": "text",
        },
        {
          "providerMetadata": undefined,
          "text": "This is a thought process.",
          "type": "reasoning",
        },
        {
          "providerMetadata": undefined,
          "text": "Visible text part 2.",
          "type": "text",
        },
        {
          "providerMetadata": undefined,
          "text": "Another internal thought.",
          "type": "reasoning",
        },
      ]
    `);
  });

  it('should correctly parse thought signatures with reasoning parts', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Visible text part 1. ', thoughtSignature: 'sig1' },
                {
                  text: 'This is a thought process.',
                  thought: true,
                  thoughtSignature: 'sig2',
                },
                { text: 'Visible text part 2.', thoughtSignature: 'sig3' },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      },
    };

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": {
            "google": {
              "thoughtSignature": "sig1",
            },
          },
          "text": "Visible text part 1. ",
          "type": "text",
        },
        {
          "providerMetadata": {
            "google": {
              "thoughtSignature": "sig2",
            },
          },
          "text": "This is a thought process.",
          "type": "reasoning",
        },
        {
          "providerMetadata": {
            "google": {
              "thoughtSignature": "sig3",
            },
          },
          "text": "Visible text part 2.",
          "type": "text",
        },
      ]
    `);
  });

  it('should correctly parse thought signatures with function calls', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'test-tool',
                    args: { value: 'test' },
                  },
                  thoughtSignature: 'func_sig1',
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      },
    };

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "input": "{"value":"test"}",
          "providerMetadata": {
            "google": {
              "thoughtSignature": "func_sig1",
            },
          },
          "toolCallId": "test-id",
          "toolName": "test-tool",
          "type": "tool-call",
        },
      ]
    `);
  });

  it('should support includeThoughts with google generative ai provider', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'let me think about this problem',
                  thought: true,
                  thoughtSignature: 'reasoning_sig',
                },
                { text: 'the answer is 42' },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 15,
          totalTokenCount: 25,
          thoughtsTokenCount: 8,
        },
      },
    };

    const { content, usage } = await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: 1024,
          },
        },
      },
    });

    expect(content).toMatchInlineSnapshot(`
      [
        {
          "providerMetadata": {
            "google": {
              "thoughtSignature": "reasoning_sig",
            },
          },
          "text": "let me think about this problem",
          "type": "reasoning",
        },
        {
          "providerMetadata": undefined,
          "text": "the answer is 42",
          "type": "text",
        },
      ]
    `);

    expect(usage).toMatchInlineSnapshot(`
      {
        "inputTokens": {
          "cacheRead": 0,
          "cacheWrite": undefined,
          "noCache": 10,
          "total": 10,
        },
        "outputTokens": {
          "reasoning": 8,
          "text": 15,
          "total": 23,
        },
        "raw": {
          "candidatesTokenCount": 15,
          "promptTokenCount": 10,
          "thoughtsTokenCount": 8,
          "totalTokenCount": 25,
        },
      }
    `);
  });

  it('should pass thinkingLevel in provider options', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingLevel: 'high',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: 'high',
        },
      },
    });
  });

  it('should pass thinkingLevel "minimal" in provider options', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingLevel: 'minimal',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: 'minimal',
        },
      },
    });
  });

  it('should pass thinkingLevel "medium" in provider options', async () => {
    prepareJsonFixtureResponse('google-text');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingLevel: 'medium',
          },
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: 'medium',
        },
      },
    });
  });

  describe('top-level reasoning option', () => {
    const simpleResponseBody = {
      candidates: [
        {
          content: { parts: [{ text: 'response' }], role: 'model' },
          finishReason: 'STOP',
          safetyRatings: SAFETY_RATINGS,
        },
      ],
      usageMetadata: {
        promptTokenCount: 1,
        candidatesTokenCount: 2,
        totalTokenCount: 3,
      },
    };

    describe('Gemini 3 models (thinkingLevel)', () => {
      const gemini3Model = provider.chat('gemini-3-pro-preview');

      it('should map reasoning "minimal" to thinkingLevel "minimal"', async () => {
        server.urls[TEST_URL_GEMINI_3_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini3Model.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'minimal',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingLevel: 'minimal' },
          },
        });
      });

      it('should map reasoning "low" to thinkingLevel "low"', async () => {
        server.urls[TEST_URL_GEMINI_3_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini3Model.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'low',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingLevel: 'low' },
          },
        });
      });

      it('should map reasoning "medium" to thinkingLevel "medium"', async () => {
        server.urls[TEST_URL_GEMINI_3_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini3Model.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'medium',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingLevel: 'medium' },
          },
        });
      });

      it('should map reasoning "high" to thinkingLevel "high"', async () => {
        server.urls[TEST_URL_GEMINI_3_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini3Model.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'high',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingLevel: 'high' },
          },
        });
      });

      it('should map reasoning "none" to thinkingLevel "minimal"', async () => {
        server.urls[TEST_URL_GEMINI_3_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini3Model.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'none',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingLevel: 'minimal' },
          },
        });
      });

      it('should coerce reasoning "xhigh" to "high" with compatibility warning', async () => {
        server.urls[TEST_URL_GEMINI_3_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        const result = await gemini3Model.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'xhigh',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingLevel: 'high' },
          },
        });

        expect(result.warnings).toContainEqual({
          type: 'compatibility',
          feature: 'reasoning',
          details:
            'reasoning "xhigh" is not directly supported by this model. mapped to effort "high".',
        });
      });

      it('should also detect gemini-3.1 models as Gemini 3', async () => {
        const gemini31Model = provider.chat('gemini-3.1-pro-preview');

        server.urls[TEST_URL_GEMINI_3_1_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini31Model.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'medium',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingLevel: 'medium' },
          },
        });
      });
    });

    describe('Gemini 2.5 models (thinkingBudget)', () => {
      const gemini25ProModel = provider.chat('gemini-2.5-pro');
      const gemini25FlashLiteModel = provider.chat('gemini-2.5-flash-lite');

      it('should map reasoning "none" to thinkingBudget 0', async () => {
        server.urls[TEST_URL_GEMINI_2_5_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini25ProModel.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'none',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
      });

      it('should map reasoning "minimal" to ~2% of maxOutputTokens', async () => {
        server.urls[TEST_URL_GEMINI_2_5_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini25ProModel.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'minimal',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingBudget: Math.round(65536 * 0.02) },
          },
        });
      });

      it('should map reasoning "low" to ~10% of maxOutputTokens', async () => {
        server.urls[TEST_URL_GEMINI_2_5_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini25ProModel.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'low',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingBudget: Math.round(65536 * 0.1) },
          },
        });
      });

      it('should map reasoning "medium" to ~30% of maxOutputTokens', async () => {
        server.urls[TEST_URL_GEMINI_2_5_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini25ProModel.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'medium',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingBudget: Math.round(65536 * 0.3) },
          },
        });
      });

      it('should map reasoning "high" to ~60% of maxOutputTokens', async () => {
        server.urls[TEST_URL_GEMINI_2_5_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini25ProModel.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'high',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingBudget: 32768 },
          },
        });
      });

      it('should map reasoning "xhigh" to ~90% of maxOutputTokens', async () => {
        server.urls[TEST_URL_GEMINI_2_5_PRO].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini25ProModel.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'xhigh',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingBudget: 32768 },
          },
        });
      });

      it('should use lower maxOutputTokens for flash-lite models', async () => {
        server.urls[TEST_URL_GEMINI_2_5_FLASH_LITE].response = {
          type: 'json-value',
          body: simpleResponseBody,
        };

        await gemini25FlashLiteModel.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'medium',
        });

        expect(await server.calls[0].requestBodyJson).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingBudget: Math.round(65536 * 0.3) },
          },
        });
      });
    });

    describe('providerOptions precedence', () => {
      it('should use providerOptions thinkingConfig when both reasoning and providerOptions are set', async () => {
        prepareJsonFixtureResponse('google-text');

        await model.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'high',
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: 999,
              },
            },
          },
        });

        const body = await server.calls[0].requestBodyJson;
        expect(body).toMatchObject({
          generationConfig: {
            thinkingConfig: { thinkingBudget: 999 },
          },
        });
        expect(
          body.generationConfig.thinkingConfig.thinkingLevel,
        ).toBeUndefined();
      });

      it('should not set thinkingConfig when neither reasoning nor providerOptions are set', async () => {
        prepareJsonFixtureResponse('google-text');

        await model.doGenerate({
          prompt: TEST_PROMPT,
        });

        const body = await server.calls[0].requestBodyJson;
        expect(body.generationConfig.thinkingConfig).toBeUndefined();
      });

      it('should not set thinkingConfig when reasoning is "provider-default"', async () => {
        prepareJsonFixtureResponse('google-text');

        await model.doGenerate({
          prompt: TEST_PROMPT,
          reasoning: 'provider-default',
        });

        const body = await server.calls[0].requestBodyJson;
        expect(body.generationConfig.thinkingConfig).toBeUndefined();
      });
    });
  });

  describe('providerMetadata key based on provider string', () => {
    it('should use "vertex" as providerMetadata key when provider includes "vertex"', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'json-value',
        body: {
          candidates: [
            {
              content: { parts: [{ text: 'Hello!' }], role: 'model' },
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
              groundingMetadata: {
                webSearchQueries: ['test query'],
              },
            },
          ],
          promptFeedback: { safetyRatings: SAFETY_RATINGS },
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 2,
            totalTokenCount: 3,
          },
        },
      };

      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.vertex.chat',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { providerMetadata } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(providerMetadata).toHaveProperty('vertex');
      expect(providerMetadata).not.toHaveProperty('google');
      expect(providerMetadata?.vertex).toMatchObject({
        promptFeedback: expect.any(Object),
        groundingMetadata: expect.any(Object),
        safetyRatings: expect.any(Array),
      });
    });

    it('should use "google" as providerMetadata key when provider does not include "vertex"', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'json-value',
        body: {
          candidates: [
            {
              content: { parts: [{ text: 'Hello!' }], role: 'model' },
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
              groundingMetadata: {
                webSearchQueries: ['test query'],
              },
            },
          ],
          promptFeedback: { safetyRatings: SAFETY_RATINGS },
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 2,
            totalTokenCount: 3,
          },
        },
      };

      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.generative-ai',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
        //should default to 'google'
      });

      const { providerMetadata } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(providerMetadata).toHaveProperty('google');
      expect(providerMetadata).not.toHaveProperty('vertex');
      expect(providerMetadata?.google).toMatchObject({
        promptFeedback: expect.any(Object),
        groundingMetadata: expect.any(Object),
        safetyRatings: expect.any(Array),
      });
    });

    it('should use "vertex" as providerMetadata key in thoughtSignature content when provider includes "vertex"', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'json-value',
        body: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'thinking...',
                    thought: true,
                    thoughtSignature: 'sig123',
                  },
                  { text: 'Final answer' },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          promptFeedback: { safetyRatings: SAFETY_RATINGS },
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 2,
            totalTokenCount: 3,
          },
        },
      };

      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.vertex.chat',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { content } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      const reasoningPart = content.find(part => part.type === 'reasoning');
      expect(reasoningPart?.providerMetadata).toHaveProperty('vertex');
      expect(reasoningPart?.providerMetadata).not.toHaveProperty('google');
      expect(reasoningPart?.providerMetadata?.vertex).toMatchObject({
        thoughtSignature: 'sig123',
      });
    });

    it('should use "vertex" as providerMetadata key in tool call content when provider includes "vertex"', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'json-value',
        body: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'test-tool',
                      args: { value: 'test' },
                    },
                    thoughtSignature: 'tool_sig',
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          promptFeedback: { safetyRatings: SAFETY_RATINGS },
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 2,
            totalTokenCount: 3,
          },
        },
      };

      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.vertex.chat',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { content } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      const toolCallPart = content.find(part => part.type === 'tool-call');
      expect(toolCallPart?.providerMetadata).toHaveProperty('vertex');
      expect(toolCallPart?.providerMetadata).not.toHaveProperty('google');
      expect(toolCallPart?.providerMetadata?.vertex).toMatchObject({
        thoughtSignature: 'tool_sig',
      });
    });
  });
});

describe('doStream', () => {
  const TEST_URL_GEMINI_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent';

  const TEST_URL_GEMINI_2_0_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:streamGenerateContent';

  const TEST_URL_GEMINI_2_0_FLASH_EXP =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent';

  const TEST_URL_GEMINI_1_0_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:streamGenerateContent';

  const TEST_URL_GEMINI_1_5_FLASH =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent';

  const TEST_URL_GEMINI_3_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent';

  const server = createTestServer({
    [TEST_URL_GEMINI_PRO]: {},
    [TEST_URL_GEMINI_2_0_PRO]: {},
    [TEST_URL_GEMINI_2_0_FLASH_EXP]: {},
    [TEST_URL_GEMINI_1_0_PRO]: {},
    [TEST_URL_GEMINI_1_5_FLASH]: {},
    [TEST_URL_GEMINI_3_PRO]: {},
  });

  function prepareChunksFixtureResponse(
    filename: string,
    {
      headers,
      url = TEST_URL_GEMINI_PRO,
    }: {
      headers?: Record<string, string>;
      url?:
        | typeof TEST_URL_GEMINI_PRO
        | typeof TEST_URL_GEMINI_2_0_PRO
        | typeof TEST_URL_GEMINI_2_0_FLASH_EXP
        | typeof TEST_URL_GEMINI_1_0_PRO
        | typeof TEST_URL_GEMINI_1_5_FLASH;
    } = {},
  ) {
    const chunks = fs
      .readFileSync(`src/__fixtures__/${filename}.chunks.txt`, 'utf8')
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => `data: ${line}\n\n`);

    server.urls[url].response = {
      type: 'stream-chunks',
      headers,
      chunks,
    };
  }

  const prepareStreamResponse = ({
    content,
    headers,
    groundingMetadata,
    urlContextMetadata,
    url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent',
  }: {
    content: string[];
    headers?: Record<string, string>;
    groundingMetadata?: GoogleGroundingMetadata;
    urlContextMetadata?: GoogleUrlContextMetadata;
    url?:
      | typeof TEST_URL_GEMINI_PRO
      | typeof TEST_URL_GEMINI_2_0_PRO
      | typeof TEST_URL_GEMINI_2_0_FLASH_EXP
      | typeof TEST_URL_GEMINI_1_0_PRO
      | typeof TEST_URL_GEMINI_1_5_FLASH;
  }) => {
    server.urls[url].response = {
      headers,
      type: 'stream-chunks',
      chunks: content.map(
        (text, index) =>
          `data: ${JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text }], role: 'model' },
                finishReason: 'STOP',
                index: 0,
                safetyRatings: SAFETY_RATINGS,
                ...(groundingMetadata && { groundingMetadata }),
                ...(urlContextMetadata && { urlContextMetadata }),
              },
            ],
            // Include usage metadata only in the last chunk
            ...(index === content.length - 1 && {
              usageMetadata: {
                promptTokenCount: 294,
                candidatesTokenCount: 233,
                totalTokenCount: 527,
              },
            }),
          })}\n\n`,
      ),
    };
  };

  describe('text', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('google-text');
    });

    it('should stream text deltas', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });

    it('should include raw chunks when includeRawChunks is enabled', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: true,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks.filter(chunk => chunk.type === 'raw')).toMatchSnapshot();
    });

    it('should not include raw chunks when includeRawChunks is false', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      const chunks = await convertReadableStreamToArray(stream);

      expect(chunks.filter(chunk => chunk.type === 'raw')).toHaveLength(0);
    });

    it('should expose the raw response headers', async () => {
      prepareChunksFixtureResponse('google-text', {
        headers: { 'test-header': 'test-value' },
      });

      const { response } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(response?.headers).toMatchInlineSnapshot(`
        {
          "cache-control": "no-cache",
          "connection": "keep-alive",
          "content-type": "text/event-stream",
          "test-header": "test-value",
        }
      `);
    });
  });

  describe('tool-call', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('google-tool-call');
    });

    it('should stream tool call', async () => {
      const { stream } = await model.doStream({
        tools: [
          {
            type: 'function',
            name: 'weather',
            inputSchema: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  describe('reasoning', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('google-reasoning');
    });

    it('should stream reasoning and text parts', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  describe('reasoning-gemini3', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('google-reasoning-gemini3');
    });

    it('should stream reasoning with thoughtSignature', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  describe('tool-call-gemini3', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('google-tool-call-gemini3');
    });

    it('should stream tool call with thoughtSignature', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  describe('streaming-tool-call-arguments', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('google-stream-tool-call-arguments');
    });

    it('should stream partial function call arguments with parallel tool calls', async () => {
      const vertexModel = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.vertex.chat',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { stream } = await vertexModel.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        tools: [
          {
            type: 'function',
            name: 'getWeather',
            inputSchema: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  describe('streaming-tool-call-array-arguments', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse(
        'google-stream-tool-call-array-arguments-missing-terminal-function-call',
      );
    });

    it('should finalize streamed function call arguments when the final partialArgs chunk omits willContinue', async () => {
      const vertexModel = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.vertex.chat',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { stream } = await vertexModel.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        tools: [
          {
            type: 'function',
            name: 'writeItems',
            inputSchema: {
              type: 'object',
              properties: {
                operations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      action: { type: 'string' },
                      description: { type: 'string' },
                      itemid: { type: 'string' },
                      price: { type: 'number' },
                    },
                    required: ['action', 'description', 'itemid', 'price'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['operations'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        providerOptions: {
          vertex: {
            streamFunctionCallArguments: true,
          },
        },
      });

      const events = await convertReadableStreamToArray(stream);
      const inputDeltas = events.filter(e => e.type === 'tool-input-delta');
      const toolCalls = events.filter(e => e.type === 'tool-call');
      const finish = events.find(e => e.type === 'finish');

      expect(inputDeltas.map(e => e.delta).join('')).toMatchInlineSnapshot(
        `"{"operations":[{"action":"add","description":"Fresh red apple","itemid":"apple_001","price":0.5},{"action":"add","description":"Ripe yellow banana","itemid":"banana_001","price":0.3}]}"`,
      );
      expect(toolCalls.map(c => ({ toolName: c.toolName, input: c.input })))
        .toMatchInlineSnapshot(`
        [
          {
            "input": "{"operations":[{"action":"add","description":"Fresh red apple","itemid":"apple_001","price":0.5},{"action":"add","description":"Ripe yellow banana","itemid":"banana_001","price":0.3}]}",
            "toolName": "writeItems",
          },
        ]
      `);
      expect(finish?.finishReason.unified).toBe('tool-calls');
    });
  });

  describe('streaming-no-args-tool-call', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('google-stream-no-args-tool-call');
    });

    it('should emit no-args function calls and preserve thoughtSignature alongside streamed-args calls', async () => {
      const vertexModel = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.vertex.chat',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { stream } = await vertexModel.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        tools: [
          {
            type: 'function',
            name: 'read_theme',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
          {
            type: 'function',
            name: 'read_screen',
            inputSchema: {
              type: 'object',
              properties: { id: { type: 'string' } },
              required: ['id'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        ],
        providerOptions: {
          vertex: {
            streamFunctionCallArguments: true,
          },
        },
      });

      const events = await convertReadableStreamToArray(stream);

      // The fixture is a real Vertex recording where the model picked the
      // no-args `read_theme` first (carrying the response's only
      // thoughtSignature), then streamed three parallel `read_screen` calls
      // for A, B, C. Pre-fix the read_theme call and its signature were
      // dropped entirely.
      const toolCalls = events.filter(e => e.type === 'tool-call');
      expect(
        toolCalls.map(c => ({ toolName: c.toolName, input: c.input })),
      ).toEqual([
        { toolName: 'read_theme', input: '{}' },
        { toolName: 'read_screen', input: '{"id":"A"}' },
        { toolName: 'read_screen', input: '{"id":"B"}' },
        { toolName: 'read_screen', input: '{"id":"C"}' },
      ]);

      const readThemeCall = toolCalls.find(c => c.toolName === 'read_theme')!;
      const signature =
        readThemeCall.providerMetadata?.vertex?.thoughtSignature;
      expect(typeof signature).toBe('string');
      expect((signature as string).length).toBeGreaterThan(100);
      expect(
        readThemeCall.providerMetadata?.googleVertex?.thoughtSignature,
      ).toBe(signature);

      // The no-args call must emit start/end framing too, so the signature
      // is exposed at every stage downstream consumers might inspect.
      const toolInputStarts = events.filter(e => e.type === 'tool-input-start');
      const noArgsStart = toolInputStarts.find(
        e => e.toolName === 'read_theme',
      );
      expect(noArgsStart?.providerMetadata?.vertex?.thoughtSignature).toBe(
        signature,
      );

      const toolInputEnds = events.filter(e => e.type === 'tool-input-end');
      const noArgsEnd = toolInputEnds.find(
        e => e.providerMetadata?.vertex?.thoughtSignature === signature,
      );
      expect(noArgsEnd).toBeDefined();

      // The no-args branch must not emit any tool-input-delta events.
      const deltas = events.filter(e => e.type === 'tool-input-delta');
      expect(
        deltas.every(
          e => e.providerMetadata?.vertex?.thoughtSignature !== signature,
        ),
      ).toBe(true);
    });
  });

  describe('streaming-tool-call-arguments-nested', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse(
        'google-vertex-stream-tool-call-arguments-nested.1',
      );
    });

    it('should stream nested partial function call arguments into proper nested JSON', async () => {
      const vertexModel = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.vertex.chat',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { stream } = await vertexModel.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        tools: [
          {
            type: 'function',
            name: 'cookRecipe',
            inputSchema: {
              type: 'object',
              properties: {
                recipe: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    ingredients: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          amount: { type: 'string' },
                        },
                      },
                    },
                    steps: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        ],
      });

      expect(await convertReadableStreamToArray(stream)).toMatchSnapshot();
    });
  });

  it('should expose grounding metadata in provider metadata on finish', async () => {
    prepareStreamResponse({
      content: ['test'],
      groundingMetadata: {
        webSearchQueries: ["What's the weather in Chicago this weekend?"],
        searchEntryPoint: {
          renderedContent: 'Sample rendered content for search results',
        },
        groundingChunks: [
          {
            web: {
              uri: 'https://example.com/weather',
              title: 'Chicago Weather Forecast',
            },
          },
        ],
        groundingSupports: [
          {
            segment: {
              startIndex: 0,
              endIndex: 65,
              text: 'Chicago weather changes rapidly, so layers let you adjust easily.',
            },
            groundingChunkIndices: [0],
            confidenceScores: [0.99],
          },
        ],
        retrievalMetadata: {
          webDynamicRetrievalScore: 0.96879,
        },
      },
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.groundingMetadata,
    ).toMatchInlineSnapshot(`
      {
        "groundingChunks": [
          {
            "web": {
              "title": "Chicago Weather Forecast",
              "uri": "https://example.com/weather",
            },
          },
        ],
        "groundingSupports": [
          {
            "confidenceScores": [
              0.99,
            ],
            "groundingChunkIndices": [
              0,
            ],
            "segment": {
              "endIndex": 65,
              "startIndex": 0,
              "text": "Chicago weather changes rapidly, so layers let you adjust easily.",
            },
          },
        ],
        "retrievalMetadata": {
          "webDynamicRetrievalScore": 0.96879,
        },
        "searchEntryPoint": {
          "renderedContent": "Sample rendered content for search results",
        },
        "webSearchQueries": [
          "What's the weather in Chicago this weekend?",
        ],
      }
    `);
  });

  it('should preserve grounding metadata when it arrives before the finishReason chunk', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'hello' }], role: 'model' },
              index: 0,
              groundingMetadata: {
                webSearchQueries: ['super bowl 2026 halftime show'],
                groundingChunks: [
                  {
                    web: {
                      uri: 'https://example.com/superbowl',
                      title: 'Super Bowl 2026',
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: ' world' }], role: 'model' },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 38,
            candidatesTokenCount: 1335,
            totalTokenCount: 1890,
          },
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.groundingMetadata,
    ).toEqual({
      webSearchQueries: ['super bowl 2026 halftime show'],
      groundingChunks: [
        {
          web: {
            uri: 'https://example.com/superbowl',
            title: 'Super Bowl 2026',
          },
        },
      ],
    });

    expect(events.filter(e => e.type === 'source')).toHaveLength(1);
  });

  it('should preserve url context metadata when it arrives before the finishReason chunk', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'hello' }], role: 'model' },
              index: 0,
              urlContextMetadata: {
                urlMetadata: [
                  {
                    retrievedUrl: 'https://example.com/page',
                    urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS',
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: ' world' }], role: 'model' },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.urlContextMetadata,
    ).toEqual({
      urlMetadata: [
        {
          retrievedUrl: 'https://example.com/page',
          urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS',
        },
      ],
    });
  });

  it('should expose url context metadata in provider metadata on finish', async () => {
    prepareStreamResponse({
      content: ['test'],
      urlContextMetadata: {
        urlMetadata: [
          {
            retrievedUrl: 'https://example.com/weather',
            urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS',
          },
        ],
      },
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.urlContextMetadata,
    ).toMatchInlineSnapshot(`
      {
        "urlMetadata": [
          {
            "retrievedUrl": "https://example.com/weather",
            "urlRetrievalStatus": "URL_RETRIEVAL_STATUS_SUCCESS",
          },
        ],
      }
    `);
  });

  it('should expose safety ratings in provider metadata on finish', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"candidates": [{"content": {"parts": [{"text": "test"}],"role": "model"},` +
          `"finishReason": "STOP","index": 0,"safetyRatings": [` +
          `{"category": "HARM_CATEGORY_DANGEROUS_CONTENT","probability": "NEGLIGIBLE",` +
          `"probabilityScore": 0.1,"severity": "LOW","severityScore": 0.2,"blocked": false}]}]}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.safetyRatings,
    ).toMatchInlineSnapshot(`
      [
        {
          "blocked": false,
          "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
          "probability": "NEGLIGIBLE",
          "probabilityScore": 0.1,
          "severity": "LOW",
          "severityScore": 0.2,
        },
      ]
    `);
  });

  it('should expose PromptFeedback in provider metadata on finish', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"candidates": [{"content": {"parts": [{"text": "No"}],"role": "model"},` +
          `"finishReason": "PROHIBITED_CONTENT","index": 0}],` +
          `"promptFeedback": {"blockReason": "PROHIBITED_CONTENT","safetyRatings": [` +
          `{"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT","probability": "NEGLIGIBLE"},` +
          `{"category": "HARM_CATEGORY_HATE_SPEECH","probability": "NEGLIGIBLE"},` +
          `{"category": "HARM_CATEGORY_HARASSMENT","probability": "NEGLIGIBLE"},` +
          `{"category": "HARM_CATEGORY_DANGEROUS_CONTENT","probability": "NEGLIGIBLE"}]}}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.promptFeedback,
    ).toMatchInlineSnapshot(`
      {
        "blockReason": "PROHIBITED_CONTENT",
        "safetyRatings": [
          {
            "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "probability": "NEGLIGIBLE",
          },
          {
            "category": "HARM_CATEGORY_HATE_SPEECH",
            "probability": "NEGLIGIBLE",
          },
          {
            "category": "HARM_CATEGORY_HARASSMENT",
            "probability": "NEGLIGIBLE",
          },
          {
            "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
            "probability": "NEGLIGIBLE",
          },
        ],
      }
    `);
  });

  it('should expose finishMessage in provider metadata on finish', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {},
              finishReason: 'MALFORMED_FUNCTION_CALL',
              finishMessage:
                "Malformed function call: print(default_api.create(name='test'))",
            },
          ],
          usageMetadata: {
            promptTokenCount: 130,
            totalTokenCount: 130,
            promptTokensDetails: [{ modality: 'TEXT', tokenCount: 130 }],
          },
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.finishMessage,
    ).toBe("Malformed function call: print(default_api.create(name='test'))");
  });

  it('should expose null finishMessage in provider metadata on finish when not present', async () => {
    prepareStreamResponse({ content: ['test'] });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.finishMessage,
    ).toBeNull();
  });

  it('should read serviceTier from chunk usageMetadata', async () => {
    // Gemini streaming does not set the x-gemini-service-tier response header
    // but does include serviceTier in each chunk's usageMetadata.
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'Blue' }], role: 'model' },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 1,
            totalTokenCount: 11,
            serviceTier: 'priority',
          },
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.serviceTier,
    ).toBe('priority');
  });

  it('should expose null serviceTier in provider metadata on finish when not present', async () => {
    prepareStreamResponse({ content: ['test'] });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(
      finishEvent?.type === 'finish' &&
        finishEvent.providerMetadata?.google.serviceTier,
    ).toBeNull();
  });

  it('should stream code execution tool calls and results', async () => {
    server.urls[TEST_URL_GEMINI_2_0_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    executableCode: {
                      language: 'PYTHON',
                      code: 'print("hello")',
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    codeExecutionResult: {
                      outcome: 'OUTCOME_OK',
                      output: 'hello\n',
                    },
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        })}\n\n`,
      ],
    };

    const model = provider.languageModel('gemini-2.0-pro');
    const { stream } = await model.doStream({
      tools: [
        {
          type: 'provider',
          id: 'google.code_execution',
          name: 'code_execution',
          args: {},
        },
      ],
      prompt: TEST_PROMPT,
    });

    const events = await convertReadableStreamToArray(stream);

    const toolEvents = events.filter(
      e => e.type === 'tool-call' || e.type === 'tool-result',
    );

    expect(toolEvents).toMatchInlineSnapshot(`
      [
        {
          "input": "{"language":"PYTHON","code":"print(\\"hello\\")"}",
          "providerExecuted": true,
          "toolCallId": "test-id",
          "toolName": "code_execution",
          "type": "tool-call",
        },
        {
          "result": {
            "outcome": "OUTCOME_OK",
            "output": "hello
      ",
          },
          "toolCallId": "test-id",
          "toolName": "code_execution",
          "type": "tool-result",
        },
      ]
    `);
  });

  it('should stream code execution result with missing output field', async () => {
    server.urls[TEST_URL_GEMINI_2_0_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    executableCode: {
                      language: 'PYTHON',
                      code: "img = PIL.Image.open('input.png')\nimg.save('output.png')\n",
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    codeExecutionResult: {
                      outcome: 'OUTCOME_OK',
                    },
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        })}\n\n`,
      ],
    };

    const model = provider.languageModel('gemini-2.0-pro');
    const { stream } = await model.doStream({
      tools: [
        {
          type: 'provider',
          id: 'google.code_execution',
          name: 'code_execution',
          args: {},
        },
      ],
      prompt: TEST_PROMPT,
    });

    const events = await convertReadableStreamToArray(stream);

    const toolEvents = events.filter(
      e => e.type === 'tool-call' || e.type === 'tool-result',
    );

    expect(toolEvents).toMatchInlineSnapshot(`
      [
        {
          "input": "{"language":"PYTHON","code":"img = PIL.Image.open('input.png')\\nimg.save('output.png')\\n"}",
          "providerExecuted": true,
          "toolCallId": "test-id",
          "toolName": "code_execution",
          "type": "tool-call",
        },
        {
          "result": {
            "outcome": "OUTCOME_OK",
            "output": "",
          },
          "toolCallId": "test-id",
          "toolName": "code_execution",
          "type": "tool-result",
        },
      ]
    `);
  });

  it('should return stop finish reason for streamed code execution (provider-executed tool)', async () => {
    server.urls[TEST_URL_GEMINI_2_0_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    executableCode: {
                      language: 'PYTHON',
                      code: 'print("hello")',
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    codeExecutionResult: {
                      outcome: 'OUTCOME_OK',
                      output: 'hello\n',
                    },
                  },
                  {
                    text: '{"result": "hello"}',
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        })}\n\n`,
      ],
    };

    const model = provider.languageModel('gemini-2.0-pro');
    const { stream } = await model.doStream({
      tools: [
        {
          type: 'provider',
          id: 'google.code_execution',
          name: 'code_execution',
          args: {},
        },
      ],
      prompt: TEST_PROMPT,
    });

    const events = await convertReadableStreamToArray(stream);

    const finishEvent = events.find(e => e.type === 'finish');

    // Provider-executed tools should not trigger 'tool-calls' finish reason
    // since they don't require SDK iteration - allows structured output to work
    expect(finishEvent).toMatchObject({
      type: 'finish',
      finishReason: {
        raw: 'STOP',
        unified: 'stop',
      },
    });
  });

  it('should stream server-side toolCall and toolResponse parts (tool combination)', async () => {
    server.urls[TEST_URL_GEMINI_3_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    toolCall: {
                      toolType: 'GOOGLE_SEARCH_WEB',
                      args: { query: 'SF weather' },
                      id: 'sc-1',
                    },
                    thoughtSignature: 'sig-1',
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    toolResponse: {
                      toolType: 'GOOGLE_SEARCH_WEB',
                      response: { results: [{ title: 'Weather' }] },
                      id: 'sc-1',
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'It is sunny.' }],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        })}\n\n`,
      ],
    };

    const model = provider.languageModel('gemini-3-pro-preview');
    const { stream } = await model.doStream({
      tools: [
        {
          type: 'provider',
          id: 'google.google_search',
          name: 'google_search',
          args: {},
        },
      ],
      prompt: TEST_PROMPT,
    });

    const events = await convertReadableStreamToArray(stream);

    const toolEvents = events.filter(
      e => e.type === 'tool-call' || e.type === 'tool-result',
    );

    expect(toolEvents).toMatchInlineSnapshot(`
      [
        {
          "dynamic": true,
          "input": "{"query":"SF weather"}",
          "providerExecuted": true,
          "providerMetadata": {
            "google": {
              "serverToolCallId": "sc-1",
              "serverToolType": "GOOGLE_SEARCH_WEB",
              "thoughtSignature": "sig-1",
            },
          },
          "toolCallId": "sc-1",
          "toolName": "server:GOOGLE_SEARCH_WEB",
          "type": "tool-call",
        },
        {
          "providerMetadata": {
            "google": {
              "serverToolCallId": "sc-1",
              "serverToolType": "GOOGLE_SEARCH_WEB",
            },
          },
          "result": {
            "results": [
              {
                "title": "Weather",
              },
            ],
          },
          "toolCallId": "sc-1",
          "toolName": "server:GOOGLE_SEARCH_WEB",
          "type": "tool-result",
        },
      ]
    `);

    const textEvents = events.filter(e => e.type === 'text-delta');
    expect(textEvents).toMatchInlineSnapshot(`
      [
        {
          "delta": "It is sunny.",
          "id": "0",
          "providerMetadata": undefined,
          "type": "text-delta",
        },
      ]
    `);

    const finishEvent = events.find(e => e.type === 'finish');
    expect(finishEvent).toMatchObject({
      type: 'finish',
      finishReason: {
        raw: 'STOP',
        unified: 'stop',
      },
    });
  });

  describe('search tool selection', () => {
    const provider = createGoogle({
      apiKey: 'test-api-key',
      generateId: () => 'test-id',
    });

    it('should use googleSearch for gemini-2.0-pro', async () => {
      prepareStreamResponse({
        content: [''],
        url: TEST_URL_GEMINI_2_0_PRO,
      });

      const gemini2Pro = provider.languageModel('gemini-2.0-pro');
      await gemini2Pro.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        tools: [
          {
            type: 'provider',
            id: 'google.google_search',
            name: 'google_search',
            args: {},
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        tools: [{ googleSearch: {} }],
      });
    });

    it('should use googleSearch for gemini-2.0-flash-exp', async () => {
      prepareStreamResponse({
        content: [''],
        url: TEST_URL_GEMINI_2_0_FLASH_EXP,
      });

      const gemini2Flash = provider.languageModel('gemini-2.0-flash-exp');

      await gemini2Flash.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        tools: [
          {
            type: 'provider',
            id: 'google.google_search',
            name: 'google_search',
            args: {},
          },
        ],
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        tools: [{ googleSearch: {} }],
      });
    });

    it('should warn for google search on non-gemini-2 models', async () => {
      prepareStreamResponse({
        content: [''],
        url: TEST_URL_GEMINI_1_0_PRO,
      });

      const geminiPro = provider.languageModel('gemini-1.0-pro');
      const { stream } = await geminiPro.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        tools: [
          {
            type: 'provider',
            id: 'google.google_search',
            name: 'google_search',
            args: {},
          },
        ],
      });

      const events = await convertReadableStreamToArray(stream);

      expect(events[0]).toMatchInlineSnapshot(`
        {
          "type": "stream-start",
          "warnings": [
            {
              "details": "Google Search requires Gemini 2.0 or newer.",
              "feature": "provider-defined tool google.google_search",
              "type": "unsupported",
            },
          ],
        }
      `);
    });
  });

  it('should stream source events', async () => {
    prepareStreamResponse({
      content: ['Some initial text'],
      groundingMetadata: {
        groundingChunks: [
          {
            web: {
              uri: 'https://source.example.com',
              title: 'Source Title',
            },
          },
        ],
      },
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const sourceEvents = events.filter(event => event.type === 'source');

    expect(sourceEvents).toMatchInlineSnapshot(`
      [
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "Source Title",
          "type": "source",
          "url": "https://source.example.com",
        },
      ]
    `);
  });

  it('should stream source events from image grounding metadata', async () => {
    prepareStreamResponse({
      content: ['image search response'],
      groundingMetadata: {
        groundingChunks: [
          {
            image: {
              sourceUri: 'https://example.com/article',
              imageUri: 'https://example.com/image.jpg',
              title: 'Image Source',
              domain: 'example.com',
            },
          },
        ],
      },
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const sourceEvents = events.filter(event => event.type === 'source');

    expect(sourceEvents).toMatchInlineSnapshot(`
      [
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "Image Source",
          "type": "source",
          "url": "https://example.com/article",
        },
      ]
    `);
  });

  it('should stream sources during intermediate chunks', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'text' }], role: 'model' },
              index: 0,
              safetyRatings: SAFETY_RATINGS,
              groundingMetadata: {
                groundingChunks: [
                  { web: { uri: 'https://a.com', title: 'A' } },
                  { web: { uri: 'https://b.com', title: 'B' } },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'more' }], role: 'model' },
              finishReason: 'STOP',
              index: 0,
              safetyRatings: SAFETY_RATINGS,
            },
          ],
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const sourceEvents = events.filter(event => event.type === 'source');

    expect(sourceEvents).toMatchInlineSnapshot(`
      [
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "A",
          "type": "source",
          "url": "https://a.com",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "B",
          "type": "source",
          "url": "https://b.com",
        },
      ]
    `);
  });

  it('should deduplicate sources across chunks', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'first chunk' }], role: 'model' },
              index: 0,
              safetyRatings: SAFETY_RATINGS,
              groundingMetadata: {
                groundingChunks: [
                  { web: { uri: 'https://example.com', title: 'Example' } },
                  { web: { uri: 'https://unique.com', title: 'Unique' } },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'second chunk' }], role: 'model' },
              index: 0,
              safetyRatings: SAFETY_RATINGS,
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      uri: 'https://example.com',
                      title: 'Example Duplicate',
                    },
                  },
                  { web: { uri: 'https://another.com', title: 'Another' } },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'final chunk' }], role: 'model' },
              finishReason: 'STOP',
              index: 0,
              safetyRatings: SAFETY_RATINGS,
            },
          ],
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const sourceEvents = events.filter(event => event.type === 'source');

    expect(sourceEvents).toMatchInlineSnapshot(`
      [
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "Example",
          "type": "source",
          "url": "https://example.com",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "Unique",
          "type": "source",
          "url": "https://unique.com",
        },
        {
          "id": "test-id",
          "sourceType": "url",
          "title": "Another",
          "type": "source",
          "url": "https://another.com",
        },
      ]
    `);
  });

  it('should stream files', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"candidates": [{"content": {"parts": [{"inlineData": {"data": "test","mimeType": "text/plain"}}]` +
          `,"role": "model"},` +
          `"finishReason": "STOP","index": 0,"safetyRatings": [` +
          `{"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT","probability": "NEGLIGIBLE"},` +
          `{"category": "HARM_CATEGORY_HATE_SPEECH","probability": "NEGLIGIBLE"},` +
          `{"category": "HARM_CATEGORY_HARASSMENT","probability": "NEGLIGIBLE"},` +
          `{"category": "HARM_CATEGORY_DANGEROUS_CONTENT","probability": "NEGLIGIBLE"}]}]}\n\n`,
        `data: {"usageMetadata": {"promptTokenCount": 294,"candidatesTokenCount": 233,"totalTokenCount": 527}}\n\n`,
      ],
    };
    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);

    expect(events).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "data": {
            "data": "test",
            "type": "data",
          },
          "mediaType": "text/plain",
          "providerMetadata": undefined,
          "type": "file",
        },
        {
          "finishReason": {
            "raw": "STOP",
            "unified": "stop",
          },
          "providerMetadata": {
            "google": {
              "finishMessage": null,
              "groundingMetadata": null,
              "promptFeedback": null,
              "safetyRatings": [
                {
                  "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  "probability": "NEGLIGIBLE",
                },
                {
                  "category": "HARM_CATEGORY_HATE_SPEECH",
                  "probability": "NEGLIGIBLE",
                },
                {
                  "category": "HARM_CATEGORY_HARASSMENT",
                  "probability": "NEGLIGIBLE",
                },
                {
                  "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                  "probability": "NEGLIGIBLE",
                },
              ],
              "serviceTier": null,
              "urlContextMetadata": null,
              "usageMetadata": null,
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 294,
              "total": 294,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 233,
              "total": 233,
            },
            "raw": {
              "candidatesTokenCount": 233,
              "promptTokenCount": 294,
              "totalTokenCount": 527,
            },
          },
        },
      ]
    `);
  });

  it('should stream file parts with thought flag in providerMetadata', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: { data: 'thoughtimg', mimeType: 'image/png' },
                    thought: true,
                    thoughtSignature: 'stream_sig',
                  },
                  {
                    inlineData: {
                      data: 'regularimg',
                      mimeType: 'image/jpeg',
                    },
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);

    const fileEvents = events.filter(
      e => e.type === 'file' || e.type === 'reasoning-file',
    );
    expect(fileEvents).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "data": "thoughtimg",
            "type": "data",
          },
          "mediaType": "image/png",
          "providerMetadata": {
            "google": {
              "thoughtSignature": "stream_sig",
            },
          },
          "type": "reasoning-file",
        },
        {
          "data": {
            "data": "regularimg",
            "type": "data",
          },
          "mediaType": "image/jpeg",
          "providerMetadata": undefined,
          "type": "file",
        },
      ]
    `);
  });

  it('should stream text and files in correct order', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Step 1: ' },
                  { inlineData: { data: 'image1', mimeType: 'image/png' } },
                  { text: ' Step 2: ' },
                  { inlineData: { data: 'image2', mimeType: 'image/jpeg' } },
                  { text: ' Done' },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);

    // Filter to content events only (excluding metadata)
    const contentEvents = events.filter(
      event =>
        event.type === 'text-start' ||
        event.type === 'text-delta' ||
        event.type === 'text-end' ||
        event.type === 'file',
    );

    // Verify that text and file parts are interleaved in the correct order
    expect(contentEvents).toMatchInlineSnapshot(`
      [
        {
          "id": "0",
          "providerMetadata": undefined,
          "type": "text-start",
        },
        {
          "delta": "Step 1: ",
          "id": "0",
          "providerMetadata": undefined,
          "type": "text-delta",
        },
        {
          "id": "0",
          "type": "text-end",
        },
        {
          "data": {
            "data": "image1",
            "type": "data",
          },
          "mediaType": "image/png",
          "providerMetadata": undefined,
          "type": "file",
        },
        {
          "id": "1",
          "providerMetadata": undefined,
          "type": "text-start",
        },
        {
          "delta": " Step 2: ",
          "id": "1",
          "providerMetadata": undefined,
          "type": "text-delta",
        },
        {
          "id": "1",
          "type": "text-end",
        },
        {
          "data": {
            "data": "image2",
            "type": "data",
          },
          "mediaType": "image/jpeg",
          "providerMetadata": undefined,
          "type": "file",
        },
        {
          "id": "2",
          "providerMetadata": undefined,
          "type": "text-start",
        },
        {
          "delta": " Done",
          "id": "2",
          "providerMetadata": undefined,
          "type": "text-delta",
        },
        {
          "id": "2",
          "type": "text-end",
        },
      ]
    `);
  });

  it('should set finishReason to tool-calls when chunk contains functionCall', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'Initial text response' }],
                role: 'model',
              },
              index: 0,
              safetyRatings: SAFETY_RATINGS,
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'test-tool',
                      args: { value: 'example value' },
                    },
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        })}\n\n`,
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
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const events = await convertReadableStreamToArray(stream);
    const finishEvent = events.find(event => event.type === 'finish');

    expect(finishEvent?.finishReason).toMatchInlineSnapshot(`
      {
        "raw": "STOP",
        "unified": "tool-calls",
      }
    `);
  });

  it('should omit server-side tool invocation flag for Vertex Gemini 3', async () => {
    server.urls[TEST_URL_GEMINI_3_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'Hello' }], role: 'model' },
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        })}\n\n`,
      ],
    };

    const vertexModel = new GoogleLanguageModel('gemini-3-pro-preview', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    const { stream } = await vertexModel.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
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
        {
          type: 'provider',
          id: 'google.google_search',
          name: 'google_search',
          args: {},
        },
      ],
    });

    const requestBody = await server.calls[0].requestBodyJson;
    expect({
      toolConfig: requestBody.toolConfig,
      tools: requestBody.tools,
    }).toMatchInlineSnapshot(`
      {
        "toolConfig": {
          "functionCallingConfig": {
            "mode": "VALIDATED",
          },
        },
        "tools": [
          {
            "googleSearch": {},
          },
          {
            "functionDeclarations": [
              {
                "description": "",
                "name": "test-tool",
                "parameters": {
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
              },
            ],
          },
        ],
      }
    `);

    const events = await convertReadableStreamToArray(stream);
    expect(events[0]).toMatchInlineSnapshot(`
      {
        "type": "stream-start",
        "warnings": [],
      }
    `);
  });

  it('should send streamFunctionCallArguments in toolConfig when provider option is set with Vertex provider', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'Hello' }], role: 'model' },
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        })}\n\n`,
      ],
    };

    const vertexModel = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await vertexModel.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
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
      providerOptions: {
        vertex: {
          streamFunctionCallArguments: true,
        },
      },
    });

    expect((await server.calls[0].requestBodyJson).toolConfig)
      .toMatchInlineSnapshot(`
      {
        "functionCallingConfig": {
          "streamFunctionCallArguments": true,
        },
      }
    `);
  });

  it('should emit warning and not send streamFunctionCallArguments when using non-Vertex provider', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'Hello' }], role: 'model' },
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
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
      providerOptions: {
        google: {
          streamFunctionCallArguments: true,
        },
      },
    });

    const events = await convertReadableStreamToArray(stream);

    expect(events).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [
            {
              "message": "'streamFunctionCallArguments' is only supported on the Vertex AI API and will be ignored with the current Google provider (google.generative-ai). See https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling#streaming-fc",
              "type": "other",
            },
          ],
        },
        {
          "id": "0",
          "providerMetadata": undefined,
          "type": "text-start",
        },
        {
          "delta": "Hello",
          "id": "0",
          "providerMetadata": undefined,
          "type": "text-delta",
        },
        {
          "id": "0",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "STOP",
            "unified": "stop",
          },
          "providerMetadata": {
            "google": {
              "finishMessage": null,
              "groundingMetadata": null,
              "promptFeedback": null,
              "safetyRatings": [
                {
                  "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  "probability": "NEGLIGIBLE",
                },
                {
                  "category": "HARM_CATEGORY_HATE_SPEECH",
                  "probability": "NEGLIGIBLE",
                },
                {
                  "category": "HARM_CATEGORY_HARASSMENT",
                  "probability": "NEGLIGIBLE",
                },
                {
                  "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                  "probability": "NEGLIGIBLE",
                },
              ],
              "serviceTier": null,
              "urlContextMetadata": null,
              "usageMetadata": {
                "candidatesTokenCount": 1,
                "promptTokenCount": 1,
                "totalTokenCount": 2,
              },
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 1,
              "total": 1,
            },
            "outputTokens": {
              "reasoning": 0,
              "text": 1,
              "total": 1,
            },
            "raw": {
              "candidatesTokenCount": 1,
              "promptTokenCount": 1,
              "totalTokenCount": 2,
            },
          },
        },
      ]
    `);

    expect(
      (await server.calls[0].requestBodyJson).toolConfig?.functionCallingConfig
        ?.streamFunctionCallArguments,
    ).toMatchInlineSnapshot(`undefined`);
  });

  it('should default streamFunctionCallArguments to false for Vertex provider without provider option', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'Hello' }], role: 'model' },
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        })}\n\n`,
      ],
    };

    const vertexModel = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await vertexModel.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
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
    });

    expect(
      (await server.calls[0].requestBodyJson).toolConfig?.functionCallingConfig
        ?.streamFunctionCallArguments,
    ).toMatchInlineSnapshot(`undefined`);
  });

  it('should allow Vertex provider to opt out of streamFunctionCallArguments by setting it to false', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'Hello' }], role: 'model' },
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
            },
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        })}\n\n`,
      ],
    };

    const vertexModel = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await vertexModel.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
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
      providerOptions: {
        vertex: {
          streamFunctionCallArguments: false,
        },
      },
    });

    expect(
      (await server.calls[0].requestBodyJson).toolConfig?.functionCallingConfig
        ?.streamFunctionCallArguments,
    ).toBeUndefined();
  });

  it('should not send streamFunctionCallArguments for Vertex provider doGenerate (unary API)', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'Hello' }], role: 'model' },
            finishReason: 'STOP',
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      },
    };

    const vertexModel = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await vertexModel.doGenerate({
      prompt: TEST_PROMPT,
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
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {},
        "tools": [
          {
            "functionDeclarations": [
              {
                "description": "",
                "name": "test-tool",
                "parameters": {
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
              },
            ],
          },
        ],
      }
    `);
  });

  it('should not send streamFunctionCallArguments for Vertex provider doGenerate even when explicitly set', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'Hello' }], role: 'model' },
            finishReason: 'STOP',
            safetyRatings: SAFETY_RATINGS,
          },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      },
    };

    const vertexModel = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.vertex.chat',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await vertexModel.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        vertex: {
          streamFunctionCallArguments: true,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
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
        "generationConfig": {},
      }
    `);
  });

  it('should only pass valid provider options', async () => {
    prepareChunksFixtureResponse('google-text');

    await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: {
        google: { foo: 'bar', responseModalities: ['TEXT', 'IMAGE'] },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Hello' }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });
  });

  it('should stream reasoning parts separately from text parts', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'I need to think about this carefully. The user wants a simple explanation.',
                    thought: true,
                  },
                ],
                role: 'model',
              },
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 14,
            totalTokenCount: 84,
            thoughtsTokenCount: 70,
          },
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Let me organize my thoughts and provide a clear answer.',
                    thought: true,
                  },
                ],
                role: 'model',
              },
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 14,
            totalTokenCount: 156,
            thoughtsTokenCount: 142,
          },
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Here is a simple explanation: ',
                  },
                ],
                role: 'model',
              },
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 14,
            candidatesTokenCount: 8,
            totalTokenCount: 164,
            thoughtsTokenCount: 142,
          },
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'The concept works because of basic principles.',
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 14,
            candidatesTokenCount: 18,
            totalTokenCount: 174,
            thoughtsTokenCount: 142,
          },
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const allEvents = await convertReadableStreamToArray(stream);

    expect(allEvents).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "0",
          "providerMetadata": undefined,
          "type": "reasoning-start",
        },
        {
          "delta": "I need to think about this carefully. The user wants a simple explanation.",
          "id": "0",
          "providerMetadata": undefined,
          "type": "reasoning-delta",
        },
        {
          "delta": "Let me organize my thoughts and provide a clear answer.",
          "id": "0",
          "providerMetadata": undefined,
          "type": "reasoning-delta",
        },
        {
          "id": "0",
          "type": "reasoning-end",
        },
        {
          "id": "1",
          "providerMetadata": undefined,
          "type": "text-start",
        },
        {
          "delta": "Here is a simple explanation: ",
          "id": "1",
          "providerMetadata": undefined,
          "type": "text-delta",
        },
        {
          "delta": "The concept works because of basic principles.",
          "id": "1",
          "providerMetadata": undefined,
          "type": "text-delta",
        },
        {
          "id": "1",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "STOP",
            "unified": "stop",
          },
          "providerMetadata": {
            "google": {
              "finishMessage": null,
              "groundingMetadata": null,
              "promptFeedback": null,
              "safetyRatings": null,
              "serviceTier": null,
              "urlContextMetadata": null,
              "usageMetadata": {
                "candidatesTokenCount": 18,
                "promptTokenCount": 14,
                "thoughtsTokenCount": 142,
                "totalTokenCount": 174,
              },
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 14,
              "total": 14,
            },
            "outputTokens": {
              "reasoning": 142,
              "text": 18,
              "total": 160,
            },
            "raw": {
              "candidatesTokenCount": 18,
              "promptTokenCount": 14,
              "thoughtsTokenCount": 142,
              "totalTokenCount": 174,
            },
          },
        },
      ]
    `);
  });

  it('should stream thought signatures with reasoning and text parts', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'I need to think about this.',
                    thought: true,
                    thoughtSignature: 'reasoning_sig1',
                  },
                ],
                role: 'model',
              },
              index: 0,
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Here is the answer.',
                    thoughtSignature: 'text_sig1',
                  },
                ],
                role: 'model',
              },
              index: 0,
              finishReason: 'STOP',
              safetyRatings: SAFETY_RATINGS,
            },
          ],
        })}\n\n`,
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const chunks = await convertReadableStreamToArray(stream);

    expect(chunks).toMatchInlineSnapshot(`
      [
        {
          "type": "stream-start",
          "warnings": [],
        },
        {
          "id": "0",
          "providerMetadata": {
            "google": {
              "thoughtSignature": "reasoning_sig1",
            },
          },
          "type": "reasoning-start",
        },
        {
          "delta": "I need to think about this.",
          "id": "0",
          "providerMetadata": {
            "google": {
              "thoughtSignature": "reasoning_sig1",
            },
          },
          "type": "reasoning-delta",
        },
        {
          "id": "0",
          "type": "reasoning-end",
        },
        {
          "id": "1",
          "providerMetadata": {
            "google": {
              "thoughtSignature": "text_sig1",
            },
          },
          "type": "text-start",
        },
        {
          "delta": "Here is the answer.",
          "id": "1",
          "providerMetadata": {
            "google": {
              "thoughtSignature": "text_sig1",
            },
          },
          "type": "text-delta",
        },
        {
          "id": "1",
          "type": "text-end",
        },
        {
          "finishReason": {
            "raw": "STOP",
            "unified": "stop",
          },
          "providerMetadata": {
            "google": {
              "finishMessage": null,
              "groundingMetadata": null,
              "promptFeedback": null,
              "safetyRatings": [
                {
                  "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  "probability": "NEGLIGIBLE",
                },
                {
                  "category": "HARM_CATEGORY_HATE_SPEECH",
                  "probability": "NEGLIGIBLE",
                },
                {
                  "category": "HARM_CATEGORY_HARASSMENT",
                  "probability": "NEGLIGIBLE",
                },
                {
                  "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                  "probability": "NEGLIGIBLE",
                },
              ],
              "serviceTier": null,
              "urlContextMetadata": null,
              "usageMetadata": null,
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

  describe('providerMetadata key based on provider string', () => {
    it('should use "vertex" as providerMetadata key in finish event when provider includes "vertex"', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'stream-chunks',
        chunks: [
          `data: ${JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Hello' }], role: 'model' },
              },
            ],
          })}\n\n`,
          `data: ${JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: ' World!' }], role: 'model' },
                finishReason: 'STOP',
                safetyRatings: SAFETY_RATINGS,
                groundingMetadata: {
                  webSearchQueries: ['test query'],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 1,
              candidatesTokenCount: 2,
              totalTokenCount: 3,
            },
          })}\n\n`,
        ],
      };

      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.vertex.chat',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
      });

      const events = await convertReadableStreamToArray(stream);
      const finishEvent = events.find(event => event.type === 'finish');

      expect(finishEvent?.type === 'finish').toBe(true);
      if (finishEvent?.type === 'finish') {
        expect(finishEvent.providerMetadata).toHaveProperty('vertex');
        expect(finishEvent.providerMetadata?.vertex).toMatchObject({
          promptFeedback: null,
          groundingMetadata: expect.any(Object),
          safetyRatings: expect.any(Array),
        });
      }
    });

    it('should use "google" as providerMetadata key in finish event when provider does not include "vertex"', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'stream-chunks',
        chunks: [
          `data: ${JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Hello' }], role: 'model' },
              },
            ],
          })}\n\n`,
          `data: ${JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: ' World!' }], role: 'model' },
                finishReason: 'STOP',
                safetyRatings: SAFETY_RATINGS,
                groundingMetadata: {
                  webSearchQueries: ['test query'],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 1,
              candidatesTokenCount: 2,
              totalTokenCount: 3,
            },
          })}\n\n`,
        ],
      };

      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.generative-ai',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
      });

      const events = await convertReadableStreamToArray(stream);
      const finishEvent = events.find(event => event.type === 'finish');

      expect(finishEvent?.type === 'finish').toBe(true);
      if (finishEvent?.type === 'finish') {
        expect(finishEvent.providerMetadata).toHaveProperty('google');
        expect(finishEvent.providerMetadata).not.toHaveProperty('vertex');
        expect(finishEvent.providerMetadata?.google).toMatchObject({
          promptFeedback: null,
          groundingMetadata: expect.any(Object),
          safetyRatings: expect.any(Array),
        });
      }
    });

    it('should use "vertex" as providerMetadata key in streaming reasoning events when provider includes "vertex"', async () => {
      server.urls[TEST_URL_GEMINI_PRO].response = {
        type: 'stream-chunks',
        chunks: [
          `data: ${JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'thinking...',
                      thought: true,
                      thoughtSignature: 'stream_sig',
                    },
                  ],
                  role: 'model',
                },
              },
            ],
          })}\n\n`,
          `data: ${JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Final answer' }], role: 'model' },
                finishReason: 'STOP',
                safetyRatings: SAFETY_RATINGS,
              },
            ],
            usageMetadata: {
              promptTokenCount: 1,
              candidatesTokenCount: 2,
              totalTokenCount: 3,
            },
          })}\n\n`,
        ],
      };

      const model = new GoogleLanguageModel('gemini-pro', {
        provider: 'google.vertex.chat',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: { 'x-goog-api-key': 'test-api-key' },
        generateId: () => 'test-id',
      });

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
      });

      const events = await convertReadableStreamToArray(stream);

      const reasoningStartEvent = events.find(
        event => event.type === 'reasoning-start',
      );
      expect(reasoningStartEvent?.type === 'reasoning-start').toBe(true);
      if (reasoningStartEvent?.type === 'reasoning-start') {
        expect(reasoningStartEvent.providerMetadata).toHaveProperty('vertex');
        expect(reasoningStartEvent.providerMetadata).not.toHaveProperty(
          'google',
        );
        expect(reasoningStartEvent.providerMetadata?.vertex).toMatchObject({
          thoughtSignature: 'stream_sig',
        });
      }

      const reasoningDeltaEvent = events.find(
        event => event.type === 'reasoning-delta',
      );
      expect(reasoningDeltaEvent?.type === 'reasoning-delta').toBe(true);
      if (reasoningDeltaEvent?.type === 'reasoning-delta') {
        expect(reasoningDeltaEvent.providerMetadata).toHaveProperty('vertex');
        expect(reasoningDeltaEvent.providerMetadata).not.toHaveProperty(
          'google',
        );
      }
    });
  });
});

describe('GEMMA Model System Instruction Fix', () => {
  const TEST_PROMPT_WITH_SYSTEM: LanguageModelV4Prompt = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
  ];

  const TEST_URL_GEMMA_3_12B_IT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-12b-it:generateContent';

  const TEST_URL_GEMMA_3_27B_IT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent';

  const TEST_URL_GEMINI_PRO =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  const server = createTestServer({
    [TEST_URL_GEMMA_3_12B_IT]: {},
    [TEST_URL_GEMMA_3_27B_IT]: {},
    [TEST_URL_GEMINI_PRO]: {},
  });

  it('should NOT send systemInstruction for GEMMA-3-12b-it model', async () => {
    server.urls[TEST_URL_GEMMA_3_12B_IT].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }], role: 'model' },
            finishReason: 'STOP',
            index: 0,
          },
        ],
      },
    };

    const model = new GoogleLanguageModel('gemma-3-12b-it', {
      provider: 'google.generative-ai',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await model.doGenerate({
      prompt: TEST_PROMPT_WITH_SYSTEM,
    });

    // Verify that systemInstruction was NOT sent for GEMMA model
    const lastCall = server.calls[server.calls.length - 1];
    const requestBody = await lastCall.requestBodyJson;

    expect(requestBody).not.toHaveProperty('systemInstruction');
  });

  it('should NOT send systemInstruction for GEMMA-3-27b-it model', async () => {
    server.urls[TEST_URL_GEMMA_3_27B_IT].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }], role: 'model' },
            finishReason: 'STOP',
            index: 0,
          },
        ],
      },
    };

    const model = new GoogleLanguageModel('gemma-3-27b-it', {
      provider: 'google.generative-ai',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await model.doGenerate({
      prompt: TEST_PROMPT_WITH_SYSTEM,
    });

    const lastCall = server.calls[server.calls.length - 1];
    const requestBody = await lastCall.requestBodyJson;

    expect(requestBody).not.toHaveProperty('systemInstruction');
  });

  it('should still send systemInstruction for Gemini models (regression test)', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }], role: 'model' },
            finishReason: 'STOP',
            index: 0,
          },
        ],
      },
    };

    const model = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.generative-ai',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await model.doGenerate({
      prompt: TEST_PROMPT_WITH_SYSTEM,
    });

    const lastCall = server.calls[server.calls.length - 1];
    const requestBody = await lastCall.requestBodyJson;

    expect(requestBody).toHaveProperty('systemInstruction');
    expect(requestBody.systemInstruction).toEqual({
      parts: [{ text: 'You are a helpful assistant.' }],
    });
  });

  it('should NOT generate warning when GEMMA model is used without system instructions', async () => {
    server.urls[TEST_URL_GEMMA_3_12B_IT].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }], role: 'model' },
            finishReason: 'STOP',
            index: 0,
          },
        ],
      },
    };

    const model = new GoogleLanguageModel('gemma-3-12b-it', {
      provider: 'google.generative-ai',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    const TEST_PROMPT_WITHOUT_SYSTEM: LanguageModelV4Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
    ];

    const { warnings } = await model.doGenerate({
      prompt: TEST_PROMPT_WITHOUT_SYSTEM,
    });

    expect(warnings).toHaveLength(0);
  });

  it('should NOT generate warning when Gemini model is used with system instructions', async () => {
    server.urls[TEST_URL_GEMINI_PRO].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }], role: 'model' },
            finishReason: 'STOP',
            index: 0,
          },
        ],
      },
    };

    const model = new GoogleLanguageModel('gemini-pro', {
      provider: 'google.generative-ai',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    const { warnings } = await model.doGenerate({
      prompt: TEST_PROMPT_WITH_SYSTEM,
    });

    expect(warnings).toHaveLength(0);
  });

  it('should prepend system instruction to first user message for GEMMA models', async () => {
    server.urls[TEST_URL_GEMMA_3_12B_IT].response = {
      type: 'json-value',
      body: {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }], role: 'model' },
            finishReason: 'STOP',
            index: 0,
          },
        ],
      },
    };

    const model = new GoogleLanguageModel('gemma-3-12b-it', {
      provider: 'google.generative-ai',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: { 'x-goog-api-key': 'test-api-key' },
      generateId: () => 'test-id',
    });

    await model.doGenerate({
      prompt: TEST_PROMPT_WITH_SYSTEM,
    });

    const lastCall = server.calls[server.calls.length - 1];
    const requestBody = await lastCall.requestBodyJson;

    expect(requestBody).toMatchInlineSnapshot(`
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
        "generationConfig": {},
      }
    `);
  });
});
