import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XaiFiles } from './xai-files';

const mockFetchResponse = ({
  body,
  status = 200,
}: {
  body: object;
  status?: number;
}) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

const defaultResponseBody = {
  id: 'file-abc123',
  object: 'file',
  bytes: 3,
  created_at: 1234567890,
  filename: 'upload',
};

describe('XaiFiles', () => {
  let mockHeaders: () => Record<string, string | undefined>;

  beforeEach(() => {
    mockHeaders = () => ({
      Authorization: 'Bearer test-key',
    });
  });

  describe('uploadFile', () => {
    it('should send a multipart POST to /v1/files', async () => {
      const fetchMock = mockFetchResponse({ body: defaultResponseBody });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
      });

      expect(fetchMock).toHaveBeenCalledOnce();

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.x.ai/v1/files');
      expect(options.method).toBe('POST');

      const body = options.body as FormData;
      expect(body.get('file')).toBeInstanceOf(Blob);
    });

    it('should return providerReference with xai key set to id', async () => {
      const fetchMock = mockFetchResponse({
        body: { ...defaultResponseBody, id: 'file-xyz789' },
      });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      const result = await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
      });

      expect(result.providerReference).toEqual({ xai: 'file-xyz789' });
    });

    it('should include providerMetadata with response data', async () => {
      const fetchMock = mockFetchResponse({
        body: {
          id: 'file-abc123',
          object: 'file',
          bytes: 512,
          created_at: 1700000000,
          filename: 'data.csv',
        },
      });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      const result = await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1]) },
        mediaType: 'application/octet-stream',
      });

      expect(result.providerMetadata).toEqual({
        xai: {
          filename: 'data.csv',
          bytes: 512,
          createdAt: 1700000000,
        },
      });
    });

    it('should pass custom filename when provided', async () => {
      const fetchMock = mockFetchResponse({ body: defaultResponseBody });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
        filename: 'custom-name.pdf',
      });

      const [, options] = fetchMock.mock.calls[0];
      const body = options.body as FormData;
      const file = body.get('file') as File;
      expect(file.name).toBe('custom-name.pdf');
    });

    it('should use default filename "blob" when not provided', async () => {
      const fetchMock = mockFetchResponse({ body: defaultResponseBody });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1, 2, 3]) },
        mediaType: 'application/octet-stream',
      });

      const [, options] = fetchMock.mock.calls[0];
      const body = options.body as FormData;
      const file = body.get('file') as File;
      expect(file.name).toBe('blob');
    });

    it('should pass teamId as team_id when provided', async () => {
      const fetchMock = mockFetchResponse({ body: defaultResponseBody });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1]) },
        mediaType: 'application/octet-stream',
        providerOptions: {
          xai: { teamId: 'team-123' },
        },
      });

      const [, options] = fetchMock.mock.calls[0];
      const body = options.body as FormData;
      expect(body.get('team_id')).toBe('team-123');
    });

    it('should not include team_id when not provided', async () => {
      const fetchMock = mockFetchResponse({ body: defaultResponseBody });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1]) },
        mediaType: 'application/octet-stream',
      });

      const [, options] = fetchMock.mock.calls[0];
      const body = options.body as FormData;
      expect(body.get('team_id')).toBeNull();
    });

    it('should convert base64 string data to bytes', async () => {
      const fetchMock = mockFetchResponse({ body: defaultResponseBody });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      await files.uploadFile({
        data: { type: 'data', data: 'dGVzdA==' },
        mediaType: 'application/octet-stream',
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [, options] = fetchMock.mock.calls[0];
      const body = options.body as FormData;
      const file = body.get('file') as Blob;
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      expect(Array.from(bytes)).toEqual([116, 101, 115, 116]);
    });

    it('should omit null response fields from providerMetadata', async () => {
      const fetchMock = mockFetchResponse({
        body: {
          id: 'file-abc123',
          object: 'file',
          bytes: null,
          created_at: null,
          filename: null,
        },
      });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      const result = await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1]) },
        mediaType: 'application/octet-stream',
      });

      expect(result.providerMetadata).toEqual({ xai: {} });
    });

    it('should return empty warnings array', async () => {
      const fetchMock = mockFetchResponse({ body: defaultResponseBody });

      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
        fetch: fetchMock,
      });

      const result = await files.uploadFile({
        data: { type: 'data', data: new Uint8Array([1]) },
        mediaType: 'application/octet-stream',
      });

      expect(result.warnings).toEqual([]);
    });

    it('should have specificationVersion v4', () => {
      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
      });

      expect(files.specificationVersion).toBe('v4');
    });

    it('should have the correct provider name', () => {
      const files = new XaiFiles({
        provider: 'xai.files',
        baseURL: 'https://api.x.ai/v1',
        headers: mockHeaders,
      });

      expect(files.provider).toBe('xai.files');
    });
  });
});
