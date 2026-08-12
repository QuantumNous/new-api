import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount } from 'ai';

/**
 * @deprecated Use the `@ai-sdk/mcp` package instead.
 *
import { experimental_createMCPClient, auth } from 'ai';
import type {
  OAuthClientProvider,
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from 'ai';
*/

import {
  createMCPClient,
  auth,
  type OAuthClientProvider,
  type OAuthClientInformation,
  type OAuthClientMetadata,
  type OAuthTokens,
} from '@ai-sdk/mcp';
import 'dotenv/config';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';

class InMemoryOAuthClientProvider implements OAuthClientProvider {
  private _tokens?: OAuthTokens;
  private _codeVerifier?: string;
  private _clientInformation?: OAuthClientInformation;
  private _redirectUrl: string | URL =
    `http://localhost:${process.env.MCP_CALLBACK_PORT ?? 8090}/callback`;

  async tokens(): Promise<OAuthTokens | undefined> {
    return this._tokens;
  }
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this._tokens = tokens;
  }
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    const url = authorizationUrl.toString();
    const command =
      process.platform === 'win32'
        ? 'rundll32'
        : process.platform === 'darwin'
          ? 'open'
          : 'xdg-open';
    const args =
      process.platform === 'win32'
        ? ['url.dll,FileProtocolHandler', url]
        : [url];

    execFile(command, args, error => {
      if (error) {
        console.error('Open this URL to continue:', url);
      }
    });
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
      client_name: 'AI SDK MCP OAuth Example',
      redirect_uris: [String(this._redirectUrl)],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    };
  }
  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    return this._clientInformation;
  }
  async saveClientInformation(info: OAuthClientInformation): Promise<void> {
    this._clientInformation = info;
  }
  addClientAuthentication = async (
    headers: Headers,
    params: URLSearchParams,
    _url: string | URL,
  ): Promise<void> => {
    const info = this._clientInformation;
    if (!info) {
      return;
    }

    const method = (info as any).token_endpoint_auth_method as
      | 'client_secret_post'
      | 'client_secret_basic'
      | 'none'
      | undefined;

    const hasSecret = Boolean((info as any).client_secret);
    const clientId = info.client_id;
    const clientSecret = (info as any).client_secret as string | undefined;

    // Prefer the method assigned at registration; fall back sensibly
    const chosen = method ?? (hasSecret ? 'client_secret_post' : 'none');

    if (chosen === 'client_secret_basic') {
      if (!clientSecret) {
        params.set('client_id', clientId);
        return;
      }
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64',
      );
      headers.set('Authorization', `Basic ${credentials}`);
      return;
    }

    if (chosen === 'client_secret_post') {
      params.set('client_id', clientId);
      if (clientSecret) params.set('client_secret', clientSecret);
      return;
    }

    // none (public client)
    params.set('client_id', clientId);
  };
  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier') {
    if (scope === 'all' || scope === 'tokens') this._tokens = undefined;
    if (scope === 'all' || scope === 'client')
      this._clientInformation = undefined;
    if (scope === 'all' || scope === 'verifier') this._codeVerifier = undefined;
  }
}

async function authorizeWithPkceOnce(
  authProvider: OAuthClientProvider,
  serverUrl: string,
  waitForCode: () => Promise<string>,
): Promise<void> {
  const result = await auth(authProvider, { serverUrl: new URL(serverUrl) });
  if (result !== 'AUTHORIZED') {
    const authorizationCode = await waitForCode();
    await auth(authProvider, {
      serverUrl: new URL(serverUrl),
      authorizationCode,
    });
  }
}

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
      const err = url.searchParams.get('error');
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body><h1>Authorization Successful</h1><p>You can close this window.</p></body></html>',
        );
        setTimeout(() => server.close(), 100);
        resolve(code);
      } else {
        res
          .writeHead(400)
          .end(`Authorization failed: ${err ?? 'missing code'}`);
        setTimeout(() => server.close(), 100);
        reject(new Error(`Authorization failed: ${err ?? 'missing code'}`));
      }
    });
    server.listen(port, () => {
      console.log(`OAuth callback: http://localhost:${port}/callback`);
    });
  });
}

async function main() {
  const authProvider = new InMemoryOAuthClientProvider();
  const serverUrl = 'https://mcp.vercel.com/';

  await authorizeWithPkceOnce(authProvider, serverUrl, () =>
    waitForAuthorizationCode(Number(8090)),
  );

  const mcpClient = await createMCPClient({
    transport: { type: 'http', url: serverUrl, authProvider },
  });
  const tools = await mcpClient.tools();

  console.log(`Retrieved ${Object.keys(tools).length} protected tools`);
  console.log(`Available tools: ${Object.keys(tools).join(', ')}`);

  const { text: answer } = await generateText({
    model: openai('gpt-4o-mini'),
    tools,
    stopWhen: isStepCount(10),
    onStepFinish: async ({ toolResults }) => {
      if (toolResults.length > 0) {
        console.log('Tool execution results:');
        toolResults.forEach(result => {
          console.log(
            `  - ${result.toolName}:`,
            JSON.stringify(result, null, 2),
          );
        });
      }
    },
    instructions: 'You are a helpful assistant with access to protected tools.',
    prompt:
      'List the tools available for me to call. Arrange them in alphabetical order.',
  });

  await mcpClient.close();

  console.log(`FINAL ANSWER: ${answer}`);
}

main().catch(console.error);
