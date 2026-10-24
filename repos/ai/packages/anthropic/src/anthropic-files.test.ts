import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { AnthropicFiles } from './anthropic-files';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const server = createTestServer({
  'https://api.anthropic.com/v1/files': {},
});

const createFiles = (options?: { headers?: Record<string, string> }) =>
  new AnthropicFiles({
    provider: 'anthropic.files',
    baseURL: 'https://api.anthropic.com/v1',
    headers: () => ({
      'x-api-key': 'test-api-key',
      'anthropic-version': '2023-06-01',
      ...options?.headers,
    }),
  });

const successfulResponse = {
  type: 'json-value' as const,
  body: {
    id: 'file-abc123',
    type: 'file',
    filename: 'test.pdf',
    mime_type: 'application/pdf',
    size_bytes: 12345,
    created_at: '2025-04-14T12:00:00Z',
    downloadable: true,
  },
};

describe('AnthropicFiles', () => {
  describe('uploadFile', () => {
    it('sends POST to /v1/files with correct beta header', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response =
        successfulResponse;

      const files = createFiles();
      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
        providerOptions: {},
      });

      expect(server.calls.length).toBe(1);
      expect(server.calls[0].requestMethod).toBe('POST');
      expect(server.calls[0].requestUrl).toBe(
        'https://api.anthropic.com/v1/files',
      );
      expect(server.calls[0].requestHeaders['anthropic-beta']).toBe(
        'files-api-2025-04-14',
      );
    });

    it('sends x-api-key header', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response =
        successfulResponse;

      const files = createFiles();
      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
        providerOptions: {},
      });

      expect(server.calls[0].requestHeaders['x-api-key']).toBe('test-api-key');
    });

    it('sends multipart form data with file', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response =
        successfulResponse;

      const files = createFiles();
      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
        providerOptions: {},
      });

      const multipart = await server.calls[0].requestBodyMultipart;
      expect(multipart).not.toBeNull();
      expect(multipart!.file).toBeDefined();
    });

    it('uses default filename "blob" when not specified', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response =
        successfulResponse;

      const files = createFiles();
      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
        providerOptions: {},
      });

      const multipart = await server.calls[0].requestBodyMultipart;
      const file = multipart!.file as File;
      expect(file.name).toBe('blob');
    });

    it('uses custom filename from spec options', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response =
        successfulResponse;

      const files = createFiles();
      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
        filename: 'custom-name.pdf',
        providerOptions: {},
      });

      const multipart = await server.calls[0].requestBodyMultipart;
      const file = multipart!.file as File;
      expect(file.name).toBe('custom-name.pdf');
    });

    it('uses mediaType from spec options', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response =
        successfulResponse;

      const files = createFiles();
      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/pdf',
      });

      const multipart = await server.calls[0].requestBodyMultipart;
      const file = multipart!.file as File;
      expect(file.type).toBe('application/pdf');
    });

    it('returns providerReference with anthropic key set to file ID', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response =
        successfulResponse;

      const files = createFiles();
      const result = await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
        providerOptions: {},
      });

      expect(result.providerReference).toEqual({ anthropic: 'file-abc123' });
    });

    it('returns providerMetadata with response data', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response =
        successfulResponse;

      const files = createFiles();
      const result = await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual({
        anthropic: {
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 12345,
          createdAt: '2025-04-14T12:00:00Z',
          downloadable: true,
        },
      });
    });

    it('omits downloadable from providerMetadata when null', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response = {
        type: 'json-value',
        body: {
          id: 'file-abc123',
          type: 'file',
          filename: 'test.pdf',
          mime_type: 'application/pdf',
          size_bytes: 12345,
          created_at: '2025-04-14T12:00:00Z',
          downloadable: null,
        },
      };

      const files = createFiles();
      const result = await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
        providerOptions: {},
      });

      expect(result.providerMetadata!.anthropic).not.toHaveProperty(
        'downloadable',
      );
    });

    it('handles base64 string data', async () => {
      server.urls['https://api.anthropic.com/v1/files'].response =
        successfulResponse;

      const files = createFiles();
      const result = await files.uploadFile({
        data: { type: 'data', data: 'AQID' },
        mediaType: 'application/octet-stream',
        providerOptions: {},
      });

      expect(result.providerReference).toEqual({ anthropic: 'file-abc123' });
    });

    it('has specificationVersion v4', () => {
      const files = createFiles();
      expect(files.specificationVersion).toBe('v4');
    });

    it('has correct provider name', () => {
      const files = createFiles();
      expect(files.provider).toBe('anthropic.files');
    });
  });
});
