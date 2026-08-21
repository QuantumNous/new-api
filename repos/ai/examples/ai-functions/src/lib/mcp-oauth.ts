import {
  auth,
  type OAuthClientInformation,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type OAuthTokens,
} from '@ai-sdk/mcp';
import { createServer } from 'node:http';

/**
 * Minimal OAuth client provider for MCP Server
 */
class MinimalOAuthProvider implements OAuthClientProvider {
  private _tokens?: OAuthTokens;
  private _codeVerifier?: string;
  private _clientInformation?: OAuthClientInformation;
  private _redirectUrl: string | URL;

  constructor(port: number = 8090) {
    this._redirectUrl = `http://localhost:${port}/callback`;
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return this._tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this._tokens = tokens;
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    console.log('\nPlease open this URL in your browser to authorize:');
    console.log(authorizationUrl.toString());
    console.log(`\nCallback server: ${this._redirectUrl}\n`);
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this._codeVerifier = codeVerifier;
  }

  async codeVerifier(): Promise<string> {
    if (!this._codeVerifier) throw new Error('No code verifier saved');
    return this._codeVerifier;
  }

  get redirectUrl(): string | URL {
    return this._redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'AI SDK OpenAI Responses MCP Example',
      redirect_uris: [String(this._redirectUrl)],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    return this._clientInformation;
  }

  async saveClientInformation(info: OAuthClientInformation): Promise<void> {
    this._clientInformation = info;
  }
}

/**
 * Wait for OAuth callback code
 */
function waitForAuthorizationCode(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400).end('Bad request');
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404).end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(
          `<html><body><h1>Authorization Failed</h1><p>Error: ${error}</p></body></html>`,
        );
        setTimeout(() => server.close(), 100);
        reject(new Error(`Authorization failed: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body><h1>Authorization Successful</h1><p>You can close this window.</p></body></html>',
        );
        setTimeout(() => server.close(), 100);
        resolve(code);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body><h1>Authorization Failed</h1><p>Missing authorization code</p></body></html>',
        );
        setTimeout(() => server.close(), 100);
        reject(new Error('Missing authorization code'));
      }
    });

    server.listen(port, () => {
      console.log(
        `Listening for OAuth callback on http://localhost:${port}/callback`,
      );
    });
  });
}

/**
 * Get OAuth access token for MCP server
 */
export async function getMCPToken(
  serverUrl: string,
  port: number = 8090,
): Promise<string> {
  const authProvider = new MinimalOAuthProvider(port);

  // Start authorization flow
  const result = await auth(authProvider, { serverUrl: new URL(serverUrl) });

  if (result === 'AUTHORIZED') {
    const tokens = await authProvider.tokens();
    if (tokens?.access_token) {
      console.log('Already authorized!\n');
      return tokens.access_token;
    }
  }

  // Wait for user to authorize in browser
  const authorizationCode = await waitForAuthorizationCode(port);

  // Complete authorization with the code
  await auth(authProvider, {
    serverUrl: new URL(serverUrl),
    authorizationCode,
  });

  const tokens = await authProvider.tokens();
  if (!tokens?.access_token) {
    throw new Error('Failed to obtain access token');
  }

  console.log('Authorization successful!\n');
  return tokens.access_token;
}
