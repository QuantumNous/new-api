import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, it, expect, vi } from 'vitest';
import { createOpenAI } from '../openai-provider';

vi.mock('../version', () => ({
  VERSION: '0.0.0-test',
}));

const server = createTestServer({
  'https://api.openai.com/v1/files': {},
});

function prepareFileResponse({
  headers,
  id = 'file-abc123',
}: {
  headers?: Record<string, string>;
  id?: string;
} = {}) {
  server.urls['https://api.openai.com/v1/files'].response = {
    type: 'json-value',
    headers,
    body: {
      id,
      object: 'file',
      bytes: 1024,
      created_at: 1700000000,
      filename: 'test.csv',
      purpose: 'assistants',
      status: 'processed',
      expires_at: null,
    },
  };
}

describe('OpenAI Files - uploadFile', () => {
  it('should send correct multipart request with purpose', async () => {
    prepareFileResponse();

    const provider = createOpenAI({ apiKey: 'test-api-key' });
    const files = provider.files();

    await files.uploadFile({
      data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
      mediaType: 'application/octet-stream',
      providerOptions: {
        openai: { purpose: 'assistants' },
      },
    });

    const multipart = await server.calls[0].requestBodyMultipart;
    expect(multipart).toMatchObject({
      purpose: 'assistants',
    });
    expect(multipart!.file).toBeDefined();
  });

  it('should return providerReference with openai key', async () => {
    prepareFileResponse({ id: 'file-xyz789' });

    const provider = createOpenAI({ apiKey: 'test-api-key' });
    const files = provider.files();

    const result = await files.uploadFile({
      data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
      mediaType: 'application/octet-stream',
      providerOptions: {
        openai: { purpose: 'assistants' },
      },
    });

    expect(result.providerReference).toEqual({ openai: 'file-xyz789' });
  });

  it('should return providerMetadata from response', async () => {
    prepareFileResponse();

    const provider = createOpenAI({ apiKey: 'test-api-key' });
    const files = provider.files();

    const result = await files.uploadFile({
      data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
      mediaType: 'application/octet-stream',
      providerOptions: {
        openai: { purpose: 'assistants' },
      },
    });

    expect(result.providerMetadata).toEqual({
      openai: {
        filename: 'test.csv',
        purpose: 'assistants',
        bytes: 1024,
        createdAt: 1700000000,
        status: 'processed',
      },
    });
  });

  it('should default purpose to assistants when not provided', async () => {
    prepareFileResponse();

    const provider = createOpenAI({ apiKey: 'test-api-key' });
    const files = provider.files();

    await files.uploadFile({
      data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
      mediaType: 'application/octet-stream',
    });

    const multipart = await server.calls[0].requestBodyMultipart;
    expect(multipart).toMatchObject({
      purpose: 'assistants',
    });
  });

  it('should pass expires_after when provided', async () => {
    prepareFileResponse();

    const provider = createOpenAI({ apiKey: 'test-api-key' });
    const files = provider.files();

    await files.uploadFile({
      data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
      mediaType: 'application/octet-stream',
      providerOptions: {
        openai: { purpose: 'assistants', expiresAfter: 3600 },
      },
    });

    const multipart = await server.calls[0].requestBodyMultipart;
    expect(multipart!.expires_after).toBe('3600');
  });

  it('should pass auth headers', async () => {
    prepareFileResponse();

    const provider = createOpenAI({
      apiKey: 'test-api-key',
      organization: 'test-org',
      project: 'test-project',
      headers: {
        'Custom-Header': 'custom-value',
      },
    });
    const files = provider.files();

    await files.uploadFile({
      data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
      mediaType: 'application/octet-stream',
      providerOptions: {
        openai: { purpose: 'assistants' },
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'Bearer test-api-key',
      'openai-organization': 'test-org',
      'openai-project': 'test-project',
      'custom-header': 'custom-value',
    });
  });

  it('should handle base64 string data', async () => {
    prepareFileResponse();

    const provider = createOpenAI({ apiKey: 'test-api-key' });
    const files = provider.files();

    const result = await files.uploadFile({
      data: { type: 'data', data: btoa('hello world') },
      mediaType: 'application/octet-stream',
      providerOptions: {
        openai: { purpose: 'assistants' },
      },
    });

    expect(result.providerReference).toEqual({ openai: 'file-abc123' });
  });

  it('should set specificationVersion and provider', () => {
    const provider = createOpenAI({ apiKey: 'test-api-key' });
    const files = provider.files();

    expect(files.specificationVersion).toBe('v4');
    expect(files.provider).toBe('openai.files');
  });
});
