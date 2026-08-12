/**
 * Shared WebSocket subprotocol contract for AI Gateway realtime auth.
 *
 * The browser `WebSocket` API cannot set request headers, so the Gateway auth
 * (bearer) token is carried through the `Sec-WebSocket-Protocol` handshake
 * instead of an `Authorization` header — the same workaround OpenAI uses for
 * `openai-insecure-api-key.<token>`.
 *
 * This module is the single source of truth for that contract so the client and
 * the Gateway server can't drift: the client encodes values with
 * `getGatewayRealtimeProtocols`, and the Gateway server decodes them with
 * `getGatewayRealtimeAuthToken` / `getGatewayRealtimeTeamIdOrSlug`.
 *
 * WebSocket subprotocol values must fit the RFC token grammar. The auth token is
 * sent as-is, so callers must use tokens that are valid subprotocol tokens; the
 * optional team scope is base64url-encoded by this module. Keep the complete
 * `Sec-WebSocket-Protocol` header compact (target under an 8 KiB safe header
 * budget) because intermediaries may reject large upgrade headers.
 */

/**
 * Marker subprotocol offered on every handshake so the Gateway can echo a
 * negotiated subprotocol on the 101 response (some clients require the server to
 * select one of the offered subprotocols).
 */
export const GATEWAY_REALTIME_SUBPROTOCOL = 'ai-gateway-realtime.v1';

/** Subprotocol prefix that carries the Gateway auth (bearer) token. */
export const GATEWAY_AUTH_SUBPROTOCOL_PREFIX = 'ai-gateway-auth.';

/** Subprotocol prefix that carries optional Vercel team scoping. */
export const GATEWAY_TEAM_SUBPROTOCOL_PREFIX = 'ai-gateway-team.';

/**
 * Client-side: build the WebSocket subprotocols that carry `token` to the
 * Gateway. Pass the result as the second argument to `new WebSocket(url, ...)`.
 */
export function getGatewayRealtimeProtocols(
  token: string,
  options?: { teamIdOrSlug?: string },
): string[] {
  const protocols = [
    GATEWAY_REALTIME_SUBPROTOCOL,
    `${GATEWAY_AUTH_SUBPROTOCOL_PREFIX}${token}`,
  ];

  if (options?.teamIdOrSlug) {
    protocols.push(
      `${GATEWAY_TEAM_SUBPROTOCOL_PREFIX}${encodeSubprotocolValue(options.teamIdOrSlug)}`,
    );
  }

  return protocols;
}

/**
 * Server-side: extract the Gateway auth (bearer) token from a
 * `Sec-WebSocket-Protocol` header value, or `undefined` when it is absent or
 * empty. The Gateway upgrade handler turns this into an
 * `Authorization: Bearer <token>` before its normal auth path.
 *
 * Accepts the raw header value (subprotocols are comma-separated and may carry
 * surrounding whitespace).
 */
export function getGatewayRealtimeAuthToken(
  secWebSocketProtocol: string | null | undefined,
): string | undefined {
  // `findProtocol` trims the protocol, so the sliced token needs no further
  // trimming; `|| undefined` collapses the empty-token case.
  return (
    findProtocol(secWebSocketProtocol, GATEWAY_AUTH_SUBPROTOCOL_PREFIX)?.slice(
      GATEWAY_AUTH_SUBPROTOCOL_PREFIX.length,
    ) || undefined
  );
}

/**
 * Server-side: extract the optional Vercel team ID or slug from the
 * `Sec-WebSocket-Protocol` header value. Team scoping is base64url-encoded so
 * arbitrary team slugs stay within the WebSocket subprotocol token grammar.
 */
export function getGatewayRealtimeTeamIdOrSlug(
  secWebSocketProtocol: string | null | undefined,
): string | undefined {
  const encoded = findProtocol(
    secWebSocketProtocol,
    GATEWAY_TEAM_SUBPROTOCOL_PREFIX,
  )?.slice(GATEWAY_TEAM_SUBPROTOCOL_PREFIX.length);
  if (!encoded) return undefined;

  try {
    return decodeSubprotocolValue(encoded) || undefined;
  } catch {
    return undefined;
  }
}

function findProtocol(
  secWebSocketProtocol: string | null | undefined,
  prefix: string,
): string | undefined {
  return secWebSocketProtocol
    ?.split(',')
    .map(protocol => protocol.trim())
    .find(protocol => protocol.startsWith(prefix));
}

function encodeSubprotocolValue(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function decodeSubprotocolValue(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(`${base64}${padding}`);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
