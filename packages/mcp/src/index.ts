export { validateJSONRPCMessage } from './tool/json-rpc-message';
export type {
  JSONRPCError,
  JSONRPCMessage,
  JSONRPCNotification,
  JSONRPCRequest,
  JSONRPCResponse,
} from './tool/json-rpc-message';

// Stable exports
export {
  createMCPClient,
  type MCPClientConfig,
  type MCPClient,
} from './tool/mcp-client';
export {
  MCP_APP_MIME_TYPE,
  mcpAppClientCapabilities,
  readMCPAppResource,
  splitMCPAppTools,
  type MCPAppResource,
  type MCPAppResourceCSP,
  type MCPAppResourceMeta,
} from './tool/mcp-apps';
export {
  fingerprintMCPAppResource,
  detectMCPAppResourceDrift,
} from './tool/mcp-app-fingerprint';
export { ElicitationRequestSchema, ElicitResultSchema } from './tool/types';
export type {
  CallToolResult,
  CompleteRequestParams,
  CompleteResult,
  Configuration,
  ElicitationRequest,
  ElicitResult,
  InitializeResult,
  ListToolsResult,
  McpProviderMetadata,
  ClientCapabilities as MCPClientCapabilities,
} from './tool/types';
export { auth, UnauthorizedError } from './tool/oauth';
export type {
  OAuthAuthorizationServerInformation,
  OAuthClientProvider,
} from './tool/oauth';
export type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from './tool/oauth-types';
export type { MCPTransport } from './tool/mcp-transport';

/**
 * @deprecated Use `createMCPClient` instead. Will be removed in a future version.
 */
export { createMCPClient as experimental_createMCPClient } from './tool/mcp-client';

/**
 * @deprecated Use `MCPClientConfig` instead. Will be removed in a future version.
 */
export type { MCPClientConfig as experimental_MCPClientConfig } from './tool/mcp-client';

/**
 * @deprecated Use `MCPClient` instead. Will be removed in a future version.
 */
export type { MCPClient as experimental_MCPClient } from './tool/mcp-client';

/**
 * @deprecated Use `MCPClientCapabilities` instead. Will be removed in a future version.
 */
export type { ClientCapabilities as experimental_MCPClientCapabilities } from './tool/types';
