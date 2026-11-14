import { resolve } from '@ai-sdk/provider-utils';
import { createAuthTokenGenerator } from './google-vertex-auth-google-auth-library';
import { createGoogleVertex as createGoogleVertexOriginal } from './google-vertex-provider-base';
import { createGoogleVertex as createVertexNode } from './google-vertex-provider';
import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';

// Mock the imported modules
vi.mock('./google-vertex-auth-google-auth-library', () => ({
  createAuthTokenGenerator: vi.fn(() =>
    vi.fn().mockResolvedValue('mock-auth-token'),
  ),
}));

vi.mock('./google-vertex-provider-base', () => ({
  createGoogleVertex: vi.fn().mockImplementation(options => ({
    ...options,
  })),
}));

describe('google-vertex-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GOOGLE_VERTEX_API_KEY;
  });

  afterEach(() => {
    delete process.env.GOOGLE_VERTEX_API_KEY;
  });

  it('default headers function should return auth token', async () => {
    createVertexNode({ project: 'test-project' });

    expect(createGoogleVertexOriginal).toHaveBeenCalledTimes(1);
    const passedOptions = vi.mocked(createGoogleVertexOriginal).mock
      .calls[0][0];

    expect(typeof passedOptions?.headers).toBe('function');
    expect(await resolve(passedOptions?.headers)).toStrictEqual({
      Authorization: 'Bearer mock-auth-token',
    });
  });

  it('should use custom headers in addition to auth token when provided', async () => {
    createVertexNode({
      project: 'test-project',
      headers: async () => ({
        'Custom-Header': 'custom-value',
      }),
    });

    expect(createGoogleVertexOriginal).toHaveBeenCalledTimes(1);
    const passedOptions = vi.mocked(createGoogleVertexOriginal).mock
      .calls[0][0];

    expect(await resolve(passedOptions?.headers)).toEqual({
      Authorization: 'Bearer mock-auth-token',
      'Custom-Header': 'custom-value',
    });
  });

  it('passes googleAuthOptions to createAuthTokenGenerator', async () => {
    createVertexNode({
      googleAuthOptions: {
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        keyFile: 'path/to/key.json',
      },
    });

    expect(createGoogleVertexOriginal).toHaveBeenCalledTimes(1);
    const passedOptions = vi.mocked(createGoogleVertexOriginal).mock
      .calls[0][0];

    await resolve(passedOptions?.headers); // call the headers function

    expect(createAuthTokenGenerator).toHaveBeenCalledWith({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      keyFile: 'path/to/key.json',
    });
  });

  it('passes project to createAuthTokenGenerator as projectId', async () => {
    createVertexNode({
      project: 'test-project',
    });

    expect(createGoogleVertexOriginal).toHaveBeenCalledTimes(1);
    const passedOptions = vi.mocked(createGoogleVertexOriginal).mock
      .calls[0][0];

    await resolve(passedOptions?.headers); // call the headers function

    expect(createAuthTokenGenerator).toHaveBeenCalledWith({
      projectId: 'test-project',
    });
  });

  it('does not override explicit googleAuthOptions projectId', async () => {
    createVertexNode({
      project: 'provider-project',
      googleAuthOptions: {
        projectId: 'auth-project',
        keyFile: 'path/to/key.json',
      },
    });

    expect(createGoogleVertexOriginal).toHaveBeenCalledTimes(1);
    const passedOptions = vi.mocked(createGoogleVertexOriginal).mock
      .calls[0][0];

    await resolve(passedOptions?.headers); // call the headers function

    expect(createAuthTokenGenerator).toHaveBeenCalledWith({
      projectId: 'auth-project',
      keyFile: 'path/to/key.json',
    });
  });

  it('should pass options through to base provider when apiKey is provided', async () => {
    createVertexNode({
      apiKey: 'test-api-key',
    });

    expect(createGoogleVertexOriginal).toHaveBeenCalledTimes(1);
    const passedOptions = vi.mocked(createGoogleVertexOriginal).mock
      .calls[0][0];

    expect(passedOptions?.apiKey).toBe('test-api-key');
    expect(passedOptions?.headers).toBeUndefined();
    expect(createAuthTokenGenerator).not.toHaveBeenCalled();
  });

  it('creates the auth token generator once per provider instance', async () => {
    createVertexNode({ project: 'test-project' });

    expect(createAuthTokenGenerator).toHaveBeenCalledTimes(1);

    const passedOptions = vi.mocked(createGoogleVertexOriginal).mock
      .calls[0][0];

    await resolve(passedOptions?.headers);
    await resolve(passedOptions?.headers);

    expect(createAuthTokenGenerator).toHaveBeenCalledTimes(1);
  });
});
