import type { FetchFunction } from '@ai-sdk/provider-utils';
import { MCPClientError } from '../error/mcp-client-error';
import type { JSONRPCMessage } from './json-rpc-message';
import { SseMCPTransport } from './mcp-sse-transport';
import { HttpMCPTransport } from './mcp-http-transport';
import type { OAuthClientProvider } from './oauth';

/**
 * Transport interface for MCP (Model Context Protocol) communication.
 * Maps to the `Transport` interface in the MCP spec.
 */
export interface MCPTransport {
  /**
   * Initialize and start the transport
   */
  start(): Promise<void>;

  /**
   * Send a JSON-RPC message through the transport
   * @param message The JSON-RPC message to send
   */
  send(message: JSONRPCMessage): Promise<void>;

  /**
   * Clean up and close the transport
   */
  close(): Promise<void>;

  /**
   * Event handler for transport closure
   */
  onclose?: () => void;

  /**
   * Event handler for transport errors
   */
  onerror?: (error: Error) => void;

  /**
   * Event handler for received messages
   */
  onmessage?: (message: JSONRPCMessage) => void;

  /**
   * The protocol version negotiated during initialization.
   */
  protocolVersion?: string;

  /**
   * Set the protocol version negotiated during initialization.
   */
  setProtocolVersion?(version: string): void;
}

export type MCPTransportConfig = {
  type: 'sse' | 'http';

  /**
   * The URL of the MCP server.
   */
  url: string;

  /**
   * Additional HTTP headers to be sent with requests.
   */
  headers?: Record<string, string>;

  /**
   * An optional OAuth client provider to use for authentication for MCP servers.
   */
  authProvider?: OAuthClientProvider;

  /**
   * Controls how HTTP redirects are handled for transport requests.
   * - `'follow'`: Follow redirects automatically (standard fetch behavior).
   * - `'error'`: Reject any redirect response with an error.
   * @default 'error'
   */
  redirect?: 'follow' | 'error';

  /**
   * Initial MCP session id to send with resumed Streamable HTTP requests after
   * initialization.
   * Only used by the HTTP transport.
   */
  initialSessionId?: string;

  /**
   * Initial MCP protocol version to send before initialize negotiates one.
   * Only used by the HTTP transport.
   */
  initialProtocolVersion?: string;

  /**
   * Called when the Streamable HTTP server creates, changes, or clears the MCP
   * session id.
   * Only used by the HTTP transport.
   */
  onSessionIdChange?: (sessionId: string | undefined) => void;

  /**
   * Called when a Streamable HTTP request returns 404 for an existing MCP
   * session id. The transport clears the session id before reporting the
   * underlying HTTP error.
   * Only used by the HTTP transport.
   */
  onSessionExpired?: (sessionId: string) => void;

  /**
   * Whether close() should send DELETE for the current MCP session id.
   * Set to false when the application intends to reattach to the session later.
   * Only used by the HTTP transport.
   * @default true
   */
  terminateSessionOnClose?: boolean;

  /**
   * Optional custom fetch implementation to use for HTTP requests.
   * Useful for runtimes that need a request-local fetch.
   * @default globalThis.fetch
   */
  fetch?: FetchFunction;
};

export function createMcpTransport(config: MCPTransportConfig): MCPTransport {
  switch (config.type) {
    case 'sse':
      return new SseMCPTransport(config);
    case 'http':
      return new HttpMCPTransport(config);
    default:
      throw new MCPClientError({
        message:
          'Unsupported or invalid transport configuration. If you are using a custom transport, make sure it implements the MCPTransport interface.',
      });
  }
}

export function isCustomMcpTransport(
  transport: MCPTransportConfig | MCPTransport,
): transport is MCPTransport {
  return (
    'start' in transport &&
    typeof transport.start === 'function' &&
    'send' in transport &&
    typeof transport.send === 'function' &&
    'close' in transport &&
    typeof transport.close === 'function'
  );
}
