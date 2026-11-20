import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  isStepCount,
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from 'ai';
import {
  createMCPClient,
  auth,
  type OAuthClientInformation,
  type OAuthClientMetadata,
  type OAuthTokens,
} from '@ai-sdk/mcp';
import { createServer } from 'node:http';

type AuthGlobalState = {
  pendingAuthorizationUrl: string | null;
};

const AUTH_GLOBAL_KEY = '__mcpAuth';

function getAuthState(): AuthGlobalState {
  const g = globalThis as any;
  if (!g[AUTH_GLOBAL_KEY]) {
    g[AUTH_GLOBAL_KEY] = {
      pendingAuthorizationUrl: null,
    } as AuthGlobalState;
  }
  return g[AUTH_GLOBAL_KEY] as AuthGlobalState;
}

function setPendingAuthorizationUrl(url: string | null): void {
  getAuthState().pendingAuthorizationUrl = url;
}

// In-memory storage for OAuth state per server origin
const oauthStateStore = new Map<
  string,
  {
    tokens?: OAuthTokens;
    codeVerifier?: string;
    clientInformation?: OAuthClientInformation;
  }
>();

class InMemoryOAuthClientProvider {
  private serverOrigin: string;
  private _redirectUrl: string;

  constructor(serverUrl: string | URL, callbackPort: number) {
    this.serverOrigin = new URL(serverUrl).origin;
    this._redirectUrl = `http://localhost:${callbackPort}/callback`;
  }

  private getState() {
    if (!oauthStateStore.has(this.serverOrigin)) {
      oauthStateStore.set(this.serverOrigin, {});
    }
    return oauthStateStore.get(this.serverOrigin)!;
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return this.getState().tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.getState().tokens = tokens;
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    setPendingAuthorizationUrl(authorizationUrl.toString());
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this.getState().codeVerifier = codeVerifier;
  }

  async codeVerifier(): Promise<string> {
    const verifier = this.getState().codeVerifier;
    if (!verifier) throw new Error('No code verifier saved');
    return verifier;
  }

  get redirectUrl(): string | URL {
    return this._redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'AI SDK MCP OAuth Example (Next.js)',
      redirect_uris: [String(this._redirectUrl)],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    } as any;
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    return this.getState().clientInformation;
  }

  async saveClientInformation(info: OAuthClientInformation): Promise<void> {
    this.getState().clientInformation = info;
  }

  addClientAuthentication = async (
    headers: Headers,
    params: URLSearchParams,
    _url: string | URL,
  ): Promise<void> => {
    const info = this.getState().clientInformation;
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

    params.set('client_id', clientId);
  };

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier') {
    const state = this.getState();
    if (scope === 'all' || scope === 'tokens') state.tokens = undefined;
    if (scope === 'all' || scope === 'client')
      state.clientInformation = undefined;
    if (scope === 'all' || scope === 'verifier') state.codeVerifier = undefined;
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
          '<html><body><h1>Authorization Successful</h1><p>You can close this window.</p><script>window.close();</script></body></html>',
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
      console.log(`OAuth callback server: http://localhost:${port}/callback`);
    });
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const messages = body.messages;
  const serverUrl: string = 'https://mcp.vercel.com/';
  const callbackPort = 8090;

  try {
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        const authProvider = new InMemoryOAuthClientProvider(
          serverUrl,
          callbackPort,
        );

        // Attempt auth; if redirect is needed, instruct client to open URL, then wait and complete.
        const result = await auth(authProvider, {
          serverUrl: new URL(serverUrl),
        });

        if (result !== 'AUTHORIZED') {
          const url = getAuthState().pendingAuthorizationUrl;
          if (url) {
            writer.write({
              type: 'data-oauth',
              data: { url },
              transient: true,
            });
          }

          const authorizationCode =
            await waitForAuthorizationCode(callbackPort);
          await auth(authProvider, {
            serverUrl: new URL(serverUrl),
            authorizationCode,
          });
        }

        const mcpClient = await createMCPClient({
          transport: { type: 'http', url: serverUrl, authProvider },
        });

        try {
          const tools = await mcpClient.tools();

          const result = streamText({
            model: openai('gpt-4o-mini'),
            tools,
            stopWhen: isStepCount(10),
            instructions:
              'You are a helpful assistant with access to protected tools.',
            messages: await convertToModelMessages(messages),
          });

          writer.merge(
            toUIMessageStream({
              stream: result.stream,
              originalMessages: messages,
            }),
          );
        } finally {
          await mcpClient.close();
        }
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('MCP with auth error:', error);
    return Response.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
