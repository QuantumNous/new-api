import { GoogleAuth, type GoogleAuthOptions } from 'google-auth-library';

export function createAuthTokenGenerator(options?: GoogleAuthOptions) {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    ...options,
  });

  return async function generateAuthToken() {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token?.token ?? null;
  };
}
