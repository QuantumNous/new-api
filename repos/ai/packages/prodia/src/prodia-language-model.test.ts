import type { FetchFunction } from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { ProdiaLanguageModel } from './prodia-language-model';

const prompt = 'Describe this image';

function createBasicModel({
  headers,
  fetch,
  currentDate,
}: {
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
} = {}) {
  return new ProdiaLanguageModel('inference.nano-banana.img2img.v2', {
    provider: 'prodia.language',
    baseURL: 'https://api.example.com/v2',
    headers: headers ?? (() => ({ Authorization: 'Bearer test-key' })),
    fetch,
    _internal: {
      currentDate,
    },
  });
}

function createLanguageMultipartResponse(
  jobResult: Record<string, unknown>,
  {
    textContent,
    imageContent,
  }: {
    textContent?: string;
    imageContent?: string;
  } = {},
): { body: Buffer; contentType: string } {
  const boundary = 'test-boundary-12345';
  const jobJson = JSON.stringify(jobResult);

  const partStrings = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="job"; filename="job.json"\r\n',
    'Content-Type: application/json\r\n',
    '\r\n',
    jobJson,
    '\r\n',
  ];

  if (textContent !== undefined) {
    partStrings.push(
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="output"; filename="message.txt"\r\n',
      'Content-Type: text/plain\r\n',
      '\r\n',
      textContent,
      '\r\n',
    );
  }

  const headerPart = Buffer.from(partStrings.join(''));
  const buffers: Buffer[] = [headerPart];

  if (imageContent !== undefined) {
    const imageHeader = Buffer.from(
      [
        `--${boundary}\r\n`,
        'Content-Disposition: form-data; name="output"; filename="image.png"\r\n',
        'Content-Type: image/png\r\n',
        '\r\n',
      ].join(''),
    );
    buffers.push(imageHeader, Buffer.from(imageContent));
    buffers.push(Buffer.from('\r\n'));
  }

  buffers.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(buffers);

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

const defaultJobResult = {
  id: 'job-lang-123',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:03Z',
  state: { current: 'completed' },
  config: { prompt, seed: 7 },
  metrics: { elapsed: 1.5, ips: 20.0 },
  price: { product: 'nano-banana', dollars: 0.01 },
};

describe('ProdiaLanguageModel', () => {
  const multipartResponse = createLanguageMultipartResponse(defaultJobResult, {
    textContent: 'This is a beautiful landscape.',
    imageContent: 'test-image-bytes',
  });

  const server = createTestServer({
    'https://api.example.com/v2/job?price=true': {
      response: {
        type: 'binary',
        body: multipartResponse.body,
        headers: {
          'content-type': multipartResponse.contentType,
        },
      },
    },
  });

  describe('constructor', () => {
    it('exposes correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('prodia.language');
      expect(model.modelId).toBe('inference.nano-banana.img2img.v2');
      expect(model.specificationVersion).toBe('v4');
      expect(model.supportedUrls).toStrictEqual({});
    });
  });

  describe('doGenerate', () => {
    it('extracts text from user message and sends correct request', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/png',
                data: {
                  type: 'data' as const,
                  data: new Uint8Array([1, 2, 3]),
                },
              },
              { type: 'text', text: 'Describe this image' },
            ],
          },
        ],
        providerOptions: {},
      });

      // Should be multipart form-data request
      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestHeaders['content-type']).toContain(
        'multipart/form-data',
      );
    });

    it('routes top-level-only "image" mediaType into multipart input with detected full MIME', async () => {
      const PNG_BYTES = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      let capturedFormData: FormData | undefined;
      const model = createBasicModel({
        fetch: async (url, init) => {
          if (init?.body instanceof FormData) {
            capturedFormData = init.body;
          }
          return globalThis.fetch(url, init);
        },
      });

      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image',
                data: { type: 'data' as const, data: PNG_BYTES },
              },
              { type: 'text', text: 'Describe this image' },
            ],
          },
        ],
        providerOptions: {},
      });

      expect(capturedFormData).toBeDefined();
      const inputBlob = capturedFormData!.get('input') as Blob;
      expect(inputBlob).toBeInstanceOf(Blob);
      expect(inputBlob.type).toBe('image/png');
    });

    it('top-level-only "image" mediaType with undetectable bytes keeps default content-type', async () => {
      let capturedFormData: FormData | undefined;
      const model = createBasicModel({
        fetch: async (url, init) => {
          if (init?.body instanceof FormData) {
            capturedFormData = init.body;
          }
          return globalThis.fetch(url, init);
        },
      });

      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image',
                data: {
                  type: 'data' as const,
                  data: new Uint8Array([0x00, 0x01, 0x02]),
                },
              },
              { type: 'text', text: 'Describe this image' },
            ],
          },
        ],
        providerOptions: {},
      });

      expect(capturedFormData).toBeDefined();
      const inputBlob = capturedFormData!.get('input') as Blob;
      expect(inputBlob).toBeInstanceOf(Blob);
      expect(inputBlob.type).toBe('image/png');
    });

    it('includes system message in prompt', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt: [
          { role: 'system', content: 'You are an art critic.' },
          {
            role: 'user',
            content: [{ type: 'text', text: 'Describe this.' }],
          },
        ],
        providerOptions: {},
      });

      // Request was sent (system message is prepended to prompt)
      expect(server.calls[0].requestMethod).toBe('POST');
    });

    it('sends include_messages: true in config', async () => {
      // We need to inspect the form data job part - use a custom fetch to capture
      let capturedFormData: FormData | undefined;
      const model = createBasicModel({
        fetch: async (url, init) => {
          if (init?.body instanceof FormData) {
            capturedFormData = init.body;
          }
          return globalThis.fetch(url, init);
        },
      });

      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
        providerOptions: {},
      });

      expect(capturedFormData).toBeDefined();
      const jobBlob = capturedFormData!.get('job') as Blob;
      const jobText = await jobBlob.text();
      const jobJson = JSON.parse(jobText);
      expect(jobJson.config.include_messages).toBe(true);
    });

    it('returns text content from message.txt response part', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        providerOptions: {},
      });

      const textParts = result.content.filter(p => p.type === 'text');
      expect(textParts).toHaveLength(1);
      expect(textParts[0].type).toBe('text');
      if (textParts[0].type === 'text') {
        expect(textParts[0].text).toBe('This is a beautiful landscape.');
      }
    });

    it('returns image content from image.png response part', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        providerOptions: {},
      });

      const fileParts = result.content.filter(p => p.type === 'file');
      expect(fileParts).toHaveLength(1);
      expect(fileParts[0].type).toBe('file');
      if (fileParts[0].type === 'file') {
        expect(fileParts[0].mediaType).toBe('image/png');
        expect(fileParts[0].data.type).toBe('data');
        if (fileParts[0].data.type === 'data') {
          expect(
            Buffer.from(
              fileParts[0].data.data as Uint8Array<ArrayBufferLike>,
            ).toString(),
          ).toBe('test-image-bytes');
        }
      }
    });

    it('returns finish reason as stop', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        providerOptions: {},
      });

      expect(result.finishReason).toStrictEqual({
        unified: 'stop',
        raw: undefined,
      });
    });

    it('returns provider metadata', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        providerOptions: {},
      });

      expect(result.providerMetadata?.prodia).toStrictEqual({
        jobId: 'job-lang-123',
        seed: 7,
        elapsed: 1.5,
        iterationsPerSecond: 20.0,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:03Z',
        dollars: 0.01,
      });
    });

    it('emits warnings for unsupported LLM features', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        temperature: 0.5,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1000,
        stopSequences: ['stop'],
        presencePenalty: 0.1,
        frequencyPenalty: 0.2,
        tools: [
          {
            type: 'function',
            name: 'test',
            inputSchema: {},
          },
        ],
        toolChoice: { type: 'auto' },
        responseFormat: { type: 'json' },
        reasoning: 'medium',
        providerOptions: {},
      });

      const warningFeatures = result.warnings.map(w =>
        w.type === 'unsupported' ? w.feature : undefined,
      );
      expect(warningFeatures).toContain('temperature');
      expect(warningFeatures).toContain('topP');
      expect(warningFeatures).toContain('topK');
      expect(warningFeatures).toContain('maxOutputTokens');
      expect(warningFeatures).toContain('stopSequences');
      expect(warningFeatures).toContain('presencePenalty');
      expect(warningFeatures).toContain('frequencyPenalty');
      expect(warningFeatures).toContain('tools');
      expect(warningFeatures).toContain('toolChoice');
      expect(warningFeatures).toContain('responseFormat');
      expect(warningFeatures).toContain('reasoning');
    });

    it('passes aspectRatio from provider options', async () => {
      let capturedFormData: FormData | undefined;
      const model = createBasicModel({
        fetch: async (url, init) => {
          if (init?.body instanceof FormData) {
            capturedFormData = init.body;
          }
          return globalThis.fetch(url, init);
        },
      });

      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        providerOptions: {
          prodia: {
            aspectRatio: '16:9',
          },
        },
      });

      const jobBlob = capturedFormData!.get('job') as Blob;
      const jobText = await jobBlob.text();
      const jobJson = JSON.parse(jobText);
      expect(jobJson.config.aspect_ratio).toBe('16:9');
    });

    it('merges provider and request headers', async () => {
      const model = createBasicModel({
        headers: () => ({
          'Custom-Provider-Header': 'provider-value',
          Authorization: 'Bearer test-key',
        }),
      });

      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        providerOptions: {},
        headers: {
          'Custom-Request-Header': 'request-value',
        },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        'custom-provider-header': 'provider-value',
        'custom-request-header': 'request-value',
        authorization: 'Bearer test-key',
      });
    });

    it('includes timestamp and modelId in response', async () => {
      const testDate = new Date('2025-06-01T00:00:00Z');
      const model = createBasicModel({ currentDate: () => testDate });

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        providerOptions: {},
      });

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'inference.nano-banana.img2img.v2',
        headers: expect.any(Object),
      });
    });

    it('handles API errors', async () => {
      server.urls['https://api.example.com/v2/job?price=true'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          message: 'Bad request',
          detail: 'Missing input image',
        }),
      };

      const model = createBasicModel();

      await expect(
        model.doGenerate({
          prompt: [
            {
              role: 'user',
              content: [{ type: 'text', text: prompt }],
            },
          ],
          providerOptions: {},
        }),
      ).rejects.toMatchObject({
        message: 'Missing input image',
        statusCode: 400,
      });
    });

    it('handles response with text only (no image)', async () => {
      const textOnlyResponse = createLanguageMultipartResponse(
        defaultJobResult,
        {
          textContent: 'Just a text response',
        },
      );

      server.urls['https://api.example.com/v2/job?price=true'].response = {
        type: 'binary',
        body: textOnlyResponse.body,
        headers: {
          'content-type': textOnlyResponse.contentType,
        },
      };

      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        providerOptions: {},
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('doStream', () => {
    it('wraps doGenerate result into stream parts', async () => {
      const response = createLanguageMultipartResponse(defaultJobResult, {
        textContent: 'Stream test response',
        imageContent: 'stream-image-bytes',
      });

      server.urls['https://api.example.com/v2/job?price=true'].response = {
        type: 'binary',
        body: response.body,
        headers: {
          'content-type': response.contentType,
        },
      };

      const model = createBasicModel();

      const result = await model.doStream({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
        providerOptions: {},
      });

      const parts: Array<Record<string, unknown>> = [];
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as unknown as Record<string, unknown>);
      }

      // Verify stream structure
      expect(parts[0].type).toBe('stream-start');
      expect(parts[1].type).toBe('response-metadata');
      expect(parts[2].type).toBe('text-start');
      expect(parts[3].type).toBe('text-delta');
      expect((parts[3] as any).delta).toBe('Stream test response');
      expect(parts[4].type).toBe('text-end');
      expect(parts[5].type).toBe('file');
      expect((parts[5] as any).mediaType).toBe('image/png');
      expect(parts[6].type).toBe('finish');
      expect((parts[6] as any).finishReason).toStrictEqual({
        unified: 'stop',
        raw: undefined,
      });
    });
  });
});
