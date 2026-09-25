import {
  EventSourceParserStream,
  withUserAgentSuffix,
  getRuntimeEnvironmentUserAgent,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { MCPClientError } from '../error/mcp-client-error';
import { parseJSONRPCMessage, type JSONRPCMessage } from './json-rpc-message';
import type { MCPTransport } from './mcp-transport';
import { VERSION } from '../version';
import {
  extractResourceMetadataUrl,
  UnauthorizedError,
  auth,
  type OAuthClientProvider,
} from './oauth';
import { LATEST_PROTOCOL_VERSION } from './types';

function isMessageEvent(event: string | undefined): boolean {
  return event === undefined || event === 'message';
}

export class SseMCPTransport implements MCPTransport {
  private endpoint?: URL;
  private abortController?: AbortController;
  private url: URL;
  private connected = false;
  private sseConnection?: {
    close: () => void;
  };
  private headers?: Record<string, string>;
  private authProvider?: OAuthClientProvider;
  private resourceMetadataUrl?: URL;
  private redirectMode: RequestRedirect;
  private fetchFn: FetchFunction;

  onclose?: () => void;
  onerror?: (error: unknown) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  protocolVersion?: string;

  constructor({
    url,
    headers,
    authProvider,
    redirect = 'error',
    fetch: fetchFn,
  }: {
    url: string;
    headers?: Record<string, string>;
    authProvider?: OAuthClientProvider;
    redirect?: 'follow' | 'error';
    fetch?: FetchFunction;
  }) {
    this.url = new URL(url);
    this.headers = headers;
    this.authProvider = authProvider;
    this.redirectMode = redirect;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  setProtocolVersion(version: string): void {
    this.protocolVersion = version;
  }

  private async commonHeaders(
    base: Record<string, string>,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      ...this.headers,
      ...base,
      'mcp-protocol-version': this.protocolVersion ?? LATEST_PROTOCOL_VERSION,
    };

    if (this.authProvider) {
      const tokens = await this.authProvider.tokens();
      if (tokens?.access_token) {
        headers['Authorization'] = `Bearer ${tokens.access_token}`;
      }
    }

    return withUserAgentSuffix(
      headers,
      `ai-sdk/${VERSION}`,
      getRuntimeEnvironmentUserAgent(),
    );
  }

  async start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.connected) {
        return resolve();
      }

      this.abortController = new AbortController();

      const establishConnection = async (triedAuth: boolean = false) => {
        try {
          const headers = await this.commonHeaders({
            Accept: 'text/event-stream',
          });
          const response = await this.fetchFn(this.url.href, {
            headers,
            signal: this.abortController?.signal,
            redirect: this.redirectMode,
          });

          if (response.status === 401 && this.authProvider && !triedAuth) {
            this.resourceMetadataUrl = extractResourceMetadataUrl(response);
            try {
              const result = await auth(this.authProvider, {
                serverUrl: this.url,
                resourceMetadataUrl: this.resourceMetadataUrl,
                fetchFn: this.fetchFn,
              });
              if (result !== 'AUTHORIZED') {
                const error = new UnauthorizedError();
                this.onerror?.(error);
                return reject(error);
              }
            } catch (error) {
              this.onerror?.(error);
              return reject(error);
            }
            return establishConnection(true);
          }

          if (!response.ok || !response.body) {
            let errorMessage = `MCP SSE Transport Error: ${response.status} ${response.statusText}`;

            if (response.status === 405) {
              errorMessage +=
                '. This server does not support SSE transport. Try using `http` transport instead';
            }

            const error = new MCPClientError({
              message: errorMessage,
            });
            this.onerror?.(error);
            return reject(error);
          }

          const stream = response.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream());

          const reader = stream.getReader();

          const processEvents = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();

                if (done) {
                  if (this.connected) {
                    this.connected = false;
                    throw new MCPClientError({
                      message:
                        'MCP SSE Transport Error: Connection closed unexpectedly',
                    });
                  }
                  return;
                }

                const { event, data } = value;

                if (event === 'endpoint') {
                  if (this.endpoint) {
                    continue;
                  }

                  const endpoint = new URL(data, this.url);

                  if (endpoint.origin !== this.url.origin) {
                    this.connected = false;
                    this.endpoint = undefined;
                    this.sseConnection?.close();
                    this.abortController?.abort();
                    throw new MCPClientError({
                      message: `MCP SSE Transport Error: Endpoint origin does not match connection origin: ${endpoint.origin}`,
                    });
                  }

                  this.endpoint = endpoint;
                  this.connected = true;
                  resolve();
                } else if (isMessageEvent(event)) {
                  try {
                    const message = await parseJSONRPCMessage(data);
                    this.onmessage?.(message);
                  } catch (error) {
                    const e = new MCPClientError({
                      message:
                        'MCP SSE Transport Error: Failed to parse message',
                      cause: error,
                    });
                    this.onerror?.(e);
                    // We do not throw here so we continue processing events after reporting the error
                  }
                }
              }
            } catch (error) {
              if (error instanceof Error && error.name === 'AbortError') {
                return;
              }

              this.onerror?.(error);
              reject(error);
            }
          };

          this.sseConnection = {
            close: () => reader.cancel(),
          };

          processEvents();
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }

          this.onerror?.(error);
          reject(error);
        }
      };

      void establishConnection();
    });
  }

  async close(): Promise<void> {
    this.connected = false;
    this.endpoint = undefined;
    this.sseConnection?.close();
    this.abortController?.abort();
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.endpoint || !this.connected) {
      throw new MCPClientError({
        message: 'MCP SSE Transport Error: Not connected',
      });
    }

    const endpoint = this.endpoint as URL;

    const attempt = async (triedAuth: boolean = false): Promise<void> => {
      try {
        const headers = await this.commonHeaders({
          'Content-Type': 'application/json',
        });
        const init = {
          method: 'POST',
          headers,
          body: JSON.stringify(message),
          signal: this.abortController?.signal,
          redirect: this.redirectMode,
        };

        const response = await this.fetchFn(endpoint.href, init);

        if (response.status === 401 && this.authProvider && !triedAuth) {
          this.resourceMetadataUrl = extractResourceMetadataUrl(response);
          try {
            const result = await auth(this.authProvider, {
              serverUrl: this.url,
              resourceMetadataUrl: this.resourceMetadataUrl,
              fetchFn: this.fetchFn,
            });
            if (result !== 'AUTHORIZED') {
              const error = new UnauthorizedError();
              this.onerror?.(error);
              return;
            }
          } catch (error) {
            this.onerror?.(error);
            return;
          }
          return attempt(true);
        }

        if (!response.ok) {
          const text = await response.text().catch(() => null);
          const error = new MCPClientError({
            message: `MCP SSE Transport Error: POSTing to endpoint (HTTP ${response.status}): ${text}`,
          });
          this.onerror?.(error);
          return;
        }
      } catch (error) {
        this.onerror?.(error);
        return;
      }
    };
    await attempt();
  }
}

export async function deserializeMessage(
  line: string,
): Promise<JSONRPCMessage> {
  return parseJSONRPCMessage(line);
}
