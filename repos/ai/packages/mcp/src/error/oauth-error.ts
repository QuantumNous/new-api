import { AISDKError } from '@ai-sdk/provider';

const name = 'AI_MCPClientOAuthError';
const marker = `vercel.ai.error.${name}`;
const symbol = Symbol.for(marker);

/**
 * An error occurred with the MCP client within the OAuth flow.
 */
export class MCPClientOAuthError extends AISDKError {
  private readonly [symbol] = true;

  constructor({
    name = 'MCPClientOAuthError',
    message,
    cause,
  }: {
    name?: string;
    message: string;
    cause?: unknown;
  }) {
    super({ name, message, cause });
  }

  static isInstance(error: unknown): error is MCPClientOAuthError {
    return AISDKError.hasMarker(error, marker);
  }
}
export class ServerError extends MCPClientOAuthError {
  static errorCode = 'server_error';
}

export class InvalidClientError extends MCPClientOAuthError {
  static errorCode = 'invalid_client';
}

export class InvalidGrantError extends MCPClientOAuthError {
  static errorCode = 'invalid_grant';
}

export class UnauthorizedClientError extends MCPClientOAuthError {
  static errorCode = 'unauthorized_client';
}

export const OAUTH_ERRORS = {
  [ServerError.errorCode]: ServerError,
  [InvalidClientError.errorCode]: InvalidClientError,
  [InvalidGrantError.errorCode]: InvalidGrantError,
  [UnauthorizedClientError.errorCode]: UnauthorizedClientError,
};
