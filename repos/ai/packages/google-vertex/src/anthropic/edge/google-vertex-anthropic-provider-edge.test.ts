import { resolve } from '@ai-sdk/provider-utils';
import * as edgeAuth from '../../edge/google-vertex-auth-edge';
import { createGoogleVertexAnthropic as createVertexAnthropicOriginal } from '../google-vertex-anthropic-provider';
import { createGoogleVertexAnthropic as createVertexAnthropicEdge } from './google-vertex-anthropic-provider-edge';
import { describe, beforeEach, expect, it, vi } from 'vitest';

// Mock the imported modules
vi.mock('../../edge/google-vertex-auth-edge', () => ({
  generateAuthToken: vi.fn().mockResolvedValue('mock-auth-token'),
}));

vi.mock('../google-vertex-anthropic-provider', () => ({
  createGoogleVertexAnthropic: vi.fn().mockImplementation(options => ({
    ...options,
  })),
}));

describe('google-vertex-anthropic-provider-edge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('default headers function should return auth token', async () => {
    createVertexAnthropicEdge({ project: 'test-project' });

    const mockCreateVertex = vi.mocked(createVertexAnthropicOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    expect(mockCreateVertex).toHaveBeenCalledTimes(1);
    expect(typeof passedOptions?.headers).toBe('function');

    expect(await resolve(passedOptions?.headers)).toStrictEqual({
      Authorization: 'Bearer mock-auth-token',
    });
  });

  it('should use custom headers in addition to auth token when provided', async () => {
    createVertexAnthropicEdge({
      project: 'test-project',
      headers: async () => ({
        'Custom-Header': 'custom-value',
      }),
    });

    const mockCreateVertex = vi.mocked(createVertexAnthropicOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    expect(mockCreateVertex).toHaveBeenCalledTimes(1);
    expect(typeof passedOptions?.headers).toBe('function');
    expect(await resolve(passedOptions?.headers)).toEqual({
      Authorization: 'Bearer mock-auth-token',
      'Custom-Header': 'custom-value',
    });
  });

  it('should use edge auth token generator', async () => {
    createVertexAnthropicEdge({ project: 'test-project' });

    const mockCreateVertex = vi.mocked(createVertexAnthropicOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    // Verify the headers function actually calls generateAuthToken by checking its result
    expect(passedOptions?.headers).toBeDefined();
    await resolve(passedOptions?.headers);
    expect(edgeAuth.generateAuthToken).toHaveBeenCalled();
  });

  it('passes googleCredentials to generateAuthToken', async () => {
    createVertexAnthropicEdge({
      project: 'test-project',
      googleCredentials: {
        clientEmail: 'test@example.com',
        privateKey: 'test-key',
      },
    });

    const mockCreateVertex = vi.mocked(createVertexAnthropicOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    await resolve(passedOptions?.headers); // call the headers function

    expect(edgeAuth.generateAuthToken).toHaveBeenCalledWith({
      clientEmail: 'test@example.com',
      privateKey: 'test-key',
    });
  });

  it('uses custom generateAuthToken when provided and skips the default', async () => {
    const customGenerate = vi.fn().mockResolvedValue('custom-token');

    createVertexAnthropicEdge({
      project: 'test-project',
      generateAuthToken: customGenerate,
    });

    const mockCreateVertex = vi.mocked(createVertexAnthropicOriginal);
    const passedOptions = mockCreateVertex.mock.calls[0][0];

    expect(await resolve(passedOptions?.headers)).toEqual({
      Authorization: 'Bearer custom-token',
    });
    expect(customGenerate).toHaveBeenCalledTimes(1);
    expect(edgeAuth.generateAuthToken).not.toHaveBeenCalled();
  });

  it('merges custom generateAuthToken with user-provided headers', async () => {
    const customGenerate = vi.fn().mockResolvedValue('custom-token');

    createVertexAnthropicEdge({
      project: 'test-project',
      generateAuthToken: customGenerate,
      headers: async () => ({ 'Custom-Header': 'custom-value' }),
    });

    const passedOptions = vi.mocked(createVertexAnthropicOriginal).mock
      .calls[0][0];

    expect(await resolve(passedOptions?.headers)).toEqual({
      Authorization: 'Bearer custom-token',
      'Custom-Header': 'custom-value',
    });
  });

  it('invokes custom generateAuthToken on each headers resolution', async () => {
    let callCount = 0;
    const customGenerate = vi.fn().mockImplementation(async () => {
      callCount += 1;
      return `token-${callCount}`;
    });

    createVertexAnthropicEdge({
      project: 'test-project',
      generateAuthToken: customGenerate,
    });

    const passedOptions = vi.mocked(createVertexAnthropicOriginal).mock
      .calls[0][0];

    expect(await resolve(passedOptions?.headers)).toEqual({
      Authorization: 'Bearer token-1',
    });
    expect(await resolve(passedOptions?.headers)).toEqual({
      Authorization: 'Bearer token-2',
    });
    expect(customGenerate).toHaveBeenCalledTimes(2);
  });

  it('propagates errors thrown from custom generateAuthToken', async () => {
    const customGenerate = vi
      .fn()
      .mockRejectedValue(new Error('token mint failed'));

    createVertexAnthropicEdge({
      project: 'test-project',
      generateAuthToken: customGenerate,
    });

    const passedOptions = vi.mocked(createVertexAnthropicOriginal).mock
      .calls[0][0];

    await expect(resolve(passedOptions?.headers)).rejects.toThrow(
      'token mint failed',
    );
  });

  it('user-provided Authorization in headers overrides the generated token', async () => {
    const customGenerate = vi.fn().mockResolvedValue('custom-token');

    createVertexAnthropicEdge({
      project: 'test-project',
      generateAuthToken: customGenerate,
      headers: async () => ({ Authorization: 'Bearer user-override' }),
    });

    const passedOptions = vi.mocked(createVertexAnthropicOriginal).mock
      .calls[0][0];

    expect(await resolve(passedOptions?.headers)).toEqual({
      Authorization: 'Bearer user-override',
    });
  });
});
