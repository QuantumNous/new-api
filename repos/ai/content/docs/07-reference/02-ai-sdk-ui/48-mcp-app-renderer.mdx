---
title: experimental_MCPAppRenderer
description: API reference for rendering MCP Apps with @ai-sdk/react.
---

# `experimental_MCPAppRenderer`

<Note type="warning">
  `experimental_MCPAppRenderer` is experimental and may change in a future
  release.
</Note>

`experimental_MCPAppRenderer` renders an MCP App for an AI SDK tool UI part. It detects MCP App metadata on the tool part, loads the app resource, renders the app in a sandbox proxy iframe, and bridges MCP Apps JSON-RPC messages between the iframe and your host application.

For tool parts without MCP App metadata, the component renders the `fallback`.

## Import

<Snippet
  text={`import { experimental_MCPAppRenderer as MCPAppRenderer } from "@ai-sdk/react"`}
  prompt={false}
/>

## Example

```tsx
'use client';

import {
  experimental_MCPAppRenderer as MCPAppRenderer,
  type MCPAppBridgeHandlers,
  type MCPAppMetadata,
  type MCPAppResource,
  type MCPAppSandboxConfig,
} from '@ai-sdk/react';
import { isToolUIPart } from 'ai';

const sandbox = {
  url: '/mcp-app-sandbox',
  className: 'h-80 w-full rounded-lg border',
  style: { border: 0 },
} satisfies MCPAppSandboxConfig;

async function loadResource(app: MCPAppMetadata): Promise<MCPAppResource> {
  const response = await fetch('/api/mcp-app-host/read-resource', {
    method: 'POST',
    body: JSON.stringify({ uri: app.resourceUri }),
  });

  if (!response.ok) {
    throw new Error('Failed to load MCP App resource');
  }

  return response.json();
}

const handlers: MCPAppBridgeHandlers = {
  callTool: params =>
    fetch('/api/mcp-app-host/call-tool', {
      method: 'POST',
      body: JSON.stringify(params),
    }).then(response => response.json()),
  openLink: ({ url }) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    return {};
  },
};

export function MessagePart({ part }: { part: unknown }) {
  if (!isToolUIPart(part)) {
    return null;
  }

  return (
    <MCPAppRenderer
      part={part}
      loadResource={loadResource}
      handlers={handlers}
      sandbox={sandbox}
      fallback={null}
    />
  );
}
```

## Props

<PropertiesTable
  content={[
    {
      name: 'part',
      type: 'ToolUIPart<UITools> | DynamicToolUIPart',
      description:
        'The AI SDK tool UI part. The renderer looks for MCP App metadata in `part.toolMetadata.mcp.app`.',
    },
    {
      name: 'sandbox',
      type: 'MCPAppSandboxConfig',
      description:
        'Configuration for the outer sandbox proxy iframe used to host the app.',
    },
    {
      name: 'resource',
      type: 'MCPAppResource',
      isOptional: true,
      description:
        'A preloaded MCP App resource. Provide either `resource` or `loadResource`.',
    },
    {
      name: 'loadResource',
      type: '(app: MCPAppMetadata) => Promise<MCPAppResource>',
      isOptional: true,
      description:
        'Loads the MCP App resource for the app metadata found on the tool part.',
    },
    {
      name: 'handlers',
      type: 'MCPAppBridgeHandlers',
      isOptional: true,
      description:
        'Callbacks used to handle iframe requests such as `tools/call`, `resources/read`, `ui/open-link`, and display mode changes.',
    },
    {
      name: 'hostInfo',
      type: '{ name: string; version: string }',
      isOptional: true,
      description:
        'Host identity returned to the app during the `ui/initialize` handshake.',
    },
    {
      name: 'hostContext',
      type: 'MCPAppHostContext',
      isOptional: true,
      description:
        'Host context sent to the app, such as theme, display mode, and available display modes.',
    },
    {
      name: 'fallback',
      type: 'ReactNode',
      isOptional: true,
      description:
        'Rendered while the resource is loading, when loading fails, or when the tool part is not an MCP App.',
    },
  ]}
/>

## Sandbox Config

<PropertiesTable
  content={[
    {
      name: 'url',
      type: 'string | URL',
      description:
        'The URL of the sandbox proxy iframe. The proxy receives app HTML from the host and creates the inner app iframe.',
    },
    {
      name: 'title',
      type: 'string',
      isOptional: true,
      description: 'Accessible iframe title.',
    },
    {
      name: 'className',
      type: 'string',
      isOptional: true,
      description: 'Class name applied to the outer iframe.',
    },
    {
      name: 'style',
      type: 'CSSProperties',
      isOptional: true,
      description: 'Inline styles applied to the outer iframe.',
    },
    {
      name: 'targetOrigin',
      type: 'string',
      isOptional: true,
      description:
        'Target origin used for `postMessage`. Defaults to `*`; set this to your sandbox origin in production.',
    },
    {
      name: 'outerSandbox',
      type: 'string',
      isOptional: true,
      description:
        'Sandbox attribute for the outer proxy iframe. Defaults to `allow-scripts allow-same-origin allow-forms`.',
    },
    {
      name: 'innerSandbox',
      type: 'string',
      isOptional: true,
      description:
        'Sandbox attribute sent to the proxy for the inner app iframe. Defaults to `allow-scripts allow-forms`.',
    },
  ]}
/>

## Bridge Handlers

`experimental_MCPAppRenderer` uses these handlers to respond to iframe requests. In production, server-backed handlers should validate authorization and MCP Apps tool visibility before calling the MCP server.

<PropertiesTable
  content={[
    {
      name: 'allowedTools',
      type: 'string[]',
      isOptional: true,
      description:
        'Optional client-side allowlist checked before forwarding `tools/call` requests.',
    },
    {
      name: 'callTool',
      type: '(params: MCPAppToolCallParams) => Promise<unknown> | unknown',
      isOptional: true,
      description: 'Handles app-initiated `tools/call` requests.',
    },
    {
      name: 'readResource',
      type: '(params: { uri: string }) => Promise<unknown> | unknown',
      isOptional: true,
      description: 'Handles app-initiated `resources/read` requests.',
    },
    {
      name: 'listResources',
      type: '(params?: unknown) => Promise<unknown> | unknown',
      isOptional: true,
      description: 'Handles app-initiated `resources/list` requests.',
    },
    {
      name: 'openLink',
      type: '(params: { url: string }) => Promise<unknown> | unknown',
      isOptional: true,
      description: 'Handles app-initiated `ui/open-link` requests.',
    },
    {
      name: 'sendMessage',
      type: '(params: unknown) => Promise<unknown> | unknown',
      isOptional: true,
      description: 'Handles app-initiated `ui/message` requests.',
    },
    {
      name: 'updateModelContext',
      type: '(params: unknown) => Promise<unknown> | unknown',
      isOptional: true,
      description: 'Handles app-initiated `ui/update-model-context` requests.',
    },
    {
      name: 'requestDisplayMode',
      type: "(params: { mode: 'inline' | 'fullscreen' | 'pip' }) => Promise<{ mode: MCPAppDisplayMode }> | { mode: MCPAppDisplayMode }",
      isOptional: true,
      description: 'Handles app-initiated `ui/request-display-mode` requests.',
    },
    {
      name: 'onSizeChange',
      type: '(params: { width?: number; height?: number }) => void',
      isOptional: true,
      description: 'Called when the app sends a size change notification.',
    },
    {
      name: 'onInitialized',
      type: '() => void',
      isOptional: true,
      description: 'Called after the app sends `ui/notifications/initialized`.',
    },
    {
      name: 'onRequestTeardown',
      type: '(params: unknown) => void',
      isOptional: true,
      description: 'Called when the app requests teardown.',
    },
    {
      name: 'onLog',
      type: '(params: unknown) => void',
      isOptional: true,
      description: 'Called when the app sends a log notification.',
    },
    {
      name: 'onError',
      type: '(error: Error) => void',
      isOptional: true,
      description:
        'Called when a supported iframe request fails while being handled.',
    },
  ]}
/>

## See Also

<ExampleLinks
  examples={[
    {
      title: 'MCP Apps guide',
      link: '/docs/ai-sdk-core/mcp-apps',
    },
    {
      title: 'MCP Apps helpers',
      link: '/docs/reference/ai-sdk-core/mcp-apps',
    },
  ]}
/>
