import type { MCPAppResource } from '@ai-sdk/mcp';
import type { DynamicToolUIPart, ToolUIPart, UITools } from 'ai';
import type { CSSProperties, ReactNode } from 'react';

export type { MCPAppResource };

export type MCPAppDisplayMode = 'inline' | 'fullscreen' | 'pip';

export type MCPAppMetadata = {
  resourceUri: string;
  mimeType: MCPAppResource['mimeType'];
  visibility?: Array<'model' | 'app'>;
};

export type MCPAppHostContext = {
  theme?: 'light' | 'dark';
  displayMode?: MCPAppDisplayMode;
  availableDisplayModes?: MCPAppDisplayMode[];
  [key: string]: unknown;
};

export type MCPAppToolCallParams = {
  name: string;
  arguments?: Record<string, unknown>;
};

export type MCPAppBridgeHandlers = {
  /**
   * Tools the MCP App is allowed to invoke via `tools/call`. Deny-by-default:
   * if omitted, the (untrusted) app cannot call any tool. List only the tools
   * the app is meant to see.
   */
  allowedTools?: string[];
  callTool?: (params: MCPAppToolCallParams) => Promise<unknown> | unknown;
  readResource?: (params: { uri: string }) => Promise<unknown> | unknown;
  listResources?: (params?: unknown) => Promise<unknown> | unknown;
  openLink?: (params: { url: string }) => Promise<unknown> | unknown;
  sendMessage?: (params: unknown) => Promise<unknown> | unknown;
  updateModelContext?: (params: unknown) => Promise<unknown> | unknown;
  requestDisplayMode?: (params: {
    mode: MCPAppDisplayMode;
  }) => Promise<{ mode: MCPAppDisplayMode }> | { mode: MCPAppDisplayMode };
  onSizeChange?: (params: { width?: number; height?: number }) => void;
  onInitialized?: () => void;
  onRequestTeardown?: (params: unknown) => void;
  onLog?: (params: unknown) => void;
  onError?: (error: Error) => void;
};

export type MCPAppSandboxConfig = {
  url: string | URL;
  title?: string;
  className?: string;
  style?: CSSProperties;
  targetOrigin?: string;
  outerSandbox?: string;
  innerSandbox?: string;
};

export type MCPAppFrameProps = {
  app: MCPAppMetadata;
  resource: MCPAppResource;
  input?: unknown;
  output?: unknown;
  sandbox: MCPAppSandboxConfig;
  handlers?: MCPAppBridgeHandlers;
  hostInfo?: { name: string; version: string };
  hostContext?: MCPAppHostContext;
};

export type MCPAppRendererProps = {
  part: ToolUIPart<UITools> | DynamicToolUIPart;
  sandbox: MCPAppSandboxConfig;
  resource?: MCPAppResource;
  loadResource?: (app: MCPAppMetadata) => Promise<MCPAppResource>;
  handlers?: MCPAppBridgeHandlers;
  hostInfo?: { name: string; version: string };
  hostContext?: MCPAppHostContext;
  fallback?: ReactNode;
};

export type MCPAppJsonRpcRequest = {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
};

export type MCPAppJsonRpcNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
};

export type MCPAppJsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type MCPAppJsonRpcMessage =
  | MCPAppJsonRpcRequest
  | MCPAppJsonRpcNotification
  | MCPAppJsonRpcResponse;
