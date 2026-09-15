/**
 * Request headers stripped before fetching an untrusted URL: host/virtual-host
 * routing, proxy/origin spoofing, cloud-metadata, cookies, and hop-by-hop
 * transport headers (RFC 7230 §6.1).
 *
 * `Authorization` and other credential-bearing caller headers (e.g. `x-key`)
 * are intentionally not listed — they're needed on the first hop of some
 * provider polling calls. Instead, all caller headers except the user-agent are
 * dropped on a cross-origin redirect (see `fetch-with-validated-redirects`).
 */
const BLOCKED_REQUEST_HEADERS: readonly string[] = [
  // Hop-by-hop / transport (RFC 7230 §6.1)
  'connection',
  'keep-alive',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',

  // Host / virtual-host routing
  'host',

  // Proxy / origin spoofing
  'forwarded',
  'proxy-authorization',
  'via',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',

  // Cloud metadata (GCP, AWS IMDSv1/v2, Azure, Alibaba, DigitalOcean)
  'metadata',
  'metadata-flavor',
  'x-aws-ec2-metadata-token',
  'x-metadata-token',

  // Session / cookie
  'cookie',
  'set-cookie',
];

/**
 * Returns a fresh `Headers` built from `input` with {@link BLOCKED_REQUEST_HEADERS}
 * removed. The input is never mutated.
 */
export function sanitizeRequestHeaders(input: HeadersInit): Headers {
  const headers = new Headers(input);
  for (const name of BLOCKED_REQUEST_HEADERS) {
    headers.delete(name);
  }
  return headers;
}
