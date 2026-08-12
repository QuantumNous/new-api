import {
  convertBase64ToUint8Array,
  convertUint8ArrayToBase64,
} from '@ai-sdk/provider-utils';

const encoder = new TextEncoder();

function canonicalJSON(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSON).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    k =>
      `${JSON.stringify(k)}:${canonicalJSON((value as Record<string, unknown>)[k])}`,
  );
  return `{${entries.join(',')}}`;
}

function toBase64url(bytes: Uint8Array): string {
  return convertUint8ArrayToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64url(str: string): Uint8Array {
  return convertBase64ToUint8Array(str);
}

async function importKey(secret: string | Uint8Array): Promise<CryptoKey> {
  const keyData = typeof secret === 'string' ? encoder.encode(secret) : secret;
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function hashInput(input: unknown): Promise<string> {
  const canonical = canonicalJSON(input);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(canonical),
  );
  return toBase64url(new Uint8Array(digest));
}

function buildPayload(
  approvalId: string,
  toolCallId: string,
  toolName: string,
  inputDigest: string,
): Uint8Array {
  return encoder.encode(
    `${approvalId}\n${toolCallId}\n${toolName}\n${inputDigest}`,
  );
}

export async function signToolApproval({
  secret,
  approvalId,
  toolCallId,
  toolName,
  input,
}: {
  secret: string | Uint8Array;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}): Promise<string> {
  const key = await importKey(secret);
  const inputDigest = await hashInput(input);
  const payload = buildPayload(approvalId, toolCallId, toolName, inputDigest);
  const sig = await crypto.subtle.sign('HMAC', key, payload);
  return toBase64url(new Uint8Array(sig));
}

export async function verifyToolApprovalSignature({
  secret,
  signature,
  approvalId,
  toolCallId,
  toolName,
  input,
}: {
  secret: string | Uint8Array;
  signature: string;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}): Promise<boolean> {
  const key = await importKey(secret);
  const inputDigest = await hashInput(input);
  const payload = buildPayload(approvalId, toolCallId, toolName, inputDigest);
  const sigBytes = fromBase64url(signature);
  return crypto.subtle.verify('HMAC', key, sigBytes, payload);
}

export async function maybeSignApproval({
  secret,
  approvalId,
  toolCallId,
  toolName,
  input,
}: {
  secret: string | Uint8Array | undefined;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}): Promise<string | undefined> {
  if (secret == null) return undefined;
  return signToolApproval({ secret, approvalId, toolCallId, toolName, input });
}
