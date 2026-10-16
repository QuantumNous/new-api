/**
 * Returns true when `url` has the same origin (scheme + host + port) as
 * `baseUrl`.
 *
 * Used to decide whether provider credentials may be attached to a request to a
 * URL taken from a provider response (e.g. a polling or media-download URL).
 * Credentials must only be sent to the provider's own origin; a response that
 * names a foreign host (a CDN, or an attacker-controlled host if the response
 * is tampered with) must not receive the API key.
 *
 * Returns false if either value is not a valid absolute URL (fail-closed).
 */
export function isSameOrigin(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}
