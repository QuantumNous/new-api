import { isJSONObject } from '@ai-sdk/provider';
import type {
  MCPAppBridgeHandlers,
  MCPAppHostContext,
  MCPAppJsonRpcMessage,
  MCPAppJsonRpcNotification,
  MCPAppJsonRpcRequest,
  MCPAppJsonRpcResponse,
  MCPAppToolCallParams,
} from './types';

const MCP_APP_PROTOCOL_VERSION = '2026-01-26';

/**
 * Checks whether an iframe message looks like a JSON-RPC 2.0 message.
 */
function isJsonRpcMessage(value: unknown): value is MCPAppJsonRpcMessage {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'jsonrpc' in value &&
    value.jsonrpc === '2.0'
  );
}

/**
 * Checks whether a JSON-RPC message expects a response.
 */
function isRequest(
  message: MCPAppJsonRpcMessage,
): message is MCPAppJsonRpcRequest {
  return 'method' in message && 'id' in message;
}

/**
 * Checks whether a JSON-RPC message is a fire-and-forget notification.
 */
function isNotification(
  message: MCPAppJsonRpcMessage,
): message is MCPAppJsonRpcNotification {
  return 'method' in message && !('id' in message);
}

/**
 * Normalizes unknown thrown values into an `Error`.
 */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Validates the params for app-initiated `tools/call` requests.
 */
function assertToolCallParams(params: unknown): MCPAppToolCallParams {
  if (!isJSONObject(params) || typeof params.name !== 'string') {
    throw new Error('Invalid tools/call params');
  }

  return {
    name: params.name,
    arguments: isJSONObject(params.arguments) ? params.arguments : undefined,
  };
}

/**
 * Validates `resources/read` params and limits reads to `ui://` app resources.
 */
function assertResourceReadParams(params: unknown): { uri: string } {
  if (!isJSONObject(params) || typeof params.uri !== 'string') {
    throw new Error('Invalid resources/read params');
  }
  if (!params.uri.startsWith('ui://')) {
    throw new Error(
      `resources/read is limited to ui:// resources: ${params.uri}`,
    );
  }
  return { uri: params.uri };
}

/**
 * Validates `ui/open-link` params and allows only `https:`/`http:`/`mailto:`
 * URLs.
 */
function assertOpenLinkParams(params: unknown): { url: string } {
  if (!isJSONObject(params) || typeof params.url !== 'string') {
    throw new Error('Invalid ui/open-link params');
  }

  let scheme: string;
  try {
    scheme = new URL(params.url).protocol;
  } catch {
    throw new Error(`Invalid ui/open-link url: ${params.url}`);
  }

  if (scheme !== 'https:' && scheme !== 'http:' && scheme !== 'mailto:') {
    throw new Error(`Disallowed ui/open-link scheme: ${scheme}`);
  }

  return { url: params.url };
}

/**
 * Validates params for `ui/request-display-mode`.
 */
function assertDisplayModeParams(params: unknown): {
  mode: 'inline' | 'fullscreen' | 'pip';
} {
  if (
    !isJSONObject(params) ||
    (params.mode !== 'inline' &&
      params.mode !== 'fullscreen' &&
      params.mode !== 'pip')
  ) {
    throw new Error('Invalid ui/request-display-mode params');
  }
  return { mode: params.mode };
}

/**
 * Host-side JSON-RPC bridge for one MCP App iframe.
 *
 * It handles the MCP Apps initialization handshake, sends tool input/result
 * notifications to the iframe, and proxies allowed iframe requests through
 * host-provided callbacks.
 *
 * @example
 * ```ts
 * const bridge = new MCPAppBridge({
 *   targetWindow: iframe.contentWindow!,
 *   handlers: {
 *     allowedTools: ['refreshDashboardData'],
 *     callTool: params => client.callTool(params),
 *   },
 * });
 *
 * window.addEventListener('message', event => bridge.handleMessage(event));
 * bridge.sendToolInput({ topic: 'usage' });
 * ```
 */
export class MCPAppBridge {
  private initialized = false;
  private pendingNotifications: MCPAppJsonRpcNotification[] = [];
  private nextRequestId = 0;
  private pendingResponses = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor({
    targetWindow,
    targetOrigin = '*',
    handlers = {},
    hostInfo = { name: 'ai-sdk-react', version: '1.0.0' },
    hostContext = { displayMode: 'inline' },
  }: {
    targetWindow: Window;
    targetOrigin?: string;
    handlers?: MCPAppBridgeHandlers;
    hostInfo?: { name: string; version: string };
    hostContext?: MCPAppHostContext;
  }) {
    this.targetWindow = targetWindow;
    this.targetOrigin = targetOrigin;
    this.handlers = handlers;
    this.hostInfo = hostInfo;
    this.hostContext = hostContext;
  }

  private targetWindow: Window;
  private targetOrigin: string;
  private handlers: MCPAppBridgeHandlers;
  private hostInfo: { name: string; version: string };
  private hostContext: MCPAppHostContext;

  /**
   * Replaces the callbacks used to serve iframe requests.
   */
  setHandlers(handlers: MCPAppBridgeHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Updates host context and notifies the iframe after initialization.
   *
   * @example
   * ```ts
   * bridge.setHostContext({ theme: 'dark', displayMode: 'inline' });
   * ```
   */
  setHostContext(hostContext: MCPAppHostContext): void {
    this.hostContext = hostContext;
    this.sendNotification({
      method: 'ui/notifications/host-context-changed',
      params: hostContext,
    });
  }

  /**
   * Whether a `message` event came from the expected proxy window and origin.
   * The origin check is skipped only when `targetOrigin` is the `'*'` default.
   * Callers that intercept events before {@link handleMessage} share this check.
   */
  acceptsEvent(event: MessageEvent): boolean {
    return (
      event.source === this.targetWindow &&
      (this.targetOrigin === '*' || event.origin === this.targetOrigin)
    );
  }

  /**
   * Processes one `message` event from the sandbox proxy iframe.
   */
  handleMessage(event: MessageEvent): void {
    if (!this.acceptsEvent(event) || !isJsonRpcMessage(event.data)) {
      return;
    }

    const message = event.data;

    if ('result' in message || 'error' in message) {
      this.handleResponse(message);
      return;
    }

    if (isRequest(message)) {
      void this.handleRequest(message);
      return;
    }

    if (isNotification(message)) {
      this.handleNotification(message);
    }
  }

  /**
   * Sends app HTML and sandbox settings to the sandbox proxy.
   */
  sendSandboxResourceReady(params: unknown): void {
    this.post({
      jsonrpc: '2.0',
      method: 'ui/notifications/sandbox-resource-ready',
      params,
    });
  }

  /**
   * Sends final tool arguments to the MCP App.
   */
  sendToolInput(input: unknown): void {
    this.sendNotification({
      method: 'ui/notifications/tool-input',
      params: { arguments: input },
    });
  }

  /**
   * Sends a completed MCP tool result to the MCP App.
   */
  sendToolResult(result: unknown): void {
    this.sendNotification({
      method: 'ui/notifications/tool-result',
      params: result,
    });
  }

  /**
   * Notifies the MCP App that the related tool call was cancelled.
   */
  sendToolCancelled(reason?: string): void {
    this.sendNotification({
      method: 'ui/notifications/tool-cancelled',
      params: reason != null ? { reason } : {},
    });
  }

  /**
   * Requests graceful teardown before the host removes the iframe.
   */
  teardownResource(): Promise<unknown> {
    return this.request('ui/resource-teardown', {});
  }

  /**
   * Rejects pending bridge requests and clears queued notifications.
   */
  close(): void {
    for (const pending of this.pendingResponses.values()) {
      pending.reject(new Error('MCP App bridge closed'));
    }
    this.pendingResponses.clear();
    this.pendingNotifications = [];
  }

  /**
   * Resolves or rejects a host-initiated request when the iframe responds.
   */
  private handleResponse(response: MCPAppJsonRpcResponse): void {
    const pending = this.pendingResponses.get(response.id);
    if (pending == null) {
      return;
    }

    this.pendingResponses.delete(response.id);

    if (response.error != null) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Runs a handler for an iframe request and posts the JSON-RPC response.
   */
  private async handleRequest(request: MCPAppJsonRpcRequest): Promise<void> {
    try {
      const result = await this.getRequestResult(request);
      this.post({ jsonrpc: '2.0', id: request.id, result });
    } catch (error) {
      const normalizedError = toError(error);
      this.handlers.onError?.(normalizedError);
      this.post({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: normalizedError.message },
      });
    }
  }

  /**
   * Maps supported iframe request methods to host callbacks.
   */
  private async getRequestResult(
    request: MCPAppJsonRpcRequest,
  ): Promise<unknown> {
    switch (request.method) {
      case 'ui/initialize':
        return {
          protocolVersion: MCP_APP_PROTOCOL_VERSION,
          hostCapabilities: {
            ...(this.handlers.callTool != null ? { serverTools: {} } : {}),
            ...(this.handlers.readResource != null
              ? { serverResources: {} }
              : {}),
            ...(this.handlers.onLog != null ? { logging: {} } : {}),
          },
          hostInfo: this.hostInfo,
          hostContext: this.hostContext,
        };

      case 'tools/call': {
        if (this.handlers.callTool == null) {
          throw new Error('No tools/call handler configured');
        }
        const params = assertToolCallParams(request.params);
        // Deny-by-default: the (untrusted) MCP App may only invoke tools the
        // host has explicitly allow-listed. Omitting `allowedTools` exposes no
        // tools, rather than forwarding every requested tool to `callTool`.
        if (
          this.handlers.allowedTools == null ||
          !this.handlers.allowedTools.includes(params.name)
        ) {
          throw new Error(`Tool is not app-visible: ${params.name}`);
        }
        return this.handlers.callTool(params);
      }

      case 'resources/read':
        if (this.handlers.readResource == null) {
          throw new Error('No resources/read handler configured');
        }
        return this.handlers.readResource(
          assertResourceReadParams(request.params),
        );

      case 'resources/list':
        if (this.handlers.listResources == null) {
          throw new Error('No resources/list handler configured');
        }
        return this.handlers.listResources(request.params);

      case 'ui/open-link':
        if (this.handlers.openLink == null) {
          throw new Error('No ui/open-link handler configured');
        }
        return this.handlers.openLink(assertOpenLinkParams(request.params));

      case 'ui/message':
        return this.handlers.sendMessage?.(request.params) ?? {};

      case 'ui/update-model-context':
        return this.handlers.updateModelContext?.(request.params) ?? {};

      case 'ui/request-display-mode':
        return (
          this.handlers.requestDisplayMode?.(
            assertDisplayModeParams(request.params),
          ) ?? { mode: this.hostContext.displayMode ?? 'inline' }
        );

      default:
        throw new Error(`Unsupported MCP App method: ${request.method}`);
    }
  }

  /**
   * Handles iframe lifecycle and telemetry notifications.
   */
  private handleNotification(notification: MCPAppJsonRpcNotification): void {
    switch (notification.method) {
      case 'ui/notifications/initialized':
        this.initialized = true;
        this.flushNotifications();
        this.handlers.onInitialized?.();
        break;
      case 'ui/notifications/size-changed':
        this.handlers.onSizeChange?.(
          notification.params as { width?: number; height?: number },
        );
        break;
      case 'ui/notifications/request-teardown':
        this.handlers.onRequestTeardown?.(notification.params);
        break;
      case 'notifications/message':
        this.handlers.onLog?.(notification.params);
        break;
    }
  }

  /**
   * Sends a host-to-iframe notification, queueing it until app initialization.
   */
  private sendNotification(
    notification: Omit<MCPAppJsonRpcNotification, 'jsonrpc'>,
  ) {
    const message = { jsonrpc: '2.0' as const, ...notification };
    if (!this.initialized && !notification.method.includes('sandbox')) {
      this.pendingNotifications.push(message);
      return;
    }
    this.post(message);
  }

  /**
   * Sends notifications that were queued before `ui/notifications/initialized`.
   */
  private flushNotifications(): void {
    const notifications = this.pendingNotifications;
    this.pendingNotifications = [];
    for (const notification of notifications) {
      this.post(notification);
    }
  }

  /**
   * Sends a host-initiated JSON-RPC request to the iframe.
   */
  private request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextRequestId++;
    this.post({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve, reject) => {
      this.pendingResponses.set(id, { resolve, reject });
    });
  }

  /**
   * Posts a JSON-RPC message to the sandbox proxy iframe.
   */
  private post(message: MCPAppJsonRpcMessage): void {
    this.targetWindow.postMessage(message, this.targetOrigin);
  }
}
