import type { MCPAppResourceCSP } from '@ai-sdk/mcp';

/**
 * Default sandbox permissions for the outer sandbox proxy iframe.
 */
export const MCP_APP_DEFAULT_OUTER_SANDBOX =
  'allow-scripts allow-same-origin allow-forms';

/**
 * Default sandbox permissions for the inner iframe that runs app HTML.
 */
export const MCP_APP_DEFAULT_INNER_SANDBOX = 'allow-scripts allow-forms';

/**
 * Converts MCP App CSP metadata into a Content-Security-Policy string.
 *
 * The returned value is meant to be passed to a sandbox proxy, which can apply
 * it to the inner iframe document.
 *
 * @example
 * ```ts
 * const csp = getMCPAppCSP({
 *   connectDomains: ['https://api.example.com'],
 *   resourceDomains: ['https://cdn.example.com'],
 * });
 * ```
 */
export function getMCPAppCSP(csp?: MCPAppResourceCSP): string | undefined {
  if (csp == null) {
    return undefined;
  }

  const connectSrc = ["'self'", ...(csp.connectDomains ?? [])];
  const imgSrc = ["'self'", 'data:', ...(csp.resourceDomains ?? [])];
  const frameSrc = ["'self'", ...(csp.frameDomains ?? [])];

  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    `connect-src ${connectSrc.join(' ')}`,
    `img-src ${imgSrc.join(' ')}`,
    `font-src ${imgSrc.join(' ')}`,
    `frame-src ${frameSrc.join(' ')}`,
  ].join('; ');
}

/**
 * Converts MCP App permission metadata into an iframe `allow` attribute.
 *
 * @example
 * ```ts
 * const allow = getMCPAppAllowAttribute({
 *   microphone: {},
 *   clipboardWrite: {},
 * });
 * // "microphone; clipboard-write"
 * ```
 */
export function getMCPAppAllowAttribute(
  permissions?: Record<string, unknown>,
): string | undefined {
  if (permissions == null) {
    return undefined;
  }

  const allow = [];
  if (permissions.camera) allow.push('camera');
  if (permissions.microphone) allow.push('microphone');
  if (permissions.geolocation) allow.push('geolocation');
  if (permissions.clipboardWrite) allow.push('clipboard-write');

  return allow.length > 0 ? allow.join('; ') : undefined;
}
