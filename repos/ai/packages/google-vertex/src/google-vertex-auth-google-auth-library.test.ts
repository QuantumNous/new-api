import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthTokenGenerator } from './google-vertex-auth-google-auth-library';
import { GoogleAuth } from 'google-auth-library';

const getAccessToken = vi.fn().mockResolvedValue({ token: 'mocked-token' });
const getClient = vi.fn().mockResolvedValue({ getAccessToken });

vi.mock('google-auth-library', () => {
  return {
    GoogleAuth: vi.fn(function () {
      return {
        getClient,
      };
    }),
  };
});

describe('createAuthTokenGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccessToken.mockResolvedValue({ token: 'mocked-token' });
  });

  it('should generate a valid auth token', async () => {
    const generateAuthToken = createAuthTokenGenerator();

    const token = await generateAuthToken();

    expect(token).toBe('mocked-token');
  });

  it('should return null if no token is received', async () => {
    getAccessToken.mockResolvedValueOnce({ token: null });

    const generateAuthToken = createAuthTokenGenerator();
    const token = await generateAuthToken();

    expect(token).toBeNull();
  });

  it('should create a new auth instance with provided options', () => {
    createAuthTokenGenerator({ keyFile: 'test-key.json' });

    expect(GoogleAuth).toHaveBeenCalledWith({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      keyFile: 'test-key.json',
    });
  });

  it('should create only one GoogleAuth instance for repeated calls', async () => {
    const generateAuthToken = createAuthTokenGenerator();

    await generateAuthToken();
    await generateAuthToken();

    expect(GoogleAuth).toHaveBeenCalledTimes(1);
  });

  it('should create independent generators for separate option sets', async () => {
    const generateFirstAuthToken = createAuthTokenGenerator({
      keyFile: 'first-key.json',
    });
    const generateSecondAuthToken = createAuthTokenGenerator({
      keyFile: 'second-key.json',
    });

    await generateFirstAuthToken();
    await generateSecondAuthToken();

    expect(GoogleAuth).toHaveBeenCalledTimes(2);
    expect(GoogleAuth).toHaveBeenNthCalledWith(1, {
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      keyFile: 'first-key.json',
    });
    expect(GoogleAuth).toHaveBeenNthCalledWith(2, {
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      keyFile: 'second-key.json',
    });
  });
});
