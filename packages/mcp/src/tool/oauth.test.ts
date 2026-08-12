import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  extractResourceMetadataUrl,
  discoverOAuthProtectedResourceMetadata,
  buildDiscoveryUrls,
  discoverAuthorizationServerMetadata,
  startAuthorization,
  exchangeAuthorization,
  refreshAuthorization,
  registerClient,
  auth,
  type OAuthClientProvider,
  type AuthResult,
} from './oauth';
import type { AuthorizationServerMetadata } from './oauth-types';
import { ServerError } from '../error/oauth-error';
import { LATEST_PROTOCOL_VERSION } from './types';

// Mock the pkce-challenge module
vi.mock('pkce-challenge', () => ({
  default: vi.fn(() => ({
    code_verifier: 'test_verifier',
    code_challenge: 'test_challenge',
  })),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('extractResourceMetadataUrl', () => {
  it('returns resource metadata url when present', async () => {
    const resourceUrl =
      'https://resource.example.com/.well-known/oauth-protected-resource';
    const mockResponse = {
      headers: {
        get: vi.fn(name =>
          name === 'WWW-Authenticate'
            ? `Bearer realm="mcp", resource_metadata="${resourceUrl}"`
            : null,
        ),
      },
    } as unknown as Response;

    expect(extractResourceMetadataUrl(mockResponse)).toEqual(
      new URL(resourceUrl),
    );
  });

  it('returns undefined if not bearer', async () => {
    const resourceUrl =
      'https://resource.example.com/.well-known/oauth-protected-resource';
    const mockResponse = {
      headers: {
        get: vi.fn(name =>
          name === 'WWW-Authenticate'
            ? `Basic realm="mcp", resource_metadata="${resourceUrl}"`
            : null,
        ),
      },
    } as unknown as Response;

    expect(extractResourceMetadataUrl(mockResponse)).toBeUndefined();
  });

  it('returns undefined if resource_metadata not present', async () => {
    const mockResponse = {
      headers: {
        get: vi.fn(name =>
          name === 'WWW-Authenticate' ? `Basic realm="mcp"` : null,
        ),
      },
    } as unknown as Response;

    expect(extractResourceMetadataUrl(mockResponse)).toBeUndefined();
  });

  it('returns undefined on invalid url', async () => {
    const resourceUrl = 'invalid-url';
    const mockResponse = {
      headers: {
        get: vi.fn(name =>
          name === 'WWW-Authenticate'
            ? `Basic realm="mcp", resource_metadata="${resourceUrl}"`
            : null,
        ),
      },
    } as unknown as Response;

    expect(extractResourceMetadataUrl(mockResponse)).toBeUndefined();
  });
});

describe('discoverOAuthProtectedResourceMetadata', () => {
  const validMetadata = {
    resource: 'https://resource.example.com',
    authorization_servers: ['https://auth.example.com'],
  };

  it('returns metadata when discovery succeeds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validMetadata,
    });

    const metadata = await discoverOAuthProtectedResourceMetadata(
      'https://resource.example.com',
    );
    expect(metadata).toEqual(validMetadata);
    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(1);
    const [url] = calls[0];
    expect(url.toString()).toBe(
      'https://resource.example.com/.well-known/oauth-protected-resource',
    );
  });

  it('returns metadata when first fetch fails but second without MCP header succeeds', async () => {
    // Set up a counter to control behavior
    let callCount = 0;

    // Mock implementation that changes behavior based on call count
    mockFetch.mockImplementation((_url, _options) => {
      callCount++;

      if (callCount === 1) {
        // First call with MCP header - fail with TypeError (simulating CORS error)
        // We need to use TypeError specifically because that's what the implementation checks for
        return Promise.reject(new TypeError('Network error'));
      } else {
        // Second call without header - succeed
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => validMetadata,
        });
      }
    });

    // Should succeed with the second call
    const metadata = await discoverOAuthProtectedResourceMetadata(
      'https://resource.example.com',
    );
    expect(metadata).toEqual(validMetadata);

    // Verify both calls were made
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify first call had MCP header
    expect(mockFetch.mock.calls[0][1]?.headers).toHaveProperty(
      'MCP-Protocol-Version',
    );
  });

  it('throws an error when all fetch attempts fail', async () => {
    // Set up a counter to control behavior
    let callCount = 0;

    // Mock implementation that changes behavior based on call count
    mockFetch.mockImplementation((_url, _options) => {
      callCount++;

      if (callCount === 1) {
        // First call - fail with TypeError
        return Promise.reject(new TypeError('First failure'));
      } else {
        // Second call - fail with different error
        return Promise.reject(new Error('Second failure'));
      }
    });

    // Should fail with the second error
    await expect(
      discoverOAuthProtectedResourceMetadata('https://resource.example.com'),
    ).rejects.toThrow('Second failure');

    // Verify both calls were made
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on 404 errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      discoverOAuthProtectedResourceMetadata('https://resource.example.com'),
    ).rejects.toThrow(
      'Resource server does not implement OAuth 2.0 Protected Resource Metadata.',
    );
  });

  it('throws on non-404 errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(
      discoverOAuthProtectedResourceMetadata('https://resource.example.com'),
    ).rejects.toThrow('HTTP 500');
  });

  it('validates metadata schema', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        // Missing required fields
        scopes_supported: ['email', 'mcp'],
      }),
    });

    await expect(
      discoverOAuthProtectedResourceMetadata('https://resource.example.com'),
    ).rejects.toThrow();
  });

  it('returns metadata when discovery succeeds with path', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validMetadata,
    });

    const metadata = await discoverOAuthProtectedResourceMetadata(
      'https://resource.example.com/path/name',
    );
    expect(metadata).toEqual(validMetadata);
    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(1);
    const [url] = calls[0];
    expect(url.toString()).toBe(
      'https://resource.example.com/.well-known/oauth-protected-resource/path/name',
    );
  });

  it('preserves query parameters in path-aware discovery', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validMetadata,
    });

    const metadata = await discoverOAuthProtectedResourceMetadata(
      'https://resource.example.com/path?param=value',
    );
    expect(metadata).toEqual(validMetadata);
    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(1);
    const [url] = calls[0];
    expect(url.toString()).toBe(
      'https://resource.example.com/.well-known/oauth-protected-resource/path?param=value',
    );
  });

  it.each([400, 401, 403, 404, 410, 422, 429])(
    'falls back to root discovery when path-aware discovery returns %d',
    async statusCode => {
      // First call (path-aware) returns 4xx
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: statusCode,
      });

      // Second call (root fallback) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validMetadata,
      });

      const metadata = await discoverOAuthProtectedResourceMetadata(
        'https://resource.example.com/path/name',
      );
      expect(metadata).toEqual(validMetadata);

      const calls = mockFetch.mock.calls;
      expect(calls.length).toBe(2);

      // First call should be path-aware
      const [firstUrl, firstOptions] = calls[0];
      expect(firstUrl.toString()).toBe(
        'https://resource.example.com/.well-known/oauth-protected-resource/path/name',
      );
      expect(firstOptions.headers).toEqual({
        'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION,
      });

      // Second call should be root fallback
      const [secondUrl, secondOptions] = calls[1];
      expect(secondUrl.toString()).toBe(
        'https://resource.example.com/.well-known/oauth-protected-resource',
      );
      expect(secondOptions.headers).toEqual({
        'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION,
      });
    },
  );

  it('throws error when both path-aware and root discovery return 404', async () => {
    // First call (path-aware) returns 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    // Second call (root fallback) also returns 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      discoverOAuthProtectedResourceMetadata(
        'https://resource.example.com/path/name',
      ),
    ).rejects.toThrow(
      'Resource server does not implement OAuth 2.0 Protected Resource Metadata.',
    );

    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(2);
  });

  it('throws error on 500 status and does not fallback', async () => {
    // First call (path-aware) returns 500
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(
      discoverOAuthProtectedResourceMetadata(
        'https://resource.example.com/path/name',
      ),
    ).rejects.toThrow();

    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(1); // Should not attempt fallback
  });

  it('does not fallback when the original URL is already at root path', async () => {
    // First call (path-aware for root) returns 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      discoverOAuthProtectedResourceMetadata('https://resource.example.com/'),
    ).rejects.toThrow(
      'Resource server does not implement OAuth 2.0 Protected Resource Metadata.',
    );

    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(1); // Should not attempt fallback

    const [url] = calls[0];
    expect(url.toString()).toBe(
      'https://resource.example.com/.well-known/oauth-protected-resource',
    );
  });

  it('does not fallback when the original URL has no path', async () => {
    // First call (path-aware for no path) returns 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      discoverOAuthProtectedResourceMetadata('https://resource.example.com'),
    ).rejects.toThrow(
      'Resource server does not implement OAuth 2.0 Protected Resource Metadata.',
    );

    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(1); // Should not attempt fallback

    const [url] = calls[0];
    expect(url.toString()).toBe(
      'https://resource.example.com/.well-known/oauth-protected-resource',
    );
  });

  it('falls back when path-aware discovery encounters CORS error', async () => {
    // First call (path-aware) fails with TypeError (CORS)
    mockFetch.mockImplementationOnce(() =>
      Promise.reject(new TypeError('CORS error')),
    );

    // Retry path-aware without headers (simulating CORS retry)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    // Second call (root fallback) succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validMetadata,
    });

    const metadata = await discoverOAuthProtectedResourceMetadata(
      'https://resource.example.com/deep/path',
    );
    expect(metadata).toEqual(validMetadata);

    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(3);

    // Final call should be root fallback
    const [lastUrl, lastOptions] = calls[2];
    expect(lastUrl.toString()).toBe(
      'https://resource.example.com/.well-known/oauth-protected-resource',
    );
    expect(lastOptions.headers).toEqual({
      'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION,
    });
  });

  it('does not fallback when resourceMetadataUrl is provided', async () => {
    // Call with explicit URL returns 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      discoverOAuthProtectedResourceMetadata(
        'https://resource.example.com/path',
        {
          resourceMetadataUrl: 'https://custom.example.com/metadata',
        },
      ),
    ).rejects.toThrow(
      'Resource server does not implement OAuth 2.0 Protected Resource Metadata.',
    );

    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(1); // Should not attempt fallback when explicit URL is provided

    const [url] = calls[0];
    expect(url.toString()).toBe('https://custom.example.com/metadata');
  });

  it('supports overriding the fetch function used for requests', async () => {
    const validMetadata = {
      resource: 'https://resource.example.com',
      authorization_servers: ['https://auth.example.com'],
    };

    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validMetadata,
    });

    const metadata = await discoverOAuthProtectedResourceMetadata(
      'https://resource.example.com',
      undefined,
      customFetch,
    );

    expect(metadata).toEqual(validMetadata);
    expect(customFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();

    const [url, options] = customFetch.mock.calls[0];
    expect(url.toString()).toBe(
      'https://resource.example.com/.well-known/oauth-protected-resource',
    );
    expect(options.headers).toEqual({
      'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION,
    });
  });
});

describe('buildDiscoveryUrls', () => {
  it('generates correct URLs for server without path', () => {
    const urls = buildDiscoveryUrls('https://auth.example.com');

    expect(urls).toHaveLength(2);
    expect(urls.map(u => ({ url: u.url.toString(), type: u.type }))).toEqual([
      {
        url: 'https://auth.example.com/.well-known/oauth-authorization-server',
        type: 'oauth',
      },
      {
        url: 'https://auth.example.com/.well-known/openid-configuration',
        type: 'oidc',
      },
    ]);
  });

  it('generates correct URLs for server with path', () => {
    const urls = buildDiscoveryUrls('https://auth.example.com/tenant1');

    expect(urls).toHaveLength(4);
    expect(urls.map(u => ({ url: u.url.toString(), type: u.type }))).toEqual([
      {
        url: 'https://auth.example.com/.well-known/oauth-authorization-server/tenant1',
        type: 'oauth',
      },
      {
        url: 'https://auth.example.com/.well-known/oauth-authorization-server',
        type: 'oauth',
      },
      {
        url: 'https://auth.example.com/.well-known/openid-configuration/tenant1',
        type: 'oidc',
      },
      {
        url: 'https://auth.example.com/tenant1/.well-known/openid-configuration',
        type: 'oidc',
      },
    ]);
  });

  it('handles URL object input', () => {
    const urls = buildDiscoveryUrls(
      new URL('https://auth.example.com/tenant1'),
    );

    expect(urls).toHaveLength(4);
    expect(urls[0].url.toString()).toBe(
      'https://auth.example.com/.well-known/oauth-authorization-server/tenant1',
    );
  });
});

describe('discoverAuthorizationServerMetadata', () => {
  const validOAuthMetadata = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    registration_endpoint: 'https://auth.example.com/register',
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
  };

  const validOpenIdMetadata = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    jwks_uri: 'https://auth.example.com/jwks',
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
  };

  it('returns OAuth metadata when issuer matches path-aware discovery issuer', async () => {
    const tenantMetadata = {
      ...validOAuthMetadata,
      issuer: 'https://auth.example.com/tenant1',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => tenantMetadata,
    });

    const metadata = await discoverAuthorizationServerMetadata(
      'https://auth.example.com/tenant1',
    );

    expect(metadata).toEqual(tenantMetadata);
  });

  it('tries URLs in order and returns first successful metadata', async () => {
    // First OAuth URL fails with 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    // Second OAuth URL (root) succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validOAuthMetadata,
    });

    const metadata = await discoverAuthorizationServerMetadata(
      'https://auth.example.com/tenant1',
    );

    expect(metadata).toEqual(validOAuthMetadata);

    // Verify it tried the URLs in the correct order
    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0].toString()).toBe(
      'https://auth.example.com/.well-known/oauth-authorization-server/tenant1',
    );
    expect(calls[1][0].toString()).toBe(
      'https://auth.example.com/.well-known/oauth-authorization-server',
    );
  });

  it('rejects OAuth metadata when issuer does not match discovery issuer', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ...validOAuthMetadata,
        issuer: 'https://login.real-idp.com',
      }),
    });

    await expect(
      discoverAuthorizationServerMetadata('https://attacker.example/tenantA'),
    ).rejects.toThrow(/does not match expected issuer/);
  });

  it('rejects OIDC metadata when issuer does not match discovery issuer', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ...validOpenIdMetadata,
        issuer: 'https://login.real-idp.com',
      }),
    });

    await expect(
      discoverAuthorizationServerMetadata('https://auth.example.com'),
    ).rejects.toThrow(/does not match expected issuer/);
  });

  it('throws error when OIDC provider does not support S256 PKCE', async () => {
    // OAuth discovery fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    // OpenID Connect discovery succeeds but without S256 support
    const invalidOpenIdMetadata = {
      ...validOpenIdMetadata,
      code_challenge_methods_supported: ['plain'], // Missing S256
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => invalidOpenIdMetadata,
    });

    await expect(
      discoverAuthorizationServerMetadata('https://auth.example.com'),
    ).rejects.toThrow(
      'does not support S256 code challenge method required by MCP specification',
    );
  });

  it('continues on 4xx errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validOpenIdMetadata,
    });

    const metadata = await discoverAuthorizationServerMetadata(
      'https://auth.example.com',
    );

    expect(metadata).toEqual(validOpenIdMetadata);
  });

  it('throws on non-4xx errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(
      discoverAuthorizationServerMetadata('https://mcp.example.com'),
    ).rejects.toThrow('HTTP 500');
  });

  it('handles CORS errors with retry', async () => {
    // First call fails with CORS
    mockFetch.mockImplementationOnce(() =>
      Promise.reject(new TypeError('CORS error')),
    );

    // Retry without headers succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validOAuthMetadata,
    });

    const metadata = await discoverAuthorizationServerMetadata(
      'https://auth.example.com',
    );

    expect(metadata).toEqual(validOAuthMetadata);
    const calls = mockFetch.mock.calls;
    expect(calls.length).toBe(2);

    // First call should have headers
    expect(calls[0][1]?.headers).toHaveProperty('MCP-Protocol-Version');

    // Second call should not have headers (CORS retry)
    expect(calls[1][1]?.headers).toBeUndefined();
  });

  it('supports custom fetch function', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validOAuthMetadata,
    });

    const metadata = await discoverAuthorizationServerMetadata(
      'https://auth.example.com',
      { fetchFn: customFetch },
    );

    expect(metadata).toEqual(validOAuthMetadata);
    expect(customFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('supports custom protocol version', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validOAuthMetadata,
    });

    const metadata = await discoverAuthorizationServerMetadata(
      'https://auth.example.com',
      { protocolVersion: '2025-01-01' },
    );

    expect(metadata).toEqual(validOAuthMetadata);
    const calls = mockFetch.mock.calls;
    const [, options] = calls[0];
    expect(options.headers).toEqual({
      'MCP-Protocol-Version': '2025-01-01',
    });
  });

  it('returns undefined when all URLs fail with CORS errors', async () => {
    // All fetch attempts fail with CORS errors (TypeError)
    mockFetch.mockImplementation(() =>
      Promise.reject(new TypeError('CORS error')),
    );

    const metadata = await discoverAuthorizationServerMetadata(
      'https://auth.example.com/tenant1',
    );

    expect(metadata).toBeUndefined();

    // Verify that all discovery URLs were attempted
    expect(mockFetch).toHaveBeenCalledTimes(8); // 4 URLs × 2 attempts each (with and without headers)
  });
});

describe('startAuthorization', () => {
  const validMetadata = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/auth',
    token_endpoint: 'https://auth.example.com/tkn',
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
  };

  const validClientInfo = {
    client_id: 'client123',
    client_secret: 'secret123',
    redirect_uris: ['http://localhost:3000/callback'],
    client_name: 'Test Client',
  };

  it('generates authorization URL with PKCE challenge', async () => {
    const { authorizationUrl, codeVerifier } = await startAuthorization(
      'https://auth.example.com',
      {
        metadata: undefined,
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
        resource: new URL('https://api.example.com/mcp-server'),
      },
    );

    expect(authorizationUrl.toString()).toMatch(
      /^https:\/\/auth\.example\.com\/authorize\?/,
    );
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('code_challenge')).toBe(
      'test_challenge',
    );
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe(
      'S256',
    );
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/callback',
    );
    expect(authorizationUrl.searchParams.get('resource')).toBe(
      'https://api.example.com/mcp-server',
    );
    expect(codeVerifier).toBe('test_verifier');
  });

  it('includes scope parameter when provided', async () => {
    const { authorizationUrl } = await startAuthorization(
      'https://auth.example.com',
      {
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
        scope: 'read write profile',
      },
    );

    expect(authorizationUrl.searchParams.get('scope')).toBe(
      'read write profile',
    );
  });

  it('excludes scope parameter when not provided', async () => {
    const { authorizationUrl } = await startAuthorization(
      'https://auth.example.com',
      {
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
      },
    );

    expect(authorizationUrl.searchParams.has('scope')).toBe(false);
  });

  it('includes state parameter when provided', async () => {
    const { authorizationUrl } = await startAuthorization(
      'https://auth.example.com',
      {
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
        state: 'foobar',
      },
    );

    expect(authorizationUrl.searchParams.get('state')).toBe('foobar');
  });

  it('excludes state parameter when not provided', async () => {
    const { authorizationUrl } = await startAuthorization(
      'https://auth.example.com',
      {
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
      },
    );

    expect(authorizationUrl.searchParams.has('state')).toBe(false);
  });

  // OpenID Connect requires that the user is prompted for consent if the scope includes 'offline_access'
  it("includes consent prompt parameter if scope includes 'offline_access'", async () => {
    const { authorizationUrl } = await startAuthorization(
      'https://auth.example.com',
      {
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
        scope: 'read write profile offline_access',
      },
    );

    expect(authorizationUrl.searchParams.get('prompt')).toBe('consent');
  });

  it('uses metadata authorization_endpoint when provided', async () => {
    const { authorizationUrl } = await startAuthorization(
      'https://auth.example.com',
      {
        metadata: validMetadata,
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
      },
    );

    expect(authorizationUrl.toString()).toMatch(
      /^https:\/\/auth\.example\.com\/auth\?/,
    );
  });

  it('validates response type support', async () => {
    const metadata = {
      ...validMetadata,
      response_types_supported: ['token'], // Does not support 'code'
    };

    await expect(
      startAuthorization('https://auth.example.com', {
        metadata,
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
      }),
    ).rejects.toThrow(/does not support response type/);
  });

  it('validates PKCE support', async () => {
    const metadata = {
      ...validMetadata,
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['plain'], // Does not support 'S256'
    };

    await expect(
      startAuthorization('https://auth.example.com', {
        metadata,
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
      }),
    ).rejects.toThrow(/does not support code challenge method/);
  });

  it('does not add trailing slash to pathless resource URL', async () => {
    const { authorizationUrl } = await startAuthorization(
      'https://auth.example.com',
      {
        clientInformation: validClientInfo,
        redirectUrl: 'http://localhost:3000/callback',
        resource: new URL('https://mcp.example.com'),
      },
    );

    expect(authorizationUrl.searchParams.get('resource')).toBe(
      'https://mcp.example.com',
    );
  });
});

describe('exchangeAuthorization', () => {
  const validTokens = {
    access_token: 'access123',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'refresh123',
  };

  const validMetadata: AuthorizationServerMetadata = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    response_types_supported: ['code'],
    jwks_uri: 'https://auth.example.com/jwks',
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
  };

  const validClientInfo = {
    client_id: 'client123',
    client_secret: 'secret123',
    redirect_uris: ['http://localhost:3000/callback'],
    client_name: 'Test Client',
  };

  it('exchanges code for tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validTokens,
    });

    const tokens = await exchangeAuthorization('https://auth.example.com', {
      clientInformation: validClientInfo,
      authorizationCode: 'code123',
      codeVerifier: 'verifier123',
      redirectUri: 'http://localhost:3000/callback',
      resource: new URL('https://api.example.com/mcp-server'),
    });

    expect(tokens).toEqual(validTokens);
    const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchUrl.href).toBe('https://auth.example.com/token');
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.headers.get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    );

    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code123');
    expect(body.get('code_verifier')).toBe('verifier123');
    expect(body.get('client_id')).toBe('client123');
    expect(body.get('client_secret')).toBe('secret123');
    expect(body.get('redirect_uri')).toBe('http://localhost:3000/callback');
    expect(body.get('resource')).toBe('https://api.example.com/mcp-server');
  });

  it('exchanges code for tokens with auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validTokens,
    });

    const tokens = await exchangeAuthorization('https://auth.example.com', {
      metadata: validMetadata as AuthorizationServerMetadata,
      clientInformation: validClientInfo,
      authorizationCode: 'code123',
      codeVerifier: 'verifier123',
      redirectUri: 'http://localhost:3000/callback',
      addClientAuthentication: (
        headers: Headers,
        params: URLSearchParams,
        url: string | URL,
        metadata: AuthorizationServerMetadata,
      ) => {
        headers.set(
          'Authorization',
          'Basic ' +
            btoa(
              validClientInfo.client_id + ':' + validClientInfo.client_secret,
            ),
        );
        params.set(
          'example_url',
          typeof url === 'string' ? url : url.toString(),
        );
        params.set('example_metadata', metadata.authorization_endpoint);
        params.set('example_param', 'example_value');
      },
    });

    expect(tokens).toEqual(validTokens);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://auth.example.com/token',
      }),
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const headers = mockFetch.mock.calls[0][1].headers as Headers;
    expect(headers.get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(headers.get('Authorization')).toBe(
      'Basic Y2xpZW50MTIzOnNlY3JldDEyMw==',
    );
    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code123');
    expect(body.get('code_verifier')).toBe('verifier123');
    expect(body.get('client_id')).toBeNull();
    expect(body.get('redirect_uri')).toBe('http://localhost:3000/callback');
    expect(body.get('example_url')).toBe('https://auth.example.com');
    expect(body.get('example_metadata')).toBe(
      'https://auth.example.com/authorize',
    );
    expect(body.get('example_param')).toBe('example_value');
    expect(body.get('client_secret')).toBeNull();
  });

  it('validates token response schema', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        // Missing required fields
        access_token: 'access123',
      }),
    });

    await expect(
      exchangeAuthorization('https://auth.example.com', {
        clientInformation: validClientInfo,
        authorizationCode: 'code123',
        codeVerifier: 'verifier123',
        redirectUri: 'http://localhost:3000/callback',
      }),
    ).rejects.toThrow();
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: ServerError.errorCode,
          error_description: 'Token exchange failed',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      exchangeAuthorization('https://auth.example.com', {
        clientInformation: validClientInfo,
        authorizationCode: 'code123',
        codeVerifier: 'verifier123',
        redirectUri: 'http://localhost:3000/callback',
      }),
    ).rejects.toThrow('Token exchange failed');
  });

  it('supports overriding the fetch function used for requests', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validTokens,
    });

    const tokens = await exchangeAuthorization('https://auth.example.com', {
      clientInformation: validClientInfo,
      authorizationCode: 'code123',
      codeVerifier: 'verifier123',
      redirectUri: 'http://localhost:3000/callback',
      resource: new URL('https://api.example.com/mcp-server'),
      fetchFn: customFetch,
    });

    expect(tokens).toEqual(validTokens);
    expect(customFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();

    const [url, options] = customFetch.mock.calls[0];
    expect(url.toString()).toBe('https://auth.example.com/token');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: expect.any(URLSearchParams),
      }),
    );

    const body = options.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code123');
    expect(body.get('code_verifier')).toBe('verifier123');
    expect(body.get('client_id')).toBe('client123');
    expect(body.get('client_secret')).toBe('secret123');
    expect(body.get('redirect_uri')).toBe('http://localhost:3000/callback');
    expect(body.get('resource')).toBe('https://api.example.com/mcp-server');
  });

  it('does not add trailing slash to pathless resource URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validTokens,
    });

    await exchangeAuthorization('https://auth.example.com', {
      clientInformation: validClientInfo,
      authorizationCode: 'code123',
      codeVerifier: 'verifier123',
      redirectUri: 'http://localhost:3000/callback',
      resource: new URL('https://mcp.example.com'),
    });

    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('resource')).toBe('https://mcp.example.com');
  });

  it('awaits async addClientAuthentication before dispatching token request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validTokens,
    });

    const addClientAuthentication = async (
      _headers: Headers,
      params: URLSearchParams,
    ) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      params.set('client_id', 'set-by-async-provider');
      params.set('client_secret', 'secret-by-async-provider');
    };

    await exchangeAuthorization('https://auth.example.com', {
      metadata: validMetadata as AuthorizationServerMetadata,
      clientInformation: validClientInfo,
      authorizationCode: 'code123',
      codeVerifier: 'verifier123',
      redirectUri: 'http://localhost:3000/callback',
      addClientAuthentication,
    });

    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('client_id')).toBe('set-by-async-provider');
    expect(body.get('client_secret')).toBe('secret-by-async-provider');
  });
});

describe('refreshAuthorization', () => {
  const validTokens = {
    access_token: 'newaccess123',
    token_type: 'Bearer',
    expires_in: 3600,
  };
  const validTokensWithNewRefreshToken = {
    ...validTokens,
    refresh_token: 'newrefresh123',
  };

  const validMetadata = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    response_types_supported: ['code'],
  };

  const validClientInfo = {
    client_id: 'client123',
    client_secret: 'secret123',
    redirect_uris: ['http://localhost:3000/callback'],
    client_name: 'Test Client',
  };

  it('exchanges refresh token for new tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validTokensWithNewRefreshToken,
    });

    const tokens = await refreshAuthorization('https://auth.example.com', {
      clientInformation: validClientInfo,
      refreshToken: 'refresh123',
      resource: new URL('https://api.example.com/mcp-server'),
    });

    expect(tokens).toEqual(validTokensWithNewRefreshToken);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://auth.example.com/token',
      }),
      expect.objectContaining({
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        }),
      }),
    );

    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh123');
    expect(body.get('client_id')).toBe('client123');
    expect(body.get('client_secret')).toBe('secret123');
    expect(body.get('resource')).toBe('https://api.example.com/mcp-server');
  });

  it('exchanges refresh token for new tokens with auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validTokensWithNewRefreshToken,
    });

    const tokens = await refreshAuthorization('https://auth.example.com', {
      metadata: validMetadata as AuthorizationServerMetadata,
      clientInformation: validClientInfo,
      refreshToken: 'refresh123',
      addClientAuthentication: (
        headers: Headers,
        params: URLSearchParams,
        url: string | URL,
        metadata?: AuthorizationServerMetadata,
      ) => {
        headers.set(
          'Authorization',
          'Basic ' +
            btoa(
              validClientInfo.client_id + ':' + validClientInfo.client_secret,
            ),
        );
        params.set(
          'example_url',
          typeof url === 'string' ? url : url.toString(),
        );
        params.set('example_metadata', metadata?.authorization_endpoint ?? '?');
        params.set('example_param', 'example_value');
      },
    });

    expect(tokens).toEqual(validTokensWithNewRefreshToken);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://auth.example.com/token',
      }),
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const headers = mockFetch.mock.calls[0][1].headers as Headers;
    expect(headers.get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(headers.get('Authorization')).toBe(
      'Basic Y2xpZW50MTIzOnNlY3JldDEyMw==',
    );
    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh123');
    expect(body.get('client_id')).toBeNull();
    expect(body.get('example_url')).toBe('https://auth.example.com');
    expect(body.get('example_metadata')).toBe(
      'https://auth.example.com/authorize',
    );
    expect(body.get('example_param')).toBe('example_value');
    expect(body.get('client_secret')).toBeNull();
  });

  it('exchanges refresh token for new tokens and keep existing refresh token if none is returned', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validTokens,
    });

    const refreshToken = 'refresh123';
    const tokens = await refreshAuthorization('https://auth.example.com', {
      clientInformation: validClientInfo,
      refreshToken,
    });

    expect(tokens).toEqual({ refresh_token: refreshToken, ...validTokens });
  });

  it('validates token response schema', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        // Missing required fields
        access_token: 'newaccess123',
      }),
    });

    await expect(
      refreshAuthorization('https://auth.example.com', {
        clientInformation: validClientInfo,
        refreshToken: 'refresh123',
      }),
    ).rejects.toThrow();
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: ServerError.errorCode,
          error_description: 'Token refresh failed',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      refreshAuthorization('https://auth.example.com', {
        clientInformation: validClientInfo,
        refreshToken: 'refresh123',
      }),
    ).rejects.toThrow('Token refresh failed');
  });

  it('does not add trailing slash to pathless resource URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validTokensWithNewRefreshToken,
    });

    await refreshAuthorization('https://auth.example.com', {
      clientInformation: validClientInfo,
      refreshToken: 'refresh123',
      resource: new URL('https://mcp.example.com'),
    });

    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('resource')).toBe('https://mcp.example.com');
  });

  it('awaits async addClientAuthentication before dispatching refresh request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validTokens,
    });

    const addClientAuthentication = async (
      _headers: Headers,
      params: URLSearchParams,
    ) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      params.set('client_id', 'set-by-async-provider');
      params.set('client_secret', 'secret-by-async-provider');
    };

    await refreshAuthorization('https://auth.example.com', {
      metadata: validMetadata as AuthorizationServerMetadata,
      clientInformation: validClientInfo,
      refreshToken: 'refresh123',
      addClientAuthentication,
    });

    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('client_id')).toBe('set-by-async-provider');
    expect(body.get('client_secret')).toBe('secret-by-async-provider');
  });
});

describe('registerClient', () => {
  const validClientMetadata = {
    redirect_uris: ['http://localhost:3000/callback'],
    client_name: 'Test Client',
  };

  const validClientInfo = {
    client_id: 'client123',
    client_secret: 'secret123',
    client_id_issued_at: 1612137600,
    client_secret_expires_at: 1612224000,
    ...validClientMetadata,
  };

  it('registers client and returns client information', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validClientInfo,
    });

    const clientInfo = await registerClient('https://auth.example.com', {
      clientMetadata: validClientMetadata,
    });

    expect(clientInfo).toEqual(validClientInfo);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://auth.example.com/register',
      }),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validClientMetadata),
      }),
    );
  });

  it('validates client information response schema', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        // Missing required fields
        client_secret: 'secret123',
      }),
    });

    await expect(
      registerClient('https://auth.example.com', {
        clientMetadata: validClientMetadata,
      }),
    ).rejects.toThrow();
  });

  it('throws when registration endpoint not available in metadata', async () => {
    const metadata = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      response_types_supported: ['code'],
    };

    await expect(
      registerClient('https://auth.example.com', {
        metadata: metadata as AuthorizationServerMetadata,
        clientMetadata: validClientMetadata,
      }),
    ).rejects.toThrow(/does not support dynamic client registration/);
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: ServerError.errorCode,
          error_description: 'Dynamic client registration failed',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      registerClient('https://auth.example.com', {
        clientMetadata: validClientMetadata,
      }),
    ).rejects.toThrow('Dynamic client registration failed');
  });
});

describe('auth function', () => {
  const mockProvider: OAuthClientProvider = {
    get redirectUrl() {
      return 'http://localhost:3000/callback';
    },
    get clientMetadata() {
      return {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
      };
    },
    clientInformation: vi.fn(),
    tokens: vi.fn(),
    saveTokens: vi.fn(),
    redirectToAuthorization: vi.fn(),
    saveCodeVerifier: vi.fn(),
    codeVerifier: vi.fn(),
    saveAuthorizationServerInformation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to /.well-known/oauth-authorization-server when no protected-resource-metadata', async () => {
    // Setup: First call to protected resource metadata fails (404)
    // Second call to auth server metadata succeeds
    let callCount = 0;
    mockFetch.mockImplementation(url => {
      callCount++;

      const urlString = url.toString();

      if (
        callCount === 1 &&
        urlString.includes('/.well-known/oauth-protected-resource')
      ) {
        // First call - protected resource metadata fails with 404
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      } else if (
        callCount === 2 &&
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        // Second call - auth server metadata succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://resource.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            registration_endpoint: 'https://auth.example.com/register',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      } else if (callCount === 3 && urlString.includes('/register')) {
        // Third call - client registration succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
            client_id_issued_at: 1612137600,
            client_secret_expires_at: 1612224000,
            redirect_uris: ['http://localhost:3000/callback'],
            client_name: 'Test Client',
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${urlString}`));
    });

    // Mock provider methods
    (mockProvider.clientInformation as Mock).mockResolvedValue(undefined);
    (mockProvider.tokens as Mock).mockResolvedValue(undefined);
    mockProvider.saveClientInformation = vi.fn();

    // Call the auth function
    const result = await auth(mockProvider, {
      serverUrl: 'https://resource.example.com',
    });

    // Verify the result
    expect(result).toBe('REDIRECT');

    // Verify the sequence of calls
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // First call should be to protected resource metadata
    expect(mockFetch.mock.calls[0][0].toString()).toBe(
      'https://resource.example.com/.well-known/oauth-protected-resource',
    );

    // Second call should be to oauth metadata
    expect(mockFetch.mock.calls[1][0].toString()).toBe(
      'https://resource.example.com/.well-known/oauth-authorization-server',
    );
  });

  it('passes resource parameter through authorization flow', async () => {
    // Mock successful metadata discovery - need to include protected resource metadata
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();
      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            resource: 'https://api.example.com/mcp-server',
            authorization_servers: ['https://auth.example.com'],
          }),
        });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://auth.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock provider methods for authorization flow
    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'test-client',
      client_secret: 'test-secret',
      authorization_server: 'https://auth.example.com/',
      token_endpoint: 'https://auth.example.com/token',
    });
    (mockProvider.tokens as Mock).mockResolvedValue(undefined);
    (mockProvider.saveCodeVerifier as Mock).mockResolvedValue(undefined);
    (mockProvider.redirectToAuthorization as Mock).mockResolvedValue(undefined);

    // Call auth without authorization code (should trigger redirect)
    const result = await auth(mockProvider, {
      serverUrl: 'https://api.example.com/mcp-server',
    });

    expect(result).toBe('REDIRECT');

    // Verify the authorization URL includes the resource parameter
    expect(mockProvider.redirectToAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.any(URLSearchParams),
      }),
    );

    const redirectCall = (mockProvider.redirectToAuthorization as Mock).mock
      .calls[0];
    const authUrl: URL = redirectCall[0];
    expect(authUrl.searchParams.get('resource')).toBe(
      'https://api.example.com/mcp-server',
    );
  });

  it('includes resource in token exchange when authorization code is provided', async () => {
    // Mock successful metadata discovery and token exchange - need protected resource metadata
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();

      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            resource: 'https://api.example.com/mcp-server',
            authorization_servers: ['https://auth.example.com'],
          }),
        });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://auth.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      } else if (urlString.includes('/token')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'access123',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'refresh123',
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock provider methods for token exchange
    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'test-client',
      client_secret: 'test-secret',
      authorization_server: 'https://auth.example.com/',
      token_endpoint: 'https://auth.example.com/token',
    });
    (mockProvider.codeVerifier as Mock).mockResolvedValue('test-verifier');
    (mockProvider.saveTokens as Mock).mockResolvedValue(undefined);

    // Call auth with authorization code
    const result = await auth(mockProvider, {
      serverUrl: 'https://api.example.com/mcp-server',
      authorizationCode: 'auth-code-123',
    });

    expect(result).toBe('AUTHORIZED');

    // Find the token exchange call
    const tokenCall = mockFetch.mock.calls.find(call =>
      call[0].toString().includes('/token'),
    );
    expect(tokenCall).toBeDefined();

    const body = tokenCall![1].body as URLSearchParams;
    expect(body.get('resource')).toBe('https://api.example.com/mcp-server');
    expect(body.get('code')).toBe('auth-code-123');
  });

  it('includes resource in token refresh', async () => {
    // Mock successful metadata discovery and token refresh - need protected resource metadata
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();

      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            resource: 'https://api.example.com/mcp-server',
            authorization_servers: ['https://auth.example.com'],
          }),
        });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://auth.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      } else if (urlString.includes('/token')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new-access123',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock provider methods for token refresh
    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'test-client',
      client_secret: 'test-secret',
      authorization_server: 'https://api.example.com/mcp-server',
      token_endpoint: 'https://auth.example.com/token',
    });
    (mockProvider.tokens as Mock).mockResolvedValue({
      access_token: 'old-access',
      token_type: 'Bearer',
      refresh_token: 'refresh123',
      authorization_server: 'https://auth.example.com/',
      token_endpoint: 'https://auth.example.com/token',
    });
    (mockProvider.saveTokens as Mock).mockResolvedValue(undefined);

    // Call auth with existing tokens (should trigger refresh)
    const result = await auth(mockProvider, {
      serverUrl: 'https://api.example.com/mcp-server',
    });

    expect(result).toBe('AUTHORIZED');

    // Find the token refresh call
    const tokenCall = mockFetch.mock.calls.find(call =>
      call[0].toString().includes('/token'),
    );
    expect(tokenCall).toBeDefined();

    const body = tokenCall![1].body as URLSearchParams;
    expect(body.get('resource')).toBe('https://api.example.com/mcp-server');
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh123');
  });

  it('rejects cross-origin protected resource metadata URLs before sending stored credentials', async () => {
    const evilTokenRequests: URLSearchParams[] = [];

    mockFetch.mockImplementation((url, init) => {
      const urlString = url.toString();

      if (
        urlString ===
        'https://evil.example/.well-known/oauth-protected-resource'
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            resource: 'https://api.example.com/mcp-server',
            authorization_servers: ['https://evil.example'],
          }),
        });
      } else if (
        urlString ===
        'https://evil.example/.well-known/oauth-authorization-server'
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://evil.example',
            authorization_endpoint: 'https://evil.example/authorize',
            token_endpoint: 'https://evil.example/steal',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      } else if (urlString === 'https://evil.example/steal') {
        evilTokenRequests.push(init?.body as URLSearchParams);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'attacker-token',
            token_type: 'Bearer',
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'real-client',
      client_secret: 'real-secret',
      authorization_server: 'https://auth.example.com/',
      token_endpoint: 'https://auth.example.com/token',
    });
    (mockProvider.tokens as Mock).mockResolvedValue({
      access_token: 'old-access',
      token_type: 'Bearer',
      refresh_token: 'real-refresh-token',
      authorization_server: 'https://auth.example.com/',
      token_endpoint: 'https://auth.example.com/token',
    });

    await expect(
      auth(mockProvider, {
        serverUrl: 'https://api.example.com/mcp-server',
        resourceMetadataUrl: new URL(
          'https://evil.example/.well-known/oauth-protected-resource',
        ),
      }),
    ).rejects.toThrow(/same origin/);

    expect(evilTokenRequests).toHaveLength(0);
  });

  it('rejects changed authorization server metadata before refreshing stored tokens', async () => {
    const evilTokenRequests: URLSearchParams[] = [];

    mockFetch.mockImplementation((url, init) => {
      const urlString = url.toString();

      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            resource: 'https://api.example.com/mcp-server',
            authorization_servers: ['https://evil.example'],
          }),
        });
      } else if (
        urlString ===
        'https://evil.example/.well-known/oauth-authorization-server'
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://evil.example',
            authorization_endpoint: 'https://evil.example/authorize',
            token_endpoint: 'https://evil.example/steal',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      } else if (urlString === 'https://evil.example/steal') {
        evilTokenRequests.push(init?.body as URLSearchParams);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'attacker-token',
            token_type: 'Bearer',
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'real-client',
      client_secret: 'real-secret',
    });
    (mockProvider.tokens as Mock).mockResolvedValue({
      access_token: 'old-access',
      token_type: 'Bearer',
      refresh_token: 'real-refresh-token',
      authorization_server: 'https://auth.example.com/',
      token_endpoint: 'https://auth.example.com/token',
    });

    await expect(
      auth(mockProvider, {
        serverUrl: 'https://api.example.com/mcp-server',
      }),
    ).rejects.toThrow(/does not match/);

    expect(evilTokenRequests).toHaveLength(0);
  });

  it('allows providers to reject discovered authorization server URLs before metadata discovery', async () => {
    const validateAuthorizationServerURL = vi.fn(() => {
      throw new Error('Unexpected authorization server');
    });

    mockFetch.mockImplementation(url => {
      const urlString = url.toString();

      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            resource: 'https://api.example.com/mcp-server',
            authorization_servers: ['https://evil.example'],
          }),
        });
      } else if (
        urlString ===
        'https://evil.example/.well-known/oauth-authorization-server'
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://evil.example',
            authorization_endpoint: 'https://evil.example/authorize',
            token_endpoint: 'https://evil.example/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'real-client',
      client_secret: 'real-secret',
    });
    (mockProvider.tokens as Mock).mockResolvedValue(undefined);
    const providerWithValidation = {
      ...mockProvider,
      validateAuthorizationServerURL,
    };

    await expect(
      auth(providerWithValidation, {
        serverUrl: 'https://api.example.com/mcp-server',
      }),
    ).rejects.toThrow('Unexpected authorization server');

    expect(validateAuthorizationServerURL).toHaveBeenCalledWith(
      'https://api.example.com/mcp-server',
      'https://evil.example',
    );
    expect(
      mockFetch.mock.calls.some(
        call =>
          call[0].toString() ===
          'https://evil.example/.well-known/oauth-authorization-server',
      ),
    ).toBe(false);
  });

  it('skips default PRM resource validation when custom validateResourceURL is provided', async () => {
    const mockValidateResourceURL = vi.fn().mockResolvedValue(undefined);
    const providerWithCustomValidation = {
      ...mockProvider,
      validateResourceURL: mockValidateResourceURL,
    };

    // Mock protected resource metadata with mismatched resource URL
    // This would normally throw an error in default validation, but should be skipped
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();

      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            resource: 'https://different-resource.example.com/mcp-server', // Mismatched resource
            authorization_servers: ['https://auth.example.com'],
          }),
        });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://auth.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock provider methods
    (providerWithCustomValidation.clientInformation as Mock).mockResolvedValue({
      client_id: 'test-client',
      client_secret: 'test-secret',
    });
    (providerWithCustomValidation.tokens as Mock).mockResolvedValue(undefined);
    (providerWithCustomValidation.saveCodeVerifier as Mock).mockResolvedValue(
      undefined,
    );
    (
      providerWithCustomValidation.redirectToAuthorization as Mock
    ).mockResolvedValue(undefined);

    // Call auth - should succeed despite resource mismatch because custom validation overrides default
    const result = await auth(providerWithCustomValidation, {
      serverUrl: 'https://api.example.com/mcp-server',
    });

    expect(result).toBe('REDIRECT');

    // Verify custom validation method was called
    expect(mockValidateResourceURL).toHaveBeenCalledWith(
      new URL('https://api.example.com/mcp-server'),
      'https://different-resource.example.com/mcp-server',
    );
  });

  it('uses prefix of server URL from PRM resource as resource parameter', async () => {
    // Mock successful metadata discovery with resource URL that is a prefix of requested URL
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();

      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            // Resource is a prefix of the requested server URL
            resource: 'https://api.example.com/',
            authorization_servers: ['https://auth.example.com'],
          }),
        });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://auth.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock provider methods
    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'test-client',
      client_secret: 'test-secret',
    });
    (mockProvider.tokens as Mock).mockResolvedValue(undefined);
    (mockProvider.saveCodeVerifier as Mock).mockResolvedValue(undefined);
    (mockProvider.redirectToAuthorization as Mock).mockResolvedValue(undefined);

    // Call auth with a URL that has the resource as prefix
    const result = await auth(mockProvider, {
      serverUrl: 'https://api.example.com/mcp-server/endpoint',
    });

    expect(result).toBe('REDIRECT');

    // Verify the authorization URL includes the resource parameter from PRM
    expect(mockProvider.redirectToAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.any(URLSearchParams),
      }),
    );

    const redirectCall = (mockProvider.redirectToAuthorization as Mock).mock
      .calls[0];
    const authUrl: URL = redirectCall[0];
    // Should use the PRM's resource value, not the full requested URL
    expect(authUrl.searchParams.get('resource')).toBe(
      'https://api.example.com',
    );
  });

  it('excludes resource parameter when Protected Resource Metadata is not present', async () => {
    // Mock metadata discovery where protected resource metadata is not available (404)
    // but authorization server metadata is available
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();

      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        // Protected resource metadata not available
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://api.example.com/mcp-server',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock provider methods
    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'test-client',
      client_secret: 'test-secret',
    });
    (mockProvider.tokens as Mock).mockResolvedValue(undefined);
    (mockProvider.saveCodeVerifier as Mock).mockResolvedValue(undefined);
    (mockProvider.redirectToAuthorization as Mock).mockResolvedValue(undefined);

    // Call auth - should not include resource parameter
    const result = await auth(mockProvider, {
      serverUrl: 'https://api.example.com/mcp-server',
    });

    expect(result).toBe('REDIRECT');

    // Verify the authorization URL does NOT include the resource parameter
    expect(mockProvider.redirectToAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.any(URLSearchParams),
      }),
    );

    const redirectCall = (mockProvider.redirectToAuthorization as Mock).mock
      .calls[0];
    const authUrl: URL = redirectCall[0];
    // Resource parameter should not be present when PRM is not available
    expect(authUrl.searchParams.has('resource')).toBe(false);
  });

  it('excludes resource parameter in token exchange when Protected Resource Metadata is not present', async () => {
    // Mock metadata discovery - no protected resource metadata, but auth server metadata available
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();

      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://api.example.com/mcp-server',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      } else if (urlString.includes('/token')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'access123',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'refresh123',
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock provider methods for token exchange
    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'test-client',
      client_secret: 'test-secret',
      authorization_server: 'https://api.example.com/mcp-server',
      token_endpoint: 'https://auth.example.com/token',
    });
    (mockProvider.codeVerifier as Mock).mockResolvedValue('test-verifier');
    (mockProvider.saveTokens as Mock).mockResolvedValue(undefined);

    // Call auth with authorization code
    const result = await auth(mockProvider, {
      serverUrl: 'https://api.example.com/mcp-server',
      authorizationCode: 'auth-code-123',
    });

    expect(result).toBe('AUTHORIZED');

    // Find the token exchange call
    const tokenCall = mockFetch.mock.calls.find(call =>
      call[0].toString().includes('/token'),
    );
    expect(tokenCall).toBeDefined();

    const body = tokenCall![1].body as URLSearchParams;
    // Resource parameter should not be present when PRM is not available
    expect(body.has('resource')).toBe(false);
    expect(body.get('code')).toBe('auth-code-123');
  });

  it('excludes resource parameter in token refresh when Protected Resource Metadata is not present', async () => {
    // Mock metadata discovery - no protected resource metadata, but auth server metadata available
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();

      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://api.example.com/mcp-server',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      } else if (urlString.includes('/token')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new-access123',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock provider methods for token refresh
    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'test-client',
      client_secret: 'test-secret',
    });
    (mockProvider.tokens as Mock).mockResolvedValue({
      access_token: 'old-access',
      token_type: 'Bearer',
      refresh_token: 'refresh123',
      authorization_server: 'https://api.example.com/mcp-server',
      token_endpoint: 'https://auth.example.com/token',
    });
    (mockProvider.saveTokens as Mock).mockResolvedValue(undefined);

    // Call auth with existing tokens (should trigger refresh)
    const result = await auth(mockProvider, {
      serverUrl: 'https://api.example.com/mcp-server',
    });

    expect(result).toBe('AUTHORIZED');

    // Find the token refresh call
    const tokenCall = mockFetch.mock.calls.find(call =>
      call[0].toString().includes('/token'),
    );
    expect(tokenCall).toBeDefined();

    const body = tokenCall![1].body as URLSearchParams;
    // Resource parameter should not be present when PRM is not available
    expect(body.has('resource')).toBe(false);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh123');
  });

  it('fetches AS metadata with path from serverUrl when PRM returns external AS', async () => {
    // Mock PRM discovery that returns an external AS
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();

      if (
        urlString ===
        'https://my.resource.com/.well-known/oauth-protected-resource/path/name'
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            resource: 'https://my.resource.com/',
            authorization_servers: ['https://auth.example.com/oauth'],
          }),
        });
      } else if (
        urlString ===
        'https://auth.example.com/.well-known/oauth-authorization-server/path/name'
      ) {
        // Path-aware discovery on AS with path from serverUrl
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://resource.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    // Mock provider methods
    (mockProvider.clientInformation as Mock).mockResolvedValue({
      client_id: 'test-client',
      client_secret: 'test-secret',
    });
    (mockProvider.tokens as Mock).mockResolvedValue(undefined);
    (mockProvider.saveCodeVerifier as Mock).mockResolvedValue(undefined);
    (mockProvider.redirectToAuthorization as Mock).mockResolvedValue(undefined);

    // Call auth with serverUrl that has a path
    const result = await auth(mockProvider, {
      serverUrl: 'https://my.resource.com/path/name',
    });

    expect(result).toBe('REDIRECT');

    // Verify the correct URLs were fetched
    const calls = mockFetch.mock.calls;

    // First call should be to PRM
    expect(calls[0][0].toString()).toBe(
      'https://my.resource.com/.well-known/oauth-protected-resource/path/name',
    );

    // Second call should be to AS metadata with the path from authorization server
    expect(calls[1][0].toString()).toBe(
      'https://auth.example.com/.well-known/oauth-authorization-server/oauth',
    );
  });

  it('supports overriding the fetch function used for requests', async () => {
    const customFetch = vi.fn();

    // Mock PRM discovery
    customFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        resource: 'https://resource.example.com',
        authorization_servers: ['https://auth.example.com'],
      }),
    });

    // Mock AS metadata discovery
    customFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        registration_endpoint: 'https://auth.example.com/register',
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256'],
      }),
    });

    const mockProvider: OAuthClientProvider = {
      get redirectUrl() {
        return 'http://localhost:3000/callback';
      },
      get clientMetadata() {
        return {
          client_name: 'Test Client',
          redirect_uris: ['http://localhost:3000/callback'],
        };
      },
      clientInformation: vi.fn().mockResolvedValue({
        client_id: 'client123',
        client_secret: 'secret123',
      }),
      tokens: vi.fn().mockResolvedValue(undefined),
      saveTokens: vi.fn(),
      redirectToAuthorization: vi.fn(),
      saveCodeVerifier: vi.fn(),
      codeVerifier: vi.fn().mockResolvedValue('verifier123'),
      saveAuthorizationServerInformation: vi.fn(),
    };

    const result = await auth(mockProvider, {
      serverUrl: 'https://resource.example.com',
      fetchFn: customFetch,
    });

    expect(result).toBe('REDIRECT');
    expect(customFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).not.toHaveBeenCalled();

    // Verify custom fetch was called for PRM discovery
    expect(customFetch.mock.calls[0][0].toString()).toBe(
      'https://resource.example.com/.well-known/oauth-protected-resource',
    );

    // Verify custom fetch was called for AS metadata discovery
    expect(customFetch.mock.calls[1][0].toString()).toBe(
      'https://auth.example.com/.well-known/oauth-authorization-server',
    );
  });
});

describe('OAuth state validation', () => {
  const validTokens = {
    access_token: 'access123',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'refresh123',
  };

  function createMockProvider(
    overrides?: Partial<OAuthClientProvider>,
  ): OAuthClientProvider {
    return {
      get redirectUrl() {
        return 'http://localhost:3000/callback';
      },
      get clientMetadata() {
        return {
          redirect_uris: ['http://localhost:3000/callback'],
          client_name: 'Test Client',
        };
      },
      clientInformation: vi.fn().mockResolvedValue({
        client_id: 'test-client',
        client_secret: 'test-secret',
        authorization_server: 'https://resource.example.com/',
        token_endpoint: 'https://auth.example.com/token',
      }),
      tokens: vi.fn().mockResolvedValue(undefined),
      saveTokens: vi.fn(),
      redirectToAuthorization: vi.fn(),
      saveCodeVerifier: vi.fn(),
      codeVerifier: vi.fn().mockResolvedValue('test-verifier'),
      saveAuthorizationServerInformation: vi.fn(),
      ...overrides,
    };
  }

  function mockMetadataAndTokenFetch() {
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();
      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({ ok: false, status: 404 });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://resource.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      } else if (urlString.includes('/token')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => validTokens,
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  }

  function mockMetadataWithRegistration() {
    mockFetch.mockImplementation(url => {
      const urlString = url.toString();
      if (urlString.includes('/.well-known/oauth-protected-resource')) {
        return Promise.resolve({ ok: false, status: 404 });
      } else if (
        urlString.includes('/.well-known/oauth-authorization-server')
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            issuer: 'https://resource.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            registration_endpoint: 'https://auth.example.com/register',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
          }),
        });
      } else if (urlString.includes('/register')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            client_id: 'new-client',
            client_secret: 'new-secret',
            client_id_issued_at: 1612137600,
            client_secret_expires_at: 1612224000,
            redirect_uris: ['http://localhost:3000/callback'],
            client_name: 'Test Client',
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  }

  it('should reject token exchange when callback state does not match stored state', async () => {
    mockMetadataAndTokenFetch();

    const provider = createMockProvider({
      state: vi.fn().mockResolvedValue('LEGITIMATE_STATE'),
      saveState: vi.fn(),
      storedState: vi.fn().mockResolvedValue('LEGITIMATE_STATE'),
    });

    await expect(
      auth(provider, {
        serverUrl: 'https://resource.example.com',
        authorizationCode: 'auth-code-from-attacker-flow',
        callbackState: 'ATTACKER_STATE',
      }),
    ).rejects.toThrow(/state/i);

    expect(provider.saveTokens).not.toHaveBeenCalled();
  });

  it('should allow token exchange when callback state matches stored state', async () => {
    mockMetadataAndTokenFetch();

    const provider = createMockProvider({
      state: vi.fn().mockResolvedValue('CORRECT_STATE'),
      saveState: vi.fn(),
      storedState: vi.fn().mockResolvedValue('CORRECT_STATE'),
    });

    const result = await auth(provider, {
      serverUrl: 'https://resource.example.com',
      authorizationCode: 'valid-auth-code',
      callbackState: 'CORRECT_STATE',
    });

    expect(result).toBe('AUTHORIZED');
    expect(provider.saveTokens).toHaveBeenCalledWith({
      ...validTokens,
      authorization_server: 'https://resource.example.com/',
      token_endpoint: 'https://auth.example.com/token',
    });
  });

  it('should save state when starting a new authorization flow', async () => {
    mockMetadataWithRegistration();

    const saveState = vi.fn();
    const provider = createMockProvider({
      clientInformation: vi.fn().mockResolvedValue(undefined),
      saveClientInformation: vi.fn(),
      state: vi.fn().mockResolvedValue('MY_STATE_VALUE'),
      saveState,
    });

    const result = await auth(provider, {
      serverUrl: 'https://resource.example.com',
    });

    expect(result).toBe('REDIRECT');
    expect(saveState).toHaveBeenCalledWith('MY_STATE_VALUE');
  });
});
