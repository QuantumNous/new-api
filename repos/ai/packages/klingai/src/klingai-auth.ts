import { loadSetting } from '@ai-sdk/provider-utils';

/**
 * Encode a string to base64url format (URL-safe base64 without padding).
 */
const base64url = (str: string) =>
  btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

/**
 * Generate a JWT authentication token for KlingAI API access.
 *
 * Uses HS256 (HMAC-SHA256) signing via the Web Crypto API — no external
 * dependencies required. Compatible with Node.js, Edge, and browser runtimes.
 *
 * @see https://app.klingai.com/global/dev/document-api/quickStart/userManual
 * @see https://app.klingai.com/global/dev/document-api/apiReference/commonInfo
 */
export async function generateKlingAIAuthToken({
  accessKey,
  secretKey,
}: {
  accessKey?: string;
  secretKey?: string;
}): Promise<string> {
  const ak = loadSetting({
    settingValue: accessKey,
    settingName: 'accessKey',
    environmentVariableName: 'KLINGAI_ACCESS_KEY',
    description: 'KlingAI access key',
  });

  const sk = loadSetting({
    settingValue: secretKey,
    settingName: 'secretKey',
    environmentVariableName: 'KLINGAI_SECRET_KEY',
    description: 'KlingAI secret key',
  });

  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: ak,
    exp: now + 1800, // Valid for 30 minutes
    nbf: now - 5, // Valid 5 seconds before current time
  };

  const encoder = new TextEncoder();

  // Import the secret key for HMAC-SHA256 signing
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sk),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload),
  )}`;

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput),
  );

  const signatureBytes = new Uint8Array(signature);
  const signatureBase64 = base64url(
    String.fromCharCode.apply(null, Array.from(signatureBytes)),
  );

  return `${signingInput}.${signatureBase64}`;
}
