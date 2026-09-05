import { convertBase64ToUint8Array } from '@ai-sdk/provider-utils';
import { hashCanonical, toBase64url } from '../util/canonical-hash';

const encoder = new TextEncoder();

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
  const inputDigest = await hashCanonical(input);
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
  const inputDigest = await hashCanonical(input);
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
