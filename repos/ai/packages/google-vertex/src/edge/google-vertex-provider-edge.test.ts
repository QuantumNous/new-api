import { resolve } from '@ai-sdk/provider-utils';
import { createGoogleVertex as createVertexEdge } from './google-vertex-provider-edge';
import { createGoogleVertex as createGoogleVertexOriginal } from '../google-vertex-provider-base';
import * as edgeAuth from './google-vertex-auth-edge';
import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';

// Mock the imported modules
vi.mock('./google-vertex-auth-edge', () => ({
  generateAuthToken: vi.fn().mockResolvedValue('mock-auth-token'),
}));

vi.mock('../google-vertex-provider-base', () => ({
  createGoogleVertex: vi.fn().mockImplementation(options => ({
    ...options,
  })),
}));

describe('google-vertex-provider-edge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GOOGLE_VERTEX_API_KEY;
  });

  afterEach(() => {
    delete process.env.GOOGLE_VERTEX_API_KEY;
  });

  it('default headers function should return auth token', async () => {
    createVertexEdge({ project: 'test-project' });

    const mockCreateVertex = vi.mocked(createGoogleVertexOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    expect(mockCreateVertex).toHaveBeenCalledTimes(1);
    expect(typeof passedOptions?.headers).toBe('function');

    expect(await resolve(passedOptions?.headers)).toStrictEqual({
      Authorization: 'Bearer mock-auth-token',
    });
  });

  it('should use custom headers in addition to auth token when provided', async () => {
    createVertexEdge({
      project: 'test-project',
      headers: async () => ({
        'Custom-Header': 'custom-value',
      }),
    });

    const mockCreateVertex = vi.mocked(createGoogleVertexOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    expect(mockCreateVertex).toHaveBeenCalledTimes(1);
    expect(typeof passedOptions?.headers).toBe('function');
    expect(await resolve(passedOptions?.headers)).toEqual({
      Authorization: 'Bearer mock-auth-token',
      'Custom-Header': 'custom-value',
    });
  });

  it('should use edge auth token generator', async () => {
    createVertexEdge({ project: 'test-project' });

    const mockCreateVertex = vi.mocked(createGoogleVertexOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    // Verify the headers function actually calls generateAuthToken by checking its result
    expect(passedOptions?.headers).toBeDefined();
    await resolve(passedOptions?.headers);
    expect(edgeAuth.generateAuthToken).toHaveBeenCalled();
  });

  it('passes googleCredentials to generateAuthToken', async () => {
    createVertexEdge({
      project: 'test-project',
      googleCredentials: {
        clientEmail: 'test@example.com',
        privateKey: 'test-key',
      },
    });

    const mockCreateVertex = vi.mocked(createGoogleVertexOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    await resolve(passedOptions?.headers); // call the headers function

    expect(edgeAuth.generateAuthToken).toHaveBeenCalledWith({
      clientEmail: 'test@example.com',
      privateKey: 'test-key',
    });
  });

  it('should pass options through to base provider when apiKey is provided', async () => {
    createVertexEdge({
      apiKey: 'test-api-key',
    });

    const mockCreateVertex = vi.mocked(createGoogleVertexOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    expect(passedOptions?.apiKey).toBe('test-api-key');
    expect(passedOptions?.headers).toBeUndefined();
    expect(edgeAuth.generateAuthToken).not.toHaveBeenCalled();
  });
});
