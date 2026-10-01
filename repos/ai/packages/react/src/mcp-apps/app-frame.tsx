import { useEffect, useMemo, useRef } from 'react';
import { MCPAppBridge } from './bridge';
import {
  MCP_APP_DEFAULT_INNER_SANDBOX,
  MCP_APP_DEFAULT_OUTER_SANDBOX,
  getMCPAppAllowAttribute,
  getMCPAppCSP,
} from './sandbox';
import type { MCPAppFrameProps } from './types';
import { normalizeMCPAppToolResult } from './utils';

/**
 * Derives the concrete origin of the sandbox proxy from its URL, so outbound
 * postMessage targets a specific origin instead of `'*'` and inbound messages
 * can be origin-checked. The proxy must be served from a stable, concrete
 * origin (the default outer sandbox keeps `allow-same-origin`). Falls back to
 * the host origin on a malformed URL, never `'*'`.
 */
function deriveTargetOrigin(url: string): string {
  const location = typeof window !== 'undefined' ? window.location : undefined;
  try {
    return new URL(url, location?.href).origin;
  } catch {
    return location?.origin ?? 'null';
  }
}

function sendToolState({
  bridge,
  input,
  output,
}: {
  bridge?: MCPAppBridge;
  input: unknown;
  output: unknown;
}) {
  if (bridge == null) {
    return;
  }

  if (input !== undefined) {
    bridge.sendToolInput(input);
  }

  if (output !== undefined) {
    bridge.sendToolResult(normalizeMCPAppToolResult(output));
  }
}

export function MCPAppFrame({
  app,
  resource,
  input,
  output,
  sandbox,
  handlers,
  hostInfo,
  hostContext,
}: MCPAppFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<MCPAppBridge | undefined>(undefined);
  const inputRef = useRef(input);
  const outputRef = useRef(output);
  const hostContextRef = useRef(hostContext);
  const initializedRef = useRef(false);
  inputRef.current = input;
  outputRef.current = output;
  hostContextRef.current = hostContext;
  const sandboxUrl = String(sandbox.url);
  const targetOrigin = sandbox.targetOrigin ?? deriveTargetOrigin(sandboxUrl);
  const resourceCSP = getMCPAppCSP(resource.meta?.csp);
  const resourceAllow = getMCPAppAllowAttribute(
    resource.meta?.permissions,
    sandbox.allowedPermissions,
  );
  const innerSandbox = sandbox.innerSandbox ?? MCP_APP_DEFAULT_INNER_SANDBOX;
  const bridgeHandlers = useMemo(
    () => ({
      ...handlers,
      onInitialized: () => {
        initializedRef.current = true;
        handlers?.onInitialized?.();
        sendToolState({
          bridge: bridgeRef.current,
          input: inputRef.current,
          output: outputRef.current,
        });
      },
    }),
    [handlers],
  );
  const bridgeHandlersRef = useRef(bridgeHandlers);
  bridgeHandlersRef.current = bridgeHandlers;

  useEffect(() => {
    const iframe = iframeRef.current;
    const targetWindow = iframe?.contentWindow;
    if (targetWindow == null) {
      return;
    }

    initializedRef.current = false;

    const bridge = new MCPAppBridge({
      targetWindow,
      targetOrigin,
      handlers: bridgeHandlersRef.current,
      hostInfo,
      hostContext: hostContextRef.current,
    });
    bridgeRef.current = bridge;

    const onMessage = (event: MessageEvent) => {
      // Only handle messages from the proxy window and expected origin.
      if (!bridge.acceptsEvent(event)) {
        return;
      }

      if (
        event.data?.jsonrpc === '2.0' &&
        event.data.method === 'ui/notifications/sandbox-proxy-ready'
      ) {
        bridge.sendSandboxResourceReady({
          html: resource.html,
          csp: resourceCSP,
          sandbox: innerSandbox,
          allow: resourceAllow,
        });
        return;
      }

      bridge.handleMessage(event);
    };

    window.addEventListener('message', onMessage);

    return () => {
      initializedRef.current = false;
      window.removeEventListener('message', onMessage);
      void bridge.teardownResource().catch(() => {});
      bridge.close();
      bridgeRef.current = undefined;
    };
  }, [
    hostInfo,
    innerSandbox,
    resource.html,
    resourceAllow,
    resourceCSP,
    sandboxUrl,
    targetOrigin,
  ]);

  useEffect(() => {
    bridgeRef.current?.setHandlers(bridgeHandlers);
  }, [bridgeHandlers]);

  useEffect(() => {
    if (hostContext != null) {
      bridgeRef.current?.setHostContext(hostContext);
    }
  }, [hostContext]);

  useEffect(() => {
    if (initializedRef.current && input !== undefined) {
      bridgeRef.current?.sendToolInput(input);
    }
  }, [input]);

  useEffect(() => {
    if (initializedRef.current && output !== undefined) {
      bridgeRef.current?.sendToolResult(normalizeMCPAppToolResult(output));
    }
  }, [output]);

  return (
    <iframe
      ref={iframeRef}
      title="MCP App"
      aria-label={sandbox.title ?? app.resourceUri}
      src={sandboxUrl}
      className={sandbox.className}
      style={sandbox.style}
      // Permissions Policy is hierarchical: the outer frame must delegate a
      // feature for the proxy to re-delegate it to the inner app frame.
      allow={resourceAllow}
      sandbox={sandbox.outerSandbox ?? MCP_APP_DEFAULT_OUTER_SANDBOX}
    />
  );
}
