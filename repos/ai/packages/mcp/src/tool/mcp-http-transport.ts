import {
  EventSourceParserStream,
  withUserAgentSuffix,
  getRuntimeEnvironmentUserAgent,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { MCPClientError } from '../error/mcp-client-error';
import {
  parseJSONRPCMessage,
  validateJSONRPCMessage,
  type JSONRPCMessage,
} from './json-rpc-message';
import type { MCPTransport } from './mcp-transport';
import { VERSION } from '../version';
import {
  extractResourceMetadataUrl,
  UnauthorizedError,
  auth,
  type AuthResult,
  type OAuthClientProvider,
} from './oauth';
import { LATEST_PROTOCOL_VERSION } from './types';

function isMessageEvent(event: string | undefined): boolean {
  return event === undefined || event === 'message';
}

/**
 * HTTP MCP transport implementing the Streamable HTTP style.
 *
 * Client transport for Streamable HTTP: this implements the MCP Streamable HTTP transport specification.
 * It will connect to a server using HTTP POST for sending messages and HTTP GET with Server-Sent Events
 * for receiving messages.
 */
export class HttpMCPTransport implements MCPTransport {
  private url: URL;
  private abortController?: AbortController;
  private headers?: Record<string, string>;
  private authProvider?: OAuthClientProvider;
  private resourceMetadataUrl?: URL;
  private sessionId?: string;
  private inboundSseConnection?: { close: () => void };
  private redirectMode: RequestRedirect;
  private fetchFn: FetchFunction;
  private authPromise?: Promise<AuthResult>;
  private onSessionIdChange?: (sessionId: string | undefined) => void;
  private onSessionExpired?: (sessionId: string) => void;
  private terminateSessionOnClose: boolean;

  // Inbound SSE resumption and reconnection state
  private lastInboundEventId?: string;
  private inboundReconnectAttempts = 0;
  private readonly reconnectionOptions = {
    initialReconnectionDelay: 1000,
    maxReconnectionDelay: 30000,
    reconnectionDelayGrowFactor: 1.5,
    maxRetries: 2,
  } as const;

  onclose?: () => void;
  onerror?: (error: unknown) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  protocolVersion?: string;

  constructor({
    url,
    headers,
    authProvider,
    redirect = 'error',
    initialSessionId,
    initialProtocolVersion,
    onSessionIdChange,
    onSessionExpired,
    terminateSessionOnClose = true,
    fetch: fetchFn,
  }: {
    url: string;
    headers?: Record<string, string>;
    authProvider?: OAuthClientProvider;
    redirect?: 'follow' | 'error';
    initialSessionId?: string;
    initialProtocolVersion?: string;
    onSessionIdChange?: (sessionId: string | undefined) => void;
    onSessionExpired?: (sessionId: string) => void;
    terminateSessionOnClose?: boolean;
    fetch?: FetchFunction;
  }) {
    this.url = new URL(url);
    this.headers = headers;
    this.authProvider = authProvider;
    this.redirectMode = redirect;
    this.sessionId = initialSessionId;
    this.protocolVersion = initialProtocolVersion;
    this.onSessionIdChange = onSessionIdChange;
    this.onSessionExpired = onSessionExpired;
    this.terminateSessionOnClose = terminateSessionOnClose;
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  setProtocolVersion(version: string): void {
    this.protocolVersion = version;
  }

  private async commonHeaders({
    base,
    includeSessionId = true,
  }: {
    base: Record<string, string>;
    includeSessionId?: boolean;
  }): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      ...this.headers,
      ...base,
      'mcp-protocol-version': this.protocolVersion ?? LATEST_PROTOCOL_VERSION,
    };

    if (includeSessionId && this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

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

  private setSessionId(sessionId: string | undefined): void {
    if (this.sessionId === sessionId) {
      return;
    }

    this.sessionId = sessionId;
    this.onSessionIdChange?.(sessionId);
  }

  private applySessionIdFromResponse(response: Response): void {
    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) {
      this.setSessionId(sessionId);
    }
  }

  private expireSessionId(sessionId: string): void {
    if (this.sessionId === sessionId) {
      this.setSessionId(undefined);
    }

    this.onSessionExpired?.(sessionId);
  }

  /**
   * Runs a single OAuth recovery flow for concurrent 401 responses.
   */
  private authorizeOnce(resourceMetadataUrl?: URL): Promise<AuthResult> {
    if (!this.authProvider) {
      return Promise.resolve('REDIRECT');
    }

    if (!this.authPromise) {
      this.authPromise = auth(this.authProvider, {
        serverUrl: this.url,
        resourceMetadataUrl,
        fetchFn: this.fetchFn,
      }).finally(() => {
        this.authPromise = undefined;
      });
    }

    return this.authPromise;
  }

  async start(): Promise<void> {
    if (this.abortController) {
      throw new MCPClientError({
        message:
          'MCP HTTP Transport Error: Transport already started. Note: client.connect() calls start() automatically.',
      });
    }
    this.abortController = new AbortController();

    this.startInboundSse();
  }

  async close(): Promise<void> {
    this.inboundSseConnection?.close();
    try {
      if (
        this.sessionId &&
        this.terminateSessionOnClose &&
        this.abortController &&
        !this.abortController.signal.aborted
      ) {
        const headers = await this.commonHeaders({ base: {} });
        await this.fetchFn(this.url.href, {
          method: 'DELETE',
          headers,
          signal: this.abortController.signal,
          redirect: this.redirectMode,
        }).catch(() => undefined);
      }
    } catch {}

    this.abortController?.abort();
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    const attempt = async (triedAuth: boolean = false): Promise<void> => {
      try {
        const isInitializeRequest =
          'method' in message && message.method === 'initialize';
        const sessionIdForRequest = isInitializeRequest
          ? undefined
          : this.sessionId;
        const headers = await this.commonHeaders({
          base: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          includeSessionId: !isInitializeRequest,
        });

        const init = {
          method: 'POST',
          headers,
          body: JSON.stringify(message),
          signal: this.abortController?.signal,
          redirect: this.redirectMode,
        } satisfies RequestInit;

        const response = await this.fetchFn(this.url.href, init);

        this.applySessionIdFromResponse(response);

        if (response.status === 401 && this.authProvider && !triedAuth) {
          this.resourceMetadataUrl = extractResourceMetadataUrl(response);
          try {
            const result = await this.authorizeOnce(this.resourceMetadataUrl);
            if (result !== 'AUTHORIZED') {
              const error = new UnauthorizedError();
              throw error;
            }
          } catch (error) {
            this.onerror?.(error);
            throw error;
          }
          return attempt(true);
        }

        // If server accepted the message (e.g. initialized notification), optionally (re)start inbound SSE
        if (response.status === 202) {
          // If inbound SSE was not available earlier (e.g. 405 before init), try again now
          // Do not await to avoid blocking send()
          if (!this.inboundSseConnection) {
            this.startInboundSse();
          }
          return;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => null);
          let errorMessage = `MCP HTTP Transport Error: POSTing to endpoint (HTTP ${response.status}): ${text}`;

          if (response.status === 404) {
            if (sessionIdForRequest) {
              this.expireSessionId(sessionIdForRequest);

              errorMessage +=
                '. The MCP session expired. Create a new client without `initialSessionId` to start a fresh session';
            } else {
              errorMessage +=
                '. This server does not support HTTP transport. Try using `sse` transport instead';
            }
          }

          const error = new MCPClientError({
            message: errorMessage,
            statusCode: response.status,
            url: this.url.href,
            responseBody: text ?? undefined,
          });
          this.onerror?.(error);
          throw error;
        }

        // Notifications (messages without 'id') don't expect a JSON-RPC response
        // Some servers return 200 with acknowledgment JSON instead of 202
        const isNotification = !('id' in message);
        if (isNotification) {
          return;
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          const messages: JSONRPCMessage[] = Array.isArray(data)
            ? data.map((message: unknown) => validateJSONRPCMessage(message))
            : [validateJSONRPCMessage(data)];
          for (const jsonRpcMessage of messages) {
            this.onmessage?.(jsonRpcMessage);
          }
          return;
        }

        if (contentType.includes('text/event-stream')) {
          if (!response.body) {
            const error = new MCPClientError({
              message:
                'MCP HTTP Transport Error: text/event-stream response without body',
              statusCode: response.status,
              url: this.url.href,
            });
            this.onerror?.(error);
            throw error;
          }

          const stream = response.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream());
          const reader = stream.getReader();

          const processEvents = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) return;
                const { event, data } = value;
                if (isMessageEvent(event)) {
                  try {
                    const jsonRpcMessage = await parseJSONRPCMessage(data);
                    this.onmessage?.(jsonRpcMessage);
                  } catch (error) {
                    const e = new MCPClientError({
                      message:
                        'MCP HTTP Transport Error: Failed to parse message',
                      cause: error,
                    });
                    this.onerror?.(e);
                  }
                }
              }
            } catch (error) {
              if (error instanceof Error && error.name === 'AbortError') {
                return;
              }
              this.onerror?.(error);
            }
          };

          void processEvents().catch(error => {
            if (error instanceof Error && error.name === 'AbortError') {
              return;
            }
            this.onerror?.(error);
          });
          return;
        }

        const error = new MCPClientError({
          message: `MCP HTTP Transport Error: Unexpected content type: ${contentType}`,
          statusCode: response.status,
          url: this.url.href,
        });
        this.onerror?.(error);
        throw error;
      } catch (error) {
        this.onerror?.(error);
        throw error;
      }
    };

    await attempt();
  }

  private getNextReconnectionDelay(attempt: number): number {
    const {
      initialReconnectionDelay,
      reconnectionDelayGrowFactor,
      maxReconnectionDelay,
    } = this.reconnectionOptions;
    return Math.min(
      initialReconnectionDelay * Math.pow(reconnectionDelayGrowFactor, attempt),
      maxReconnectionDelay,
    );
  }

  private scheduleInboundSseReconnection(): void {
    const { maxRetries } = this.reconnectionOptions;
    if (maxRetries > 0 && this.inboundReconnectAttempts >= maxRetries) {
      this.onerror?.(
        new MCPClientError({
          message: `MCP HTTP Transport Error: Maximum reconnection attempts (${maxRetries}) exceeded.`,
        }),
      );
      return;
    }

    const delay = this.getNextReconnectionDelay(this.inboundReconnectAttempts);
    this.inboundReconnectAttempts += 1;
    setTimeout(() => {
      if (this.abortController?.signal.aborted) return;
      this.startInboundSse(false, this.lastInboundEventId);
    }, delay);
  }

  private startInboundSse(
    triedAuth: boolean = false,
    resumeToken?: string,
  ): void {
    void this.openInboundSse(triedAuth, resumeToken).catch(error => {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      this.onerror?.(error);
    });
  }

  // Open optional inbound SSE stream; best-effort and resumable
  private async openInboundSse(
    triedAuth: boolean = false,
    resumeToken?: string,
  ): Promise<void> {
    try {
      const sessionIdForRequest = this.sessionId;
      const headers = await this.commonHeaders({
        base: {
          Accept: 'text/event-stream',
        },
      });
      if (resumeToken) {
        headers['last-event-id'] = resumeToken;
      }

      const response = await this.fetchFn(this.url.href, {
        method: 'GET',
        headers,
        signal: this.abortController?.signal,
        redirect: this.redirectMode,
      });

      this.applySessionIdFromResponse(response);

      if (response.status === 401 && this.authProvider && !triedAuth) {
        this.resourceMetadataUrl = extractResourceMetadataUrl(response);
        try {
          const result = await this.authorizeOnce(this.resourceMetadataUrl);
          if (result !== 'AUTHORIZED') {
            const error = new UnauthorizedError();
            this.onerror?.(error);
            return;
          }
        } catch (error) {
          this.onerror?.(error);
          return;
        }
        return this.openInboundSse(true, resumeToken);
      }

      if (response.status === 405) {
        return;
      }

      if (!response.ok || !response.body) {
        if (response.status === 404 && sessionIdForRequest) {
          this.expireSessionId(sessionIdForRequest);
        }

        const error = new MCPClientError({
          message: `MCP HTTP Transport Error: GET SSE failed: ${response.status} ${response.statusText}`,
          statusCode: response.status,
          url: this.url.href,
        });
        this.onerror?.(error);
        return;
      }

      const stream = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream());
      const reader = stream.getReader();

      const processEvents = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) return;
            const { event, data, id } = value as {
              event?: string;
              data: string;
              id?: string;
            };

            if (id) {
              this.lastInboundEventId = id;
            }

            if (isMessageEvent(event)) {
              try {
                const jsonRpcMessage = await parseJSONRPCMessage(data);
                this.onmessage?.(jsonRpcMessage);
              } catch (error) {
                const e = new MCPClientError({
                  message: 'MCP HTTP Transport Error: Failed to parse message',
                  cause: error,
                });
                this.onerror?.(e);
              }
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          this.onerror?.(error);
          if (!this.abortController?.signal.aborted) {
            this.scheduleInboundSseReconnection();
          }
        }
      };

      this.inboundSseConnection = {
        close: () => {
          void reader.cancel().catch(error => {
            if (error instanceof Error && error.name === 'AbortError') {
              return;
            }
            this.onerror?.(error);
          });
        },
      };
      this.inboundReconnectAttempts = 0;
      void processEvents().catch(error => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        this.onerror?.(error);
        if (!this.abortController?.signal.aborted) {
          this.scheduleInboundSseReconnection();
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      this.onerror?.(error);
      if (!this.abortController?.signal.aborted) {
        this.scheduleInboundSseReconnection();
      }
    }
  }
}
