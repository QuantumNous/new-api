import { AISDKError } from '@ai-sdk/provider';

const name = 'AI_MCPClientError';
const marker = `vercel.ai.error.${name}`;
const symbol = Symbol.for(marker);

/**
 * An error occurred with the MCP client.
 */
export class MCPClientError extends AISDKError {
  private readonly [symbol] = true;
  readonly data?: unknown;

  /**
   * JSON-RPC error code from the server response, per the JSON-RPC 2.0
   * spec (e.g. `-32601` method-not-found, `-32602` invalid-params, or
   * MCP-specific codes such as `-32002` resource-not-found). This is the
   * application-level error code populated from `error.code` in the
   * server's JSON-RPC error payload. Distinct from `statusCode`, which
   * is the HTTP transport status.
   */
  readonly code?: number;

  /**
   * HTTP status code from the failed response, when the error originated
   * from the streamable HTTP transport. Undefined for stdio transport
   * errors and for failures that do not have an associated response
   * status (e.g. network errors, abort). Distinct from `code`, which is
   * the JSON-RPC application error code.
   */
  readonly statusCode?: number;

  /**
   * URL of the MCP endpoint the failing request was sent to, when the
   * error originated from an HTTP transport failure.
   */
  readonly url?: string;

  /**
   * Body of the failing HTTP response, decoded as text, when available.
   * Undefined when the body could not be read or the error did not have
   * an associated response.
   */
  readonly responseBody?: string;

  constructor({
    name = 'MCPClientError',
    message,
    cause,
    data,
    code,
    statusCode,
    url,
    responseBody,
  }: {
    name?: string;
    message: string;
    cause?: unknown;
    data?: unknown;
    code?: number;
    statusCode?: number;
    url?: string;
    responseBody?: string;
  }) {
    super({ name, message, cause });
    this.data = data;
    this.code = code;
    this.statusCode = statusCode;
    this.url = url;
    this.responseBody = responseBody;
  }

  static isInstance(error: unknown): error is MCPClientError {
    return AISDKError.hasMarker(error, marker);
  }
}
