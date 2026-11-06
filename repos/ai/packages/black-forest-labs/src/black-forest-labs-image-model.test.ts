import type { FetchFunction } from '@ai-sdk/provider-utils';
import * as providerUtils from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlackForestLabsImageModel } from './black-forest-labs-image-model';
import type { BlackForestLabsImageModelId } from './black-forest-labs-image-settings';

vi.mock('@ai-sdk/provider-utils', async importOriginal => {
  const actual = await importOriginal<typeof providerUtils>();
  return {
    ...actual,
    parseProviderOptions: vi.fn(actual.parseProviderOptions),
  };
});

const prompt = 'A cute baby sea otter';

function createBasicModel({
  modelId = 'test-model',
  headers,
  fetch,
  currentDate,
  pollIntervalMillis,
  pollTimeoutMillis,
}: {
  modelId?: BlackForestLabsImageModelId;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  currentDate?: () => Date;
  pollIntervalMillis?: number;
  pollTimeoutMillis?: number;
} = {}) {
  return new BlackForestLabsImageModel(modelId, {
    provider: 'black-forest-labs.image',
    baseURL: 'https://api.example.com/v1',
    headers: headers ?? (() => ({ 'x-key': 'test-key' })),
    fetch,
    pollIntervalMillis,
    pollTimeoutMillis,
    _internal: {
      currentDate,
    },
  });
}

describe('BlackForestLabsImageModel', () => {
  const server = createTestServer({
    'https://api.example.com/v1/test-model': {
      response: {
        type: 'json-value',
        body: {
          id: 'req-123',
          polling_url: 'https://api.example.com/poll',
        },
      },
    },
    'https://api.example.com/v1/flux-pro-1.0-fill': {
      response: {
        type: 'json-value',
        body: {
          id: 'req-123',
          polling_url: 'https://api.example.com/poll',
        },
      },
    },
    'https://api.example.com/poll': {
      response: {
        type: 'json-value',
        body: {
          status: 'Ready',
          result: {
            sample: 'https://api.example.com/image.png',
          },
        },
      },
    },
    'https://api.example.com/image.png': {
      response: {
        type: 'binary',
        body: Buffer.from('test-binary-content'),
      },
    },
    'https://cdn.evil.example/image.png': {
      response: {
        type: 'binary',
        body: Buffer.from('test-binary-content'),
      },
    },
    'https://api.bfl.ai/v1/test-model': {
      response: {
        type: 'json-value',
        body: {
          id: 'req-123',
          polling_url: 'https://api.us1.bfl.ai/v1/get_result',
        },
      },
    },
    'https://api.us1.bfl.ai/v1/get_result': {
      response: {
        type: 'json-value',
        body: {
          status: 'Ready',
          result: {
            sample: 'https://delivery-us1.bfl.ai/image.png',
          },
        },
      },
    },
    'https://delivery-us1.bfl.ai/image.png': {
      response: {
        type: 'binary',
        body: Buffer.from('test-binary-content'),
      },
    },
  });

  beforeEach(() => {
    vi.mocked(providerUtils.parseProviderOptions).mockClear();
  });

  describe('doGenerate', () => {
    it('parses provider options only once', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '1:1',
        seed: undefined,
        providerOptions: {},
      });

      expect(providerUtils.parseProviderOptions).toHaveBeenCalledTimes(1);
    });

    it('passes the correct parameters including aspect ratio and providerOptions', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        providerOptions: {
          blackForestLabs: {
            promptUpsampling: true,
            unsupportedProperty: 'value',
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        aspect_ratio: '16:9',
        prompt_upsampling: true,
      });
    });

    it('uses image field for flux-pro-1.0-fill input images', async () => {
      const model = createBasicModel({ modelId: 'flux-pro-1.0-fill' });

      await model.doGenerate({
        prompt,
        files: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: Buffer.from('test-image'),
          },
        ],
        mask: {
          type: 'file',
          mediaType: 'image/png',
          data: Buffer.from('test-mask'),
        },
        n: 1,
        size: undefined,
        aspectRatio: '1:1',
        seed: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        aspect_ratio: '1:1',
        image: Buffer.from('test-image').toString('base64'),
        mask: Buffer.from('test-mask').toString('base64'),
      });
    });

    it('uses input_image field for non-fill input images', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: Buffer.from('test-image'),
          },
        ],
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: '1:1',
        seed: undefined,
        providerOptions: {},
      });

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        prompt,
        aspect_ratio: '1:1',
        input_image: Buffer.from('test-image').toString('base64'),
      });
    });

    it('includes seed in providerMetadata images when provided by API', async () => {
      server.urls['https://api.example.com/poll'].response = {
        type: 'json-value',
        body: {
          status: 'Ready',
          result: {
            sample: 'https://api.example.com/image.png',
            seed: 12345,
          },
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: '1:1',
        providerOptions: {},
      });

      expect(result.providerMetadata?.blackForestLabs.images[0]).toMatchObject({
        seed: 12345,
      });
    });

    it('includes all cost and megapixel fields when provided by submit API', async () => {
      server.urls['https://api.example.com/v1/test-model'].response = {
        type: 'json-value',
        body: {
          id: 'req-123',
          polling_url: 'https://api.example.com/poll',
          cost: 0.08,
          input_mp: 1.5,
          output_mp: 2.0,
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: '1:1',
        providerOptions: {},
      });

      expect(result.providerMetadata?.blackForestLabs.images[0]).toMatchObject({
        cost: 0.08,
        inputMegapixels: 1.5,
        outputMegapixels: 2.0,
      });
    });

    it('omits cost and megapixel fields from providerMetadata when not provided by submit API', async () => {
      server.urls['https://api.example.com/v1/test-model'].response = {
        type: 'json-value',
        body: {
          id: 'req-123',
          polling_url: 'https://api.example.com/poll',
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: '1:1',
        providerOptions: {},
      });

      const metadata = result.providerMetadata?.blackForestLabs.images[0];
      expect(metadata).toBeDefined();
      expect(metadata).not.toHaveProperty('cost');
      expect(metadata).not.toHaveProperty('inputMegapixels');
      expect(metadata).not.toHaveProperty('outputMegapixels');
    });

    it('handles null cost and megapixel fields from submit API', async () => {
      server.urls['https://api.example.com/v1/test-model'].response = {
        type: 'json-value',
        body: {
          id: 'req-123',
          polling_url: 'https://api.example.com/poll',
          cost: null,
          input_mp: null,
          output_mp: null,
        },
      };

      const model = createBasicModel();
      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: '1:1',
        providerOptions: {},
      });

      const metadata = result.providerMetadata?.blackForestLabs.images[0];
      expect(metadata).toBeDefined();
      expect(metadata).not.toHaveProperty('cost');
      expect(metadata).not.toHaveProperty('inputMegapixels');
      expect(metadata).not.toHaveProperty('outputMegapixels');
    });

    it('calls the expected URLs in sequence', async () => {
      const model = createBasicModel();

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        aspectRatio: '16:9',
        providerOptions: {},
        size: undefined,
        seed: undefined,
      });

      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(
        'https://api.example.com/v1/test-model',
      );
      expect(server.calls[1].requestMethod).toBe('GET');
      expect(server.calls[1].requestUrl).toBe(
        'https://api.example.com/poll?id=req-123',
      );
      expect(server.calls[2].requestMethod).toBe('GET');
      expect(server.calls[2].requestUrl).toBe(
        'https://api.example.com/image.png',
      );
    });

    it('does not send the API key when the result URL is on a foreign origin', async () => {
      server.urls['https://api.example.com/poll'].response = {
        type: 'json-value',
        body: {
          status: 'Ready',
          result: { sample: 'https://cdn.evil.example/image.png' },
        },
      };

      const model = createBasicModel();
      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const downloadCall = server.calls.find(
        call => call.requestUrl === 'https://cdn.evil.example/image.png',
      );
      expect(downloadCall).toBeDefined();
      expect(downloadCall!.requestHeaders['x-key']).toBeUndefined();
    });

    it('sends the API key when the polling URL is on a sibling bfl.ai cluster host', async () => {
      const model = new BlackForestLabsImageModel('test-model', {
        provider: 'black-forest-labs.image',
        baseURL: 'https://api.bfl.ai/v1',
        headers: () => ({ 'x-key': 'test-key' }),
      });

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      const pollCall = server.calls.find(call =>
        call.requestUrl.startsWith('https://api.us1.bfl.ai/v1/get_result'),
      );
      expect(pollCall).toBeDefined();
      expect(pollCall!.requestHeaders['x-key']).toBe('test-key');
    });

    it('merges provider and request headers for submit call', async () => {
      const modelWithHeaders = createBasicModel({
        headers: () => ({
          'Custom-Provider-Header': 'provider-header-value',
          'x-key': 'test-key',
        }),
      });

      await modelWithHeaders.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        providerOptions: {},
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
      });

      expect(server.calls[0].requestHeaders).toStrictEqual({
        'content-type': 'application/json',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
        'x-key': 'test-key',
      });
    });

    it('passes merged headers to polling requests', async () => {
      const modelWithHeaders = createBasicModel({
        headers: () => ({
          'Custom-Provider-Header': 'provider-header-value',
          'x-key': 'test-key',
        }),
      });

      await modelWithHeaders.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        providerOptions: {},
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
        size: undefined,
        seed: undefined,
        aspectRatio: undefined,
      });

      expect(server.calls[1].requestHeaders).toStrictEqual({
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
        'x-key': 'test-key',
      });
    });

    it('warns and derives aspect_ratio when size is provided', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: '1024x1024',
        providerOptions: {},
        seed: undefined,
        aspectRatio: undefined,
      });

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "Deriving aspect_ratio from size. Use the width and height provider options to specify dimensions for models that support them.",
            "feature": "size",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('warns and ignores size when both size and aspectRatio are provided', async () => {
      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: '1920x1080',
        providerOptions: {},
        seed: undefined,
        aspectRatio: '16:9',
      });

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "Black Forest Labs ignores size when aspectRatio is provided. Use the width and height provider options to specify dimensions for models that support them",
            "feature": "size",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('handles API errors with message and detail', async () => {
      server.urls['https://api.example.com/v1/test-model'].response = {
        type: 'error',
        status: 400,
        body: JSON.stringify({
          message: 'Top-level message',
          detail: { error: 'Invalid prompt' },
        }),
      };

      const model = createBasicModel();

      await expect(
        model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          providerOptions: {},
          size: undefined,
          seed: undefined,
          aspectRatio: undefined,
        }),
      ).rejects.toMatchObject({
        message: '{"error":"Invalid prompt"}',
        statusCode: 400,
        url: 'https://api.example.com/v1/test-model',
      });
    });

    it('handles poll responses with state instead of status', async () => {
      server.urls['https://api.example.com/poll'].response = {
        type: 'json-value',
        body: {
          state: 'Ready',
          result: {
            sample: 'https://api.example.com/image.png',
          },
        },
      };

      const model = createBasicModel();

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: '1:1',
        providerOptions: {},
      });

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBeInstanceOf(Uint8Array);
    });

    it('polls multiple times using configured interval until Ready', async () => {
      let pollHitCount = 0;
      server.urls['https://api.example.com/poll'].response = () => {
        pollHitCount += 1;
        if (pollHitCount < 3) {
          return {
            type: 'json-value',
            body: { status: 'Pending' },
          };
        }
        return {
          type: 'json-value',
          body: {
            status: 'Ready',
            result: { sample: 'https://api.example.com/image.png' },
          },
        };
      };

      const model = createBasicModel({
        pollIntervalMillis: 10,
        pollTimeoutMillis: 1000,
      });

      await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        seed: undefined,
        aspectRatio: '1:1',
        providerOptions: {},
      });

      const pollCalls = server.calls.filter(
        c =>
          c.requestMethod === 'GET' &&
          c.requestUrl.startsWith('https://api.example.com/poll'),
      );
      expect(pollCalls.length).toBe(3);
    });

    it('uses configured pollTimeoutMillis and pollIntervalMillis to time out', async () => {
      server.urls['https://api.example.com/poll'].response = ({
        callNumber,
      }) => ({
        type: 'json-value',
        body: { status: 'Pending', callNumber },
      });

      const pollIntervalMillis = 10;
      const pollTimeoutMillis = 25;
      const model = createBasicModel({
        pollIntervalMillis,
        pollTimeoutMillis,
      });

      await expect(
        model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          seed: undefined,
          aspectRatio: '1:1',
          providerOptions: {},
        }),
      ).rejects.toThrow('Black Forest Labs generation timed out.');

      const pollCalls = server.calls.filter(
        c =>
          c.requestMethod === 'GET' &&
          c.requestUrl.startsWith('https://api.example.com/poll'),
      );
      expect(pollCalls.length).toBe(
        Math.ceil(pollTimeoutMillis / pollIntervalMillis),
      );
      const imageFetchCalls = server.calls.filter(c =>
        c.requestUrl.startsWith('https://api.example.com/image.png'),
      );
      expect(imageFetchCalls.length).toBe(0);
    });

    it('throws when poll is Ready but sample is missing', async () => {
      server.urls['https://api.example.com/poll'].response = {
        type: 'json-value',
        body: {
          status: 'Ready',
          result: null,
        },
      };

      const model = createBasicModel();

      await expect(
        model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          seed: undefined,
          aspectRatio: '1:1',
          providerOptions: {},
        }),
      ).rejects.toThrow(
        'Black Forest Labs poll response is Ready but missing result.sample',
      );
    });

    it('throws when poll returns Error or Failed', async () => {
      server.urls['https://api.example.com/poll'].response = {
        type: 'json-value',
        body: {
          status: 'Error',
        },
      };

      const model = createBasicModel();

      await expect(
        model.doGenerate({
          prompt,
          files: undefined,
          mask: undefined,
          n: 1,
          size: undefined,
          seed: undefined,
          aspectRatio: '1:1',
          providerOptions: {},
        }),
      ).rejects.toThrow('Black Forest Labs generation failed.');
    });

    it('includes timestamp, headers, and modelId in response metadata', async () => {
      const testDate = new Date('2025-01-01T00:00:00Z');
      const model = createBasicModel({
        currentDate: () => testDate,
      });

      const result = await model.doGenerate({
        prompt,
        files: undefined,
        mask: undefined,
        n: 1,
        providerOptions: {},
        size: undefined,
        seed: undefined,
        aspectRatio: '1:1',
      });

      expect(result.response).toStrictEqual({
        timestamp: testDate,
        modelId: 'test-model',
        headers: expect.any(Object),
      });
    });
  });

  describe('constructor', () => {
    it('exposes correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('black-forest-labs.image');
      expect(model.modelId).toBe('test-model');
      expect(model.specificationVersion).toBe('v4');
      expect(model.maxImagesPerCall).toBe(1);
    });
  });
});
