import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import type { MCPAppResource } from './mcp-apps';

const encoder = new TextEncoder();

// canonicalJSON/toBase64url/the digest below mirror
// packages/ai/src/util/canonical-hash.ts, which `@ai-sdk/mcp` can't import
// (wrong dependency direction, not exported). Keep them identical; if a third
// consumer appears, hoist into @ai-sdk/provider-utils instead.

/**
 * Deterministic JSON serialization: object keys are sorted so two
 * structurally-equal values always produce the same string regardless of key
 * insertion order. Used as the stable input to content hashing.
 */
function canonicalJSON(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSON).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJSON(record[k])}`);
  return `{${entries.join(',')}}`;
}

function toBase64url(bytes: Uint8Array): string {
  return convertUint8ArrayToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Stable SHA-256 digest (base64url) over an MCP App resource's `html`, `csp`,
 * and `permissions`.
 *
 * Capture a baseline on first load and compare later reads with
 * {@link detectMCPAppResourceDrift} to detect a changed resource. Baseline
 * storage and the response are the host's concern, mirroring `fingerprintTools`.
 */
export async function fingerprintMCPAppResource(
  resource: MCPAppResource,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(
      canonicalJSON({
        html: resource.html,
        csp: resource.meta?.csp ?? null,
        permissions: resource.meta?.permissions ?? null,
      }),
    ),
  );
  return toBase64url(new Uint8Array(digest));
}

/**
 * Compares two fingerprints from {@link fingerprintMCPAppResource}. Returns
 * `true` when the current resource differs from its baseline.
 */
export function detectMCPAppResourceDrift(
  current: string,
  baseline: string,
): boolean {
  return current !== baseline;
}
