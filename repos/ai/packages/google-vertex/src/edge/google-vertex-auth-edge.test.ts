import {
  generateAuthToken,
  type GoogleCredentials,
} from './google-vertex-auth-edge';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// Mock provider-utils to control runtime environment detection
vi.mock('@ai-sdk/provider-utils', async () => {
  const actual = await vi.importActual('@ai-sdk/provider-utils');
  return {
    ...actual,
    getRuntimeEnvironmentUserAgent: vi.fn(() => 'runtime/testenv'),
    withUserAgentSuffix: actual.withUserAgentSuffix,
  };
});

vi.mock('../version', () => ({
  VERSION: '0.0.0-test',
}));

describe('Google Vertex Edge Auth', () => {
  const mockCredentials: GoogleCredentials = {
    clientEmail: 'test@test.iam.gserviceaccount.com',
    privateKey: 'mock-private-key',
    privateKeyId: 'test-key-id',
  };

  const setupAtobStub = (credentials: typeof mockCredentials) => {
    vi.stubGlobal(
      'atob',
      vi.fn().mockImplementation(str => {
        const payload = {
          alg: 'RS256',
          typ: 'JWT',
          iss: credentials.clientEmail,
          scope: 'https://www.googleapis.com/auth/cloud-platform',
          aud: 'https://oauth2.googleapis.com/token',
          iat: 1616161616,
          exp: 1616165216,
        };

        if (credentials.privateKeyId) {
          Object.assign(payload, { kid: credentials.privateKeyId });
        }

        return JSON.stringify(payload);
      }),
    );
  };

  beforeEach(() => {
    // Mock WebCrypto
    const mockSubtleCrypto = {
      importKey: vi.fn().mockResolvedValue('mock-crypto-key'),
      sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };

    const mockCrypto = {
      subtle: mockSubtleCrypto,
    };

    // Use vi.stubGlobal instead of direct assignment
    vi.stubGlobal('crypto', mockCrypto);

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'mock.jwt.token' }),
    });

    setupAtobStub(mockCredentials);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should generate a valid JWT token', async () => {
    // Mock successful token exchange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token:
            'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRlc3Qta2V5LWlkIn0.eyJpc3MiOiJ0ZXN0QHRlc3QuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLCJzY29wZSI6Imh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL2F1dGgvY2xvdWQtcGxhdGZvcm0iLCJhdWQiOiJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsImlhdCI6MTYxNjE2MTYxNiwiZXhwIjoxNjE2MTY1MjE2fQ.signature',
        }),
    });

    const token = await generateAuthToken(mockCredentials);

    // JWT structure validation
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    // Header validation
    const header = JSON.parse(atob(parts[0]));
    expect(header).toMatchObject({
      alg: 'RS256',
      typ: 'JWT',
      kid: mockCredentials.privateKeyId,
      iss: mockCredentials.clientEmail,
    });

    // Payload validation
    const payload = JSON.parse(atob(parts[1]));
    expect(payload).toHaveProperty('iss', mockCredentials.clientEmail);
    expect(payload).toHaveProperty(
      'scope',
      'https://www.googleapis.com/auth/cloud-platform',
    );
    expect(payload).toHaveProperty(
      'aud',
      'https://oauth2.googleapis.com/token',
    );
    expect(payload).toHaveProperty('iat');
    expect(payload).toHaveProperty('exp');

    // Verify exp is ~1 hour after iat
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it('should throw error with invalid credentials', async () => {
    // Mock failed token exchange
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    });

    const invalidCredentials = {
      ...mockCredentials,
      private_key: 'invalid-key',
    };

    await expect(generateAuthToken(invalidCredentials)).rejects.toThrow(
      'Token request failed: Bad Request',
    );
  });

  it('should load credentials from environment variables', async () => {
    process.env.GOOGLE_CLIENT_EMAIL = mockCredentials.clientEmail;
    process.env.GOOGLE_PRIVATE_KEY = mockCredentials.privateKey;
    process.env.GOOGLE_PRIVATE_KEY_ID = mockCredentials.privateKeyId;

    // Mock successful token exchange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'mock.jwt.token' }),
    });

    const token = await generateAuthToken();
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);

    // Clean up
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_PRIVATE_KEY_ID;
  });

  it('should throw error when client email is missing', async () => {
    delete process.env.GOOGLE_CLIENT_EMAIL;
    process.env.GOOGLE_PRIVATE_KEY = mockCredentials.privateKey;
    process.env.GOOGLE_PRIVATE_KEY_ID = mockCredentials.privateKeyId;

    await expect(generateAuthToken()).rejects.toThrow(
      "Google client email setting is missing. Pass it using the 'clientEmail' parameter or the GOOGLE_CLIENT_EMAIL environment variable.",
    );

    // Clean up
    delete process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_PRIVATE_KEY_ID;
  });

  it('should throw error when private key is missing', async () => {
    process.env.GOOGLE_CLIENT_EMAIL = mockCredentials.clientEmail;
    delete process.env.GOOGLE_PRIVATE_KEY;
    process.env.GOOGLE_PRIVATE_KEY_ID = mockCredentials.privateKeyId;

    await expect(generateAuthToken()).rejects.toThrow(
      "Google private key setting is missing. Pass it using the 'privateKey' parameter or the GOOGLE_PRIVATE_KEY environment variable.",
    );

    // Clean up
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY_ID;
  });

  it('should work with or without private key ID', async () => {
    // Test with private key ID
    process.env.GOOGLE_CLIENT_EMAIL = mockCredentials.clientEmail;
    process.env.GOOGLE_PRIVATE_KEY = mockCredentials.privateKey;
    process.env.GOOGLE_PRIVATE_KEY_ID = mockCredentials.privateKeyId;

    // Mock successful token exchange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'mock.jwt.token' }),
    });

    const tokenWithKeyId = await generateAuthToken();
    expect(tokenWithKeyId).toBeTruthy();

    // Test without private key ID
    delete process.env.GOOGLE_PRIVATE_KEY_ID;

    const tokenWithoutKeyId = await generateAuthToken();
    expect(tokenWithoutKeyId).toBeTruthy();

    // Clean up
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
  });

  it('should handle newlines in private key from env vars', async () => {
    process.env.GOOGLE_CLIENT_EMAIL = mockCredentials.clientEmail;
    process.env.GOOGLE_PRIVATE_KEY = mockCredentials.privateKey.replace(
      /\n/g,
      '\\n',
    );
    process.env.GOOGLE_PRIVATE_KEY_ID = mockCredentials.privateKeyId;

    // Mock successful token exchange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'mock.jwt.token' }),
    });

    const token = await generateAuthToken();
    expect(token).toBeTruthy();

    // Clean up
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_PRIVATE_KEY_ID;
  });

  it('should throw error on fetch failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(generateAuthToken(mockCredentials)).rejects.toThrow(
      'Network error',
    );

    consoleSpy.mockRestore();
  });

  it('should throw error when token request fails', async () => {
    // Mock a failed response from the token endpoint
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      status: 401,
      json: () => Promise.resolve({ error: 'unauthorized' }),
    });

    await expect(generateAuthToken(mockCredentials)).rejects.toThrow(
      'Token request failed: Unauthorized',
    );
  });

  it('should work without privateKeyId', async () => {
    const credentialsWithoutKeyId = {
      clientEmail: mockCredentials.clientEmail,
      privateKey: mockCredentials.privateKey,
    };
    setupAtobStub(credentialsWithoutKeyId);

    // Mock successful token exchange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'mock.jwt.token' }),
    });

    const token = await generateAuthToken(credentialsWithoutKeyId);
    expect(token).toBeTruthy();

    // Verify the JWT structure
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    // Verify header doesn't include kid when privateKeyId is not provided
    const header = JSON.parse(atob(parts[0]));
    expect(header).not.toHaveProperty('kid');
  });

  it('should include correct user-agent header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'mock.jwt.token' }),
    });
    global.fetch = mockFetch;

    await generateAuthToken(mockCredentials);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        headers: expect.objectContaining({
          'user-agent': 'ai-sdk/google-vertex/0.0.0-test runtime/testenv',
        }),
      }),
    );
  });
});
