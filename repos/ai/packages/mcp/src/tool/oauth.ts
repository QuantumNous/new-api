import pkceChallenge from 'pkce-challenge';
import {
  OAuthProtectedResourceMetadataSchema,
  OAuthMetadataSchema,
  OpenIdProviderDiscoveryMetadataSchema,
  OAuthTokensSchema,
  OAuthErrorResponseSchema,
  OAuthClientInformationFullSchema,
  type OAuthTokens,
  type OAuthProtectedResourceMetadata,
  type AuthorizationServerMetadata,
  type OAuthClientInformation,
  type OAuthClientMetadata,
  type OAuthClientInformationFull,
} from './oauth-types';
import {
  MCPClientOAuthError,
  ServerError,
  OAUTH_ERRORS,
  InvalidClientError,
  InvalidGrantError,
  UnauthorizedClientError,
} from '../error/oauth-error';
import {
  resourceUrlFromServerUrl,
  checkResourceAllowed,
  resourceUrlStripSlash,
} from '../util/oauth-util';
import { LATEST_PROTOCOL_VERSION } from './types';
import { parseJSON, type FetchFunction } from '@ai-sdk/provider-utils';
export type AuthResult = 'AUTHORIZED' | 'REDIRECT';

export interface OAuthAuthorizationServerInformation {
  authorizationServerUrl: string;
  tokenEndpoint: string;
}

export interface OAuthClientProvider {
  /**
   * Returns current access token if present; undefined otherwise.
   */
  tokens(): OAuthTokens | undefined | Promise<OAuthTokens | undefined>;
  saveTokens(tokens: OAuthTokens): void | Promise<void>;
  redirectToAuthorization(authorizationUrl: URL): void | Promise<void>;
  saveCodeVerifier(codeVerifier: string): void | Promise<void>;
  codeVerifier(): string | Promise<string>;

  /**
   * Adds custom client authentication to OAuth token requests.
   *
   * This optional method allows implementations to customize how client credentials
   * are included in token exchange and refresh requests. When provided, this method
   * is called instead of the default authentication logic, giving full control over
   * the authentication mechanism.
   *
   * Common use cases include:
   * - Supporting authentication methods beyond the standard OAuth 2.0 methods
   * - Adding custom headers for proprietary authentication schemes
   * - Implementing client assertion-based authentication (e.g., JWT bearer tokens)
   *
   * @param headers - The request headers (can be modified to add authentication)
   * @param params - The request body parameters (can be modified to add credentials)
   * @param url - The token endpoint URL being called
   * @param metadata - Optional OAuth metadata for the server, which may include supported authentication methods
   */
  addClientAuthentication?(
    headers: Headers,
    params: URLSearchParams,
    url: string | URL,
    metadata?: AuthorizationServerMetadata,
  ): void | Promise<void>;

  /**
   * If implemented, provides a way for the client to invalidate (e.g. delete) the specified
   * credentials, in the case where the server has indicated that they are no longer valid.
   * This avoids requiring the user to intervene manually.
   */
  invalidateCredentials?(
    scope: 'all' | 'client' | 'tokens' | 'verifier',
  ): void | Promise<void>;
  get redirectUrl(): string | URL;
  get clientMetadata(): OAuthClientMetadata;
  clientInformation():
    | OAuthClientInformation
    | undefined
    | Promise<OAuthClientInformation | undefined>;
  saveClientInformation?(
    clientInformation: OAuthClientInformation,
  ): void | Promise<void>;
  authorizationServerInformation?():
    | OAuthAuthorizationServerInformation
    | undefined
    | Promise<OAuthAuthorizationServerInformation | undefined>;
  saveAuthorizationServerInformation?(
    authorizationServerInformation: OAuthAuthorizationServerInformation,
  ): void | Promise<void>;
  /**
   * Validates an authorization server URL discovered from MCP protected resource
   * metadata before the client fetches its OAuth metadata.
   */
  validateAuthorizationServerURL?(
    serverUrl: string | URL,
    authorizationServerUrl: string | URL,
  ): void | Promise<void>;
  state?(): string | Promise<string>;
  saveState?(state: string): void | Promise<void>;
  storedState?(): string | undefined | Promise<string | undefined>;
  validateResourceURL?(
    serverUrl: string | URL,
    resource?: string,
  ): Promise<URL | undefined>;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

function normalizeUrl(url: string | URL): string {
  return new URL(url).href;
}

function createAuthorizationServerInformation(
  authorizationServerUrl: string | URL,
  metadata?: AuthorizationServerMetadata,
): OAuthAuthorizationServerInformation {
  return {
    authorizationServerUrl: normalizeUrl(authorizationServerUrl),
    tokenEndpoint: normalizeUrl(
      metadata?.token_endpoint
        ? new URL(metadata.token_endpoint)
        : new URL('/token', authorizationServerUrl),
    ),
  };
}

function addAuthorizationServerInformationToTokens(
  tokens: OAuthTokens,
  authorizationServerInformation: OAuthAuthorizationServerInformation,
): OAuthTokens {
  return {
    ...tokens,
    authorization_server: authorizationServerInformation.authorizationServerUrl,
    token_endpoint: authorizationServerInformation.tokenEndpoint,
  };
}

function addAuthorizationServerInformationToClientInformation<
  CLIENT_INFORMATION extends OAuthClientInformation,
>(
  clientInformation: CLIENT_INFORMATION,
  authorizationServerInformation: OAuthAuthorizationServerInformation,
): CLIENT_INFORMATION {
  return {
    ...clientInformation,
    authorization_server: authorizationServerInformation.authorizationServerUrl,
    token_endpoint: authorizationServerInformation.tokenEndpoint,
  };
}

function getAuthorizationServerInformationFromCredentials(credentials?: {
  authorization_server?: string;
  token_endpoint?: string;
}): OAuthAuthorizationServerInformation | undefined {
  if (!credentials?.authorization_server || !credentials.token_endpoint) {
    return undefined;
  }

  return {
    authorizationServerUrl: normalizeUrl(credentials.authorization_server),
    tokenEndpoint: normalizeUrl(credentials.token_endpoint),
  };
}

async function getStoredAuthorizationServerInformation({
  provider,
  clientInformation,
  tokens,
}: {
  provider: OAuthClientProvider;
  clientInformation: OAuthClientInformation;
  tokens?: OAuthTokens;
}): Promise<OAuthAuthorizationServerInformation | undefined> {
  const tokenAuthorizationServerInformation =
    getAuthorizationServerInformationFromCredentials(tokens);
  if (tokenAuthorizationServerInformation) {
    return tokenAuthorizationServerInformation;
  }

  const providerAuthorizationServerInformation =
    await provider.authorizationServerInformation?.();
  if (providerAuthorizationServerInformation) {
    return {
      authorizationServerUrl: normalizeUrl(
        providerAuthorizationServerInformation.authorizationServerUrl,
      ),
      tokenEndpoint: normalizeUrl(
        providerAuthorizationServerInformation.tokenEndpoint,
      ),
    };
  }

  return getAuthorizationServerInformationFromCredentials(clientInformation);
}

async function saveAuthorizationServerInformation({
  provider,
  clientInformation,
  authorizationServerInformation,
}: {
  provider: OAuthClientProvider;
  clientInformation: OAuthClientInformation;
  authorizationServerInformation: OAuthAuthorizationServerInformation;
}): Promise<boolean> {
  if (provider.saveAuthorizationServerInformation) {
    await provider.saveAuthorizationServerInformation(
      authorizationServerInformation,
    );
    return true;
  }

  if (provider.saveClientInformation) {
    await provider.saveClientInformation(
      addAuthorizationServerInformationToClientInformation(
        clientInformation,
        authorizationServerInformation,
      ),
    );
    return true;
  }

  return false;
}

function assertResourceMetadataUrlSameOrigin(
  serverUrl: string | URL,
  resourceMetadataUrl?: URL,
): void {
  if (!resourceMetadataUrl) {
    return;
  }

  const expectedOrigin = new URL(serverUrl).origin;
  if (resourceMetadataUrl.origin !== expectedOrigin) {
    throw new MCPClientOAuthError({
      message: `OAuth protected resource metadata URL ${resourceMetadataUrl.href} must have the same origin as the MCP server URL ${expectedOrigin}`,
    });
  }
}

function assertAuthorizationServerInformationMatches({
  storedAuthorizationServerInformation,
  currentAuthorizationServerInformation,
}: {
  storedAuthorizationServerInformation: OAuthAuthorizationServerInformation;
  currentAuthorizationServerInformation: OAuthAuthorizationServerInformation;
}): void {
  if (
    storedAuthorizationServerInformation.authorizationServerUrl !==
      currentAuthorizationServerInformation.authorizationServerUrl ||
    storedAuthorizationServerInformation.tokenEndpoint !==
      currentAuthorizationServerInformation.tokenEndpoint
  ) {
    throw new MCPClientOAuthError({
      message:
        'OAuth authorization server metadata does not match the metadata that issued the stored credentials',
    });
  }
}

/**
 * Extracts the OAuth 2.0 Protected Resource Metadata URL from a WWW-Authenticate header (RFC9728).
 * Looks for a resource="..." parameter.
 */
export function extractResourceMetadataUrl(
  response: Response,
): URL | undefined {
  const header =
    response.headers.get('www-authenticate') ??
    response.headers.get('WWW-Authenticate');
  if (!header) {
    return undefined;
  }

  const [type, scheme] = header.split(' ');
  if (type.toLowerCase() !== 'bearer' || !scheme) {
    return undefined;
  }

  // regex taken from MCP spec
  const regex = /resource_metadata="([^"]*)"/;
  const match = header.match(regex);
  if (!match) {
    return undefined;
  }

  try {
    return new URL(match[1]);
  } catch {
    return undefined;
  }
}

/**
 * Constructs the well-known path for auth-related metadata discovery
 */
function buildWellKnownPath(
  wellKnownPrefix:
    | 'oauth-authorization-server'
    | 'oauth-protected-resource'
    | 'openid-configuration',
  pathname: string = '',
  options: { prependPathname?: boolean } = {},
): string {
  if (pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  return options.prependPathname
    ? `${pathname}/.well-known/${wellKnownPrefix}`
    : `/.well-known/${wellKnownPrefix}${pathname}`;
}

async function fetchWithCorsRetry(
  url: URL,
  headers?: Record<string, string>,
  fetchFn: FetchFunction = fetch,
): Promise<Response | undefined> {
  try {
    return await fetchFn(url, { headers });
  } catch (error) {
    if (error instanceof TypeError) {
      if (headers) {
        return fetchWithCorsRetry(url, undefined, fetchFn);
      } else {
        return undefined;
      }
    }
    throw error;
  }
}

/**
 * Tries to discover OAuth metadata at a specific URL
 */
async function tryMetadataDiscovery(
  url: URL,
  protocolVersion: string,
  fetchFn: FetchFunction = fetch,
): Promise<Response | undefined> {
  const headers = {
    'MCP-Protocol-Version': protocolVersion,
  };
  return await fetchWithCorsRetry(url, headers, fetchFn);
}

/**
 * Determines if fallback to root discovery should be attempted
 */
function shouldAttemptFallback(
  response: Response | undefined,
  pathname: string,
): boolean {
  return (
    !response ||
    (response.status >= 400 && response.status < 500 && pathname !== '/')
  );
}

/**
 * Generic function for discovering OAuth metadata with fallback support
 */
async function discoverMetadataWithFallback(
  serverUrl: string | URL,
  wellKnownType: 'oauth-authorization-server' | 'oauth-protected-resource',
  fetchFn: FetchFunction,
  opts?: {
    protocolVersion?: string;
    metadataUrl?: string | URL;
    metadataServerUrl?: string | URL;
  },
): Promise<Response | undefined> {
  const issuer = new URL(serverUrl);
  const protocolVersion = opts?.protocolVersion ?? LATEST_PROTOCOL_VERSION;

  let url: URL;
  if (opts?.metadataUrl) {
    url = new URL(opts.metadataUrl);
  } else {
    const wellKnownPath = buildWellKnownPath(wellKnownType, issuer.pathname);
    url = new URL(wellKnownPath, opts?.metadataServerUrl ?? issuer);
    url.search = issuer.search;
  }

  let response = await tryMetadataDiscovery(url, protocolVersion, fetchFn);

  if (!opts?.metadataUrl && shouldAttemptFallback(response, issuer.pathname)) {
    const rootUrl = new URL(`/.well-known/${wellKnownType}`, issuer);
    response = await tryMetadataDiscovery(rootUrl, protocolVersion, fetchFn);
  }

  return response;
}

export async function discoverOAuthProtectedResourceMetadata(
  serverUrl: string | URL,
  opts?: { protocolVersion?: string; resourceMetadataUrl?: string | URL },
  fetchFn: FetchFunction = fetch,
): Promise<OAuthProtectedResourceMetadata> {
  const response = await discoverMetadataWithFallback(
    serverUrl,
    'oauth-protected-resource',
    fetchFn,
    {
      protocolVersion: opts?.protocolVersion,
      metadataUrl: opts?.resourceMetadataUrl,
    },
  );

  if (!response || response.status === 404) {
    throw new Error(
      `Resource server does not implement OAuth 2.0 Protected Resource Metadata.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} trying to load well-known OAuth protected resource metadata.`,
    );
  }
  return OAuthProtectedResourceMetadataSchema.parse(await response.json());
}

/**
 * Builds a list of discovery URLs to try for authorization server metadata.
 * URLs are returned in priority order:
 * 1. OAuth metadata at the given URL
 * 2. OAuth metadata at root (if URL has path)
 * 3. OIDC metadata endpoints
 */
export function buildDiscoveryUrls(
  authorizationServerUrl: string | URL,
): { url: URL; type: 'oauth' | 'oidc'; expectedIssuer: string }[] {
  const url =
    typeof authorizationServerUrl === 'string'
      ? new URL(authorizationServerUrl)
      : authorizationServerUrl;
  const hasPath = url.pathname !== '/';
  const rootIssuer = url.origin;
  const urlsToTry: {
    url: URL;
    type: 'oauth' | 'oidc';
    expectedIssuer: string;
  }[] = [];

  if (!hasPath) {
    urlsToTry.push({
      url: new URL('/.well-known/oauth-authorization-server', url.origin),
      type: 'oauth',
      expectedIssuer: rootIssuer,
    });

    urlsToTry.push({
      url: new URL('/.well-known/openid-configuration', url.origin),
      type: 'oidc',
      expectedIssuer: rootIssuer,
    });

    return urlsToTry;
  }

  let pathname = url.pathname;
  if (pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  const pathIssuer = `${url.origin}${pathname}`;

  urlsToTry.push({
    url: new URL(
      `/.well-known/oauth-authorization-server${pathname}`,
      url.origin,
    ),
    type: 'oauth',
    expectedIssuer: pathIssuer,
  });

  urlsToTry.push({
    url: new URL('/.well-known/oauth-authorization-server', url.origin),
    type: 'oauth',
    expectedIssuer: rootIssuer,
  });

  urlsToTry.push({
    url: new URL(`/.well-known/openid-configuration${pathname}`, url.origin),
    type: 'oidc',
    expectedIssuer: pathIssuer,
  });

  urlsToTry.push({
    url: new URL(`${pathname}/.well-known/openid-configuration`, url.origin),
    type: 'oidc',
    expectedIssuer: pathIssuer,
  });

  return urlsToTry;
}

function assertMetadataIssuerMatches(
  metadata: AuthorizationServerMetadata,
  expectedIssuer: string,
): void {
  if (metadata.issuer !== expectedIssuer) {
    throw new MCPClientOAuthError({
      message: `OAuth authorization server metadata issuer ${metadata.issuer} does not match expected issuer ${expectedIssuer}`,
    });
  }
}

export async function discoverAuthorizationServerMetadata(
  authorizationServerUrl: string | URL,
  {
    fetchFn = fetch,
    protocolVersion = LATEST_PROTOCOL_VERSION,
  }: {
    fetchFn?: FetchFunction;
    protocolVersion?: string;
  } = {},
): Promise<AuthorizationServerMetadata | undefined> {
  const headers = { 'MCP-Protocol-Version': protocolVersion };

  const urlsToTry = buildDiscoveryUrls(authorizationServerUrl);

  for (const { url: endpointUrl, type, expectedIssuer } of urlsToTry) {
    const response = await fetchWithCorsRetry(endpointUrl, headers, fetchFn);

    if (!response) {
      /**
       * CORS error occurred - don't throw as the endpoint may not allow CORS,
       * continue trying other possible endpoints
       */
      continue;
    }

    if (!response.ok) {
      // Continue looking for any 4xx response code.
      if (response.status >= 400 && response.status < 500) {
        continue;
      }
      throw new Error(
        `HTTP ${response.status} trying to load ${type === 'oauth' ? 'OAuth' : 'OpenID provider'} metadata from ${endpointUrl}`,
      );
    }

    if (type === 'oauth') {
      const metadata = OAuthMetadataSchema.parse(await response.json());
      assertMetadataIssuerMatches(metadata, expectedIssuer);
      return metadata;
    } else {
      const metadata = OpenIdProviderDiscoveryMetadataSchema.parse(
        await response.json(),
      );
      assertMetadataIssuerMatches(metadata, expectedIssuer);

      // MCP spec requires OIDC providers to support S256 PKCE
      if (!metadata.code_challenge_methods_supported?.includes('S256')) {
        throw new Error(
          `Incompatible OIDC provider at ${endpointUrl}: does not support S256 code challenge method required by MCP specification`,
        );
      }

      return metadata;
    }
  }

  return undefined;
}

export async function startAuthorization(
  authorizationServerUrl: string | URL,
  {
    metadata,
    clientInformation,
    redirectUrl,
    scope,
    state,
    resource,
  }: {
    metadata?: AuthorizationServerMetadata;
    clientInformation: OAuthClientInformation;
    redirectUrl: string | URL;
    scope?: string;
    state?: string;
    resource?: URL;
  },
): Promise<{ authorizationUrl: URL; codeVerifier: string }> {
  const responseType = 'code';
  const codeChallengeMethod = 'S256';

  let authorizationUrl: URL;
  if (metadata) {
    authorizationUrl = new URL(metadata.authorization_endpoint);

    if (!metadata.response_types_supported.includes(responseType)) {
      throw new Error(
        `Incompatible auth server: does not support response type ${responseType}`,
      );
    }

    if (
      !metadata.code_challenge_methods_supported ||
      !metadata.code_challenge_methods_supported.includes(codeChallengeMethod)
    ) {
      throw new Error(
        `Incompatible auth server: does not support code challenge method ${codeChallengeMethod}`,
      );
    }
  } else {
    authorizationUrl = new URL('/authorize', authorizationServerUrl);
  }

  const challenge = await pkceChallenge();
  const codeVerifier = challenge.code_verifier;
  const codeChallenge = challenge.code_challenge;

  authorizationUrl.searchParams.set('response_type', responseType);
  authorizationUrl.searchParams.set('client_id', clientInformation.client_id);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set(
    'code_challenge_method',
    codeChallengeMethod,
  );
  authorizationUrl.searchParams.set('redirect_uri', String(redirectUrl));

  if (state) {
    authorizationUrl.searchParams.set('state', state);
  }

  if (scope) {
    authorizationUrl.searchParams.set('scope', scope);
  }

  if (scope?.includes('offline_access')) {
    // if the request includes the OIDC-only "offline_access" scope,
    // we need to set the prompt to "consent" to ensure the user is prompted to grant offline access
    // https://openid.net/specs/openid-connect-core-1_0.html#OfflineAccess
    authorizationUrl.searchParams.append('prompt', 'consent');
  }

  if (resource) {
    authorizationUrl.searchParams.set(
      'resource',
      resourceUrlStripSlash(resource),
    );
  }

  return { authorizationUrl, codeVerifier };
}

type ClientAuthMethod = 'client_secret_basic' | 'client_secret_post' | 'none';

/**
 * Determines the best client authentication method to use based on server support and client configuration.
 *
 * Priority order (highest to lowest):
 * 1. client_secret_basic (if client secret is available)
 * 2. client_secret_post (if client secret is available)
 * 3. none (for public clients)
 *
 * @param clientInformation - OAuth client information containing credentials
 * @param supportedMethods - Authentication methods supported by the authorization server
 * @returns The selected authentication method
 */
function selectClientAuthMethod(
  clientInformation: OAuthClientInformation,
  supportedMethods: string[],
): ClientAuthMethod {
  const hasClientSecret = clientInformation.client_secret !== undefined;

  if (supportedMethods.length === 0) {
    return hasClientSecret ? 'client_secret_post' : 'none';
  }

  if (hasClientSecret && supportedMethods.includes('client_secret_basic')) {
    return 'client_secret_basic';
  }

  if (hasClientSecret && supportedMethods.includes('client_secret_post')) {
    return 'client_secret_post';
  }

  if (supportedMethods.includes('none')) {
    return 'none';
  }

  return hasClientSecret ? 'client_secret_post' : 'none';
}

/**
 * Applies client authentication to the request based on the specified method.
 *
 * Implements OAuth 2.1 client authentication methods:
 * - client_secret_basic: HTTP Basic authentication (RFC 6749 Section 2.3.1)
 * - client_secret_post: Credentials in request body (RFC 6749 Section 2.3.1)
 * - none: Public client authentication (RFC 6749 Section 2.1)
 *
 * @param method - The authentication method to use
 * @param clientInformation - OAuth client information containing credentials
 * @param headers - HTTP headers object to modify
 * @param params - URL search parameters to modify
 * @throws {Error} When required credentials are missing
 */
function applyClientAuthentication(
  method: ClientAuthMethod,
  clientInformation: OAuthClientInformation,
  headers: Headers,
  params: URLSearchParams,
): void {
  const { client_id, client_secret } = clientInformation;

  switch (method) {
    case 'client_secret_basic':
      applyBasicAuth(client_id, client_secret, headers);
      return;
    case 'client_secret_post':
      applyPostAuth(client_id, client_secret, params);
      return;
    case 'none':
      applyPublicAuth(client_id, params);
      return;
    default:
      throw new Error(`Unsupported client authentication method: ${method}`);
  }
}

function applyBasicAuth(
  clientId: string,
  clientSecret: string | undefined,
  headers: Headers,
): void {
  if (!clientSecret) {
    throw new Error(
      'client_secret_basic authentication requires a client_secret',
    );
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  headers.set('Authorization', `Basic ${credentials}`);
}

/**
 * Applies POST body authentication (RFC 6749 Section 2.3.1)
 */
function applyPostAuth(
  clientId: string,
  clientSecret: string | undefined,
  params: URLSearchParams,
): void {
  params.set('client_id', clientId);
  if (clientSecret) {
    params.set('client_secret', clientSecret);
  }
}

/**
 * Applies public client authentication (RFC 6749 Section 2.1)
 */
function applyPublicAuth(clientId: string, params: URLSearchParams): void {
  params.set('client_id', clientId);
}

/**
 * Parses an OAuth error response from a string or Response object.
 *
 * If the input is a standard OAuth2.0 error response, it will be parsed according to the spec
 * and an instance of the appropriate OAuthError subclass will be returned.
 * If parsing fails, it falls back to a generic ServerError that includes
 * the response status (if available) and original content.
 *
 * @param input - A Response object or string containing the error response
 * @returns A Promise that resolves to an OAuthError instance
 */
export async function parseErrorResponse(
  input: Response | string,
): Promise<MCPClientOAuthError> {
  const statusCode = input instanceof Response ? input.status : undefined;
  const body = input instanceof Response ? await input.text() : input;

  try {
    const result = OAuthErrorResponseSchema.parse(
      await parseJSON({ text: body }),
    );
    const { error, error_description, error_uri } = result;
    const errorClass = OAUTH_ERRORS[error] || ServerError;
    return new errorClass({
      message: error_description || '',
      cause: error_uri,
    });
  } catch (error) {
    // Not a valid OAuth error response, but try to inform the user of the raw data anyway
    const errorMessage = `${statusCode ? `HTTP ${statusCode}: ` : ''}Invalid OAuth error response: ${error}. Raw body: ${body}`;
    return new ServerError({ message: errorMessage });
  }
}

/**
 * Exchanges an authorization code for an access token with the given server.
 *
 * Supports multiple client authentication methods as specified in OAuth 2.1:
 * - Automatically selects the best authentication method based on server support
 * - Falls back to appropriate defaults when server metadata is unavailable
 *
 * @param authorizationServerUrl - The authorization server's base URL
 * @param options - Configuration object containing client info, auth code, etc.
 * @returns Promise resolving to OAuth tokens
 * @throws {Error} When token exchange fails or authentication is invalid
 */
export async function exchangeAuthorization(
  authorizationServerUrl: string | URL,
  {
    metadata,
    clientInformation,
    authorizationCode,
    codeVerifier,
    redirectUri,
    resource,
    addClientAuthentication,
    fetchFn,
  }: {
    metadata?: AuthorizationServerMetadata;
    clientInformation: OAuthClientInformation;
    authorizationCode: string;
    codeVerifier: string;
    redirectUri: string | URL;
    resource?: URL;
    addClientAuthentication?: OAuthClientProvider['addClientAuthentication'];
    fetchFn?: FetchFunction;
  },
): Promise<OAuthTokens> {
  const grantType = 'authorization_code';

  const tokenUrl = metadata?.token_endpoint
    ? new URL(metadata.token_endpoint)
    : new URL('/token', authorizationServerUrl);

  if (
    metadata?.grant_types_supported &&
    !metadata.grant_types_supported.includes(grantType)
  ) {
    throw new Error(
      `Incompatible auth server: does not support grant type ${grantType}`,
    );
  }

  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  });
  const params = new URLSearchParams({
    grant_type: grantType,
    code: authorizationCode,
    code_verifier: codeVerifier,
    redirect_uri: String(redirectUri),
  });

  if (addClientAuthentication) {
    await addClientAuthentication(
      headers,
      params,
      authorizationServerUrl,
      metadata,
    );
  } else {
    const supportedMethods =
      metadata?.token_endpoint_auth_methods_supported ?? [];
    const authMethod = selectClientAuthMethod(
      clientInformation,
      supportedMethods,
    );

    applyClientAuthentication(authMethod, clientInformation, headers, params);
  }

  if (resource) {
    params.set('resource', resourceUrlStripSlash(resource));
  }

  const response = await (fetchFn ?? fetch)(tokenUrl, {
    method: 'POST',
    headers,
    body: params,
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return OAuthTokensSchema.parse(await response.json());
}

/**
 * Exchange a refresh token for an updated access token.
 *
 * Supports multiple client authentication methods as specified in OAuth 2.1:
 * - Automatically selects the best authentication method based on server support
 * - Preserves the original refresh token if a new one is not returned
 *
 * @param authorizationServerUrl - The authorization server's base URL
 * @param options - Configuration object containing client info, refresh token, etc.
 * @returns Promise resolving to OAuth tokens (preserves original refresh_token if not replaced)
 * @throws {Error} When token refresh fails or authentication is invalid
 */
export async function refreshAuthorization(
  authorizationServerUrl: string | URL,
  {
    metadata,
    clientInformation,
    refreshToken,
    resource,
    addClientAuthentication,
    fetchFn,
  }: {
    metadata?: AuthorizationServerMetadata;
    clientInformation: OAuthClientInformation;
    refreshToken: string;
    resource?: URL;
    addClientAuthentication?: OAuthClientProvider['addClientAuthentication'];
    fetchFn?: FetchFunction;
  },
): Promise<OAuthTokens> {
  const grantType = 'refresh_token';

  let tokenUrl: URL;
  if (metadata) {
    tokenUrl = new URL(metadata.token_endpoint);

    if (
      metadata.grant_types_supported &&
      !metadata.grant_types_supported.includes(grantType)
    ) {
      throw new Error(
        `Incompatible auth server: does not support grant type ${grantType}`,
      );
    }
  } else {
    tokenUrl = new URL('/token', authorizationServerUrl);
  }

  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  });
  const params = new URLSearchParams({
    grant_type: grantType,
    refresh_token: refreshToken,
  });

  if (addClientAuthentication) {
    await addClientAuthentication(
      headers,
      params,
      authorizationServerUrl,
      metadata,
    );
  } else {
    const supportedMethods =
      metadata?.token_endpoint_auth_methods_supported ?? [];
    const authMethod = selectClientAuthMethod(
      clientInformation,
      supportedMethods,
    );

    applyClientAuthentication(authMethod, clientInformation, headers, params);
  }

  if (resource) {
    params.set('resource', resourceUrlStripSlash(resource));
  }

  const response = await (fetchFn ?? fetch)(tokenUrl, {
    method: 'POST',
    headers,
    body: params,
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return OAuthTokensSchema.parse({
    refresh_token: refreshToken,
    ...(await response.json()),
  });
}

/**
 * Performs OAuth 2.0 Dynamic Client Registration according to RFC 7591.
 */
export async function registerClient(
  authorizationServerUrl: string | URL,
  {
    metadata,
    clientMetadata,
    fetchFn,
  }: {
    metadata?: AuthorizationServerMetadata;
    clientMetadata: OAuthClientMetadata;
    fetchFn?: FetchFunction;
  },
): Promise<OAuthClientInformationFull> {
  let registrationUrl: URL;

  if (metadata) {
    if (!metadata.registration_endpoint) {
      throw new Error(
        'Incompatible auth server: does not support dynamic client registration',
      );
    }

    registrationUrl = new URL(metadata.registration_endpoint);
  } else {
    registrationUrl = new URL('/register', authorizationServerUrl);
  }

  const response = await (fetchFn ?? fetch)(registrationUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(clientMetadata),
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return OAuthClientInformationFullSchema.parse(await response.json());
}

export async function auth(
  provider: OAuthClientProvider,
  options: {
    serverUrl: string | URL;
    authorizationCode?: string;
    callbackState?: string;
    scope?: string;
    resourceMetadataUrl?: URL;
    fetchFn?: FetchFunction;
  },
): Promise<AuthResult> {
  try {
    return await authInternal(provider, options);
  } catch (error) {
    if (
      error instanceof InvalidClientError ||
      error instanceof UnauthorizedClientError
    ) {
      await provider.invalidateCredentials?.('all');
      return await authInternal(provider, options);
    } else if (error instanceof InvalidGrantError) {
      await provider.invalidateCredentials?.('tokens');
      return await authInternal(provider, options);
    }

    throw error;
  }
}

export async function selectResourceURL(
  serverUrl: string | URL,
  provider: OAuthClientProvider,
  resourceMetadata?: OAuthProtectedResourceMetadata,
): Promise<URL | undefined> {
  const defaultResource = resourceUrlFromServerUrl(serverUrl);

  if (provider.validateResourceURL) {
    return await provider.validateResourceURL(
      defaultResource,
      resourceMetadata?.resource,
    );
  }

  if (!resourceMetadata) {
    return undefined;
  }

  if (
    !checkResourceAllowed({
      requestedResource: defaultResource,
      configuredResource: resourceMetadata.resource,
    })
  ) {
    throw new Error(
      `Protected resource ${resourceMetadata.resource} does not match expected ${defaultResource} (or origin)`,
    );
  }
  return new URL(resourceMetadata.resource);
}

async function authInternal(
  provider: OAuthClientProvider,
  {
    serverUrl,
    authorizationCode,
    callbackState,
    scope,
    resourceMetadataUrl,
    fetchFn,
  }: {
    serverUrl: string | URL;
    authorizationCode?: string;
    callbackState?: string;
    scope?: string;
    resourceMetadataUrl?: URL;
    fetchFn?: FetchFunction;
  },
): Promise<AuthResult> {
  let resourceMetadata: OAuthProtectedResourceMetadata | undefined;
  let authorizationServerUrl: string | URL | undefined;

  /** Reject Protected Resource Metadata URLs outside the configured MCP server origin. */
  assertResourceMetadataUrlSameOrigin(serverUrl, resourceMetadataUrl);

  /** Discover PRM and select its advertised authorization server. */
  try {
    resourceMetadata = await discoverOAuthProtectedResourceMetadata(
      serverUrl,
      { resourceMetadataUrl },
      fetchFn,
    );
    if (
      resourceMetadata.authorization_servers &&
      resourceMetadata.authorization_servers.length > 0
    ) {
      authorizationServerUrl = resourceMetadata.authorization_servers[0];
    }
  } catch {}

  /** Fall back to legacy MCP behavior where the MCP server is the Authorization Server */
  if (!authorizationServerUrl) {
    authorizationServerUrl = serverUrl;
  }

  /** Validate and select the resource value sent to the AS */
  const resource: URL | undefined = await selectResourceURL(
    serverUrl,
    provider,
    resourceMetadata,
  );

  /** Let applications constrain discovered AS URLs before metadata fetches. */
  await provider.validateAuthorizationServerURL?.(
    serverUrl,
    authorizationServerUrl,
  );

  /** Discover AS metadata and derive the credential pin for this flow */
  const metadata = await discoverAuthorizationServerMetadata(
    authorizationServerUrl,
    {
      fetchFn,
    },
  );
  const currentAuthorizationServerInformation =
    createAuthorizationServerInformation(authorizationServerUrl, metadata);

  /** Load or register client credentials with the AS pin attached. */
  let clientInformation = await Promise.resolve(provider.clientInformation());
  if (!clientInformation) {
    if (authorizationCode !== undefined) {
      throw new Error(
        'Existing OAuth client information is required when exchanging an authorization code',
      );
    }

    if (!provider.saveClientInformation) {
      throw new Error(
        'OAuth client information must be saveable for dynamic registration',
      );
    }

    const fullInformation = await registerClient(authorizationServerUrl, {
      metadata,
      clientMetadata: provider.clientMetadata,
      fetchFn,
    });

    clientInformation = addAuthorizationServerInformationToClientInformation(
      fullInformation,
      currentAuthorizationServerInformation,
    );
    await provider.saveClientInformation(clientInformation);
  }

  /** On callback, validate state and AS pin before code exchange */
  if (authorizationCode !== undefined) {
    if (provider.storedState) {
      const expectedState = await provider.storedState();
      if (expectedState !== undefined && expectedState !== callbackState) {
        throw new Error(
          'OAuth state parameter mismatch - possible CSRF attack',
        );
      }
    }

    const storedAuthorizationServerInformation =
      await getStoredAuthorizationServerInformation({
        provider,
        clientInformation,
      });
    if (!storedAuthorizationServerInformation) {
      throw new MCPClientOAuthError({
        message:
          'Stored OAuth authorization server metadata is required when exchanging an authorization code',
      });
    }
    assertAuthorizationServerInformationMatches({
      storedAuthorizationServerInformation,
      currentAuthorizationServerInformation,
    });

    const codeVerifier = await provider.codeVerifier();
    const tokens = await exchangeAuthorization(authorizationServerUrl, {
      metadata,
      clientInformation,
      authorizationCode,
      codeVerifier,
      redirectUri: provider.redirectUrl,
      resource,
      addClientAuthentication: provider.addClientAuthentication,
      fetchFn: fetchFn,
    });

    await provider.saveTokens(
      addAuthorizationServerInformationToTokens(
        tokens,
        currentAuthorizationServerInformation,
      ),
    );
    return 'AUTHORIZED';
  }

  const tokens = await provider.tokens();

  /** Refresh only when stored credentials match the current AS pin */
  if (tokens?.refresh_token) {
    const storedAuthorizationServerInformation =
      await getStoredAuthorizationServerInformation({
        provider,
        clientInformation,
        tokens,
      });

    if (storedAuthorizationServerInformation) {
      assertAuthorizationServerInformationMatches({
        storedAuthorizationServerInformation,
        currentAuthorizationServerInformation,
      });
    } else {
      await provider.invalidateCredentials?.('tokens');
    }

    try {
      if (storedAuthorizationServerInformation) {
        // Attempt to refresh the token
        const newTokens = await refreshAuthorization(authorizationServerUrl, {
          metadata,
          clientInformation,
          refreshToken: tokens.refresh_token,
          resource,
          addClientAuthentication: provider.addClientAuthentication,
          fetchFn,
        });

        await provider.saveTokens(
          addAuthorizationServerInformationToTokens(
            newTokens,
            currentAuthorizationServerInformation,
          ),
        );
        return 'AUTHORIZED';
      }
    } catch (error) {
      if (
        // If this is a ServerError, or an unknown type, log it out and try to continue. Otherwise, escalate so we can fix things and retry.
        !(error instanceof MCPClientOAuthError) ||
        error instanceof ServerError
      ) {
        // Could not refresh OAuth tokens
      } else {
        // Refresh failed for another reason, re-throw
        throw error;
      }
    }
  }

  /** Start authorization and persist the AS pin before redirecting */
  const state = provider.state ? await provider.state() : undefined;
  if (state && provider.saveState) {
    await provider.saveState(state);
  }

  // Start new authorization flow
  const { authorizationUrl, codeVerifier } = await startAuthorization(
    authorizationServerUrl,
    {
      metadata,
      clientInformation,
      state,
      redirectUrl: provider.redirectUrl,
      scope: scope || provider.clientMetadata.scope,
      resource,
    },
  );

  const savedAuthorizationServerInformation =
    await saveAuthorizationServerInformation({
      provider,
      clientInformation,
      authorizationServerInformation: currentAuthorizationServerInformation,
    });
  if (!savedAuthorizationServerInformation) {
    throw new MCPClientOAuthError({
      message:
        'OAuth authorization server metadata must be saveable before starting authorization',
    });
  }

  await provider.saveCodeVerifier(codeVerifier);
  await provider.redirectToAuthorization(authorizationUrl);
  return 'REDIRECT';
}
