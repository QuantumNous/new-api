import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKlingAIAuthToken } from './klingai-auth';

describe('generateKlingAIAuthToken', () => {
  beforeEach(() => {
    vi.stubEnv('KLINGAI_ACCESS_KEY', undefined as unknown as string);
    vi.stubEnv('KLINGAI_SECRET_KEY', undefined as unknown as string);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should generate a valid JWT token structure', async () => {
    const token = await generateKlingAIAuthToken({
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
    });

    // JWT should have 3 parts separated by dots
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  it('should include correct header with HS256 algorithm', async () => {
    const token = await generateKlingAIAuthToken({
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
    });

    const [headerPart] = token.split('.');
    // Decode base64url to get header JSON
    const header = JSON.parse(
      atob(headerPart.replace(/-/g, '+').replace(/_/g, '/')),
    );

    expect(header).toStrictEqual({
      alg: 'HS256',
      typ: 'JWT',
    });
  });

  it('should include issuer (iss) matching the access key', async () => {
    const token = await generateKlingAIAuthToken({
      accessKey: 'my-access-key-123',
      secretKey: 'my-secret-key',
    });

    const [, payloadPart] = token.split('.');
    const payload = JSON.parse(
      atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')),
    );

    expect(payload.iss).toBe('my-access-key-123');
  });

  it('should include exp and nbf claims', async () => {
    const token = await generateKlingAIAuthToken({
      accessKey: 'test-ak',
      secretKey: 'test-sk',
    });

    const [, payloadPart] = token.split('.');
    const payload = JSON.parse(
      atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')),
    );

    expect(payload.exp).toBeDefined();
    expect(payload.nbf).toBeDefined();
    // exp should be approximately 30 minutes from now
    expect(payload.exp - payload.nbf).toBeGreaterThan(1800 - 10);
    expect(payload.exp - payload.nbf).toBeLessThan(1800 + 10);
  });

  it('should load access key from environment variable', async () => {
    vi.stubEnv('KLINGAI_ACCESS_KEY', 'env-access-key');

    const token = await generateKlingAIAuthToken({
      secretKey: 'test-sk',
    });

    const [, payloadPart] = token.split('.');
    const payload = JSON.parse(
      atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')),
    );

    expect(payload.iss).toBe('env-access-key');
  });

  it('should prefer explicit accessKey over environment variable', async () => {
    vi.stubEnv('KLINGAI_ACCESS_KEY', 'env-access-key');

    const token = await generateKlingAIAuthToken({
      accessKey: 'explicit-access-key',
      secretKey: 'test-sk',
    });

    const [, payloadPart] = token.split('.');
    const payload = JSON.parse(
      atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')),
    );

    expect(payload.iss).toBe('explicit-access-key');
  });

  it('should throw when access key is not available', async () => {
    await expect(
      generateKlingAIAuthToken({
        secretKey: 'test-sk',
      }),
    ).rejects.toThrow('KlingAI access key');
  });

  it('should throw when secret key is not available', async () => {
    await expect(
      generateKlingAIAuthToken({
        accessKey: 'test-ak',
      }),
    ).rejects.toThrow('KlingAI secret key');
  });

  it('should produce different tokens for different secret keys', async () => {
    const token1 = await generateKlingAIAuthToken({
      accessKey: 'same-ak',
      secretKey: 'secret-key-1',
    });

    const token2 = await generateKlingAIAuthToken({
      accessKey: 'same-ak',
      secretKey: 'secret-key-2',
    });

    // Signatures should differ
    const sig1 = token1.split('.')[2];
    const sig2 = token2.split('.')[2];
    expect(sig1).not.toBe(sig2);
  });
});
