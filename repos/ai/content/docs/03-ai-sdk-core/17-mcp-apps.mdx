---
title: MCP Apps
description: Learn how to connect to MCP Apps and render interactive tool UIs with the AI SDK.
---

# MCP Apps

MCP Apps extend [Model Context Protocol (MCP)](/docs/ai-sdk-core/mcp-tools) tools with interactive UI resources. The model still calls ordinary MCP tools, but tools can point to a `ui://` resource containing HTML that your app renders in a sandboxed iframe.

The AI SDK provides two pieces for building MCP Apps hosts:

- [`@ai-sdk/mcp`](/docs/reference/ai-sdk-core/mcp-apps) helpers for advertising MCP Apps support, filtering model-visible and app-visible tools, and reading `ui://` resources.
- [`@ai-sdk/react`](/docs/reference/ai-sdk-ui/mcp-app-renderer) components for rendering the app iframe and bridging MCP Apps JSON-RPC messages.

## Host Flow

An MCP Apps host usually does the following:

1. Connect to the MCP server with MCP Apps client capabilities.
1. List tools and split them by MCP Apps visibility.
1. Pass only model-visible tools to `streamText` or `generateText`.
1. Read the app's `ui://` resource when a tool part includes MCP App metadata.
1. Render the HTML resource in a sandboxed iframe.
1. Proxy allowed iframe requests, such as app-visible `tools/call`, back to the MCP server.

## Connect With MCP Apps Support

Use `mcpAppClientCapabilities` when creating the MCP client. This advertises that your host can render `text/html;profile=mcp-app` resources.

```ts
import { createMCPClient, mcpAppClientCapabilities } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export function createMCPAppsClient(origin: string) {
  return createMCPClient({
    transport: new StreamableHTTPClientTransport(new URL('/mcp', origin)),
    clientName: 'my-mcp-apps-host',
    capabilities: mcpAppClientCapabilities,
  });
}
```

Only advertise these capabilities if your host can fetch and render MCP App resources safely.

## Expose Only Model-Visible Tools

MCP Apps tools can declare `_meta.ui.visibility`. Tools with `"model"` visibility can be passed to the model. Tools with only `"app"` visibility should be kept for iframe requests and not exposed to the model.

```ts filename="app/api/chat/route.ts"
import { splitMCPAppTools } from '@ai-sdk/mcp';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import { createMCPAppsClient } from './mcp-client';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const requestUrl = new URL(req.url);
  const client = await createMCPAppsClient(requestUrl.origin);
  const { messages } = await req.json();

  try {
    const definitions = await client.listTools();
    const { modelVisible } = splitMCPAppTools(definitions);
    const tools = client.toolsFromDefinitions(modelVisible);

    const result = streamText({
      model: openai('gpt-4o-mini'),
      tools,
      messages: await convertToModelMessages(messages),
      onEnd: async () => {
        await client.close();
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    await client.close();
    throw error;
  }
}
```

When the model calls an app-backed tool, the MCP client preserves the app metadata on the tool UI part. The React renderer uses that metadata to decide whether a tool part has an MCP App.

## Read App Resources

Use `readMCPAppResource` to read and normalize an app resource before sending it to the browser host.

```ts filename="app/api/mcp-app-host/route.ts"
import { readMCPAppResource } from '@ai-sdk/mcp';
import { createMCPAppsClient } from '../chat/mcp-client';

export async function POST(req: Request) {
  const requestUrl = new URL(req.url);
  const { uri } = await req.json();
  const client = await createMCPAppsClient(requestUrl.origin);

  try {
    return Response.json(await readMCPAppResource({ client, uri }));
  } finally {
    await client.close();
  }
}
```

`readMCPAppResource` verifies the resource uses a `ui://` URI, requires the MCP Apps MIME type, decodes text or base64 resource contents, and returns the HTML plus rendering metadata such as CSP and permissions.

## Proxy App-Visible Tool Calls

The iframe cannot connect directly to your MCP server. It sends JSON-RPC messages to your host, and your host decides what is allowed.

For app-initiated tool calls, validate that the requested tool is app-visible before calling the MCP server.

```ts filename="app/api/mcp-app-host/route.ts"
import { splitMCPAppTools } from '@ai-sdk/mcp';
import { createMCPAppsClient } from '../chat/mcp-client';

export async function callAppVisibleTool(req: Request) {
  const requestUrl = new URL(req.url);
  const { name, arguments: toolArguments } = await req.json();
  const client = await createMCPAppsClient(requestUrl.origin);

  try {
    const { appVisible } = splitMCPAppTools(await client.listTools());
    const isAllowed = appVisible.tools.some(tool => tool.name === name);

    if (!isAllowed) {
      return Response.json(
        { error: 'Tool is not app-visible' },
        { status: 403 },
      );
    }

    return Response.json(
      await client.callTool({
        name,
        arguments: toolArguments ?? {},
      }),
    );
  } finally {
    await client.close();
  }
}
```

In production, add any policy and user approval checks your app needs before forwarding iframe requests.

## Render With React

In your React chat UI, render normal message parts as usual and pass tool parts to `experimental_MCPAppRenderer`.

<Note type="warning">
  `experimental_MCPAppRenderer` is experimental and may change in a future
  release.
</Note>

```tsx filename="app/page.tsx"
'use client';

import {
  experimental_MCPAppRenderer as MCPAppRenderer,
  useChat,
  type MCPAppBridgeHandlers,
  type MCPAppMetadata,
  type MCPAppResource,
  type MCPAppSandboxConfig,
} from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';

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

export default function Chat() {
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  return (
    <>
      {messages.map(message =>
        message.parts.map((part, index) => {
          if (part.type === 'text') {
            return <div key={index}>{part.text}</div>;
          }

          if (isToolUIPart(part)) {
            return (
              <MCPAppRenderer
                key={part.toolCallId}
                part={part}
                loadResource={loadResource}
                handlers={handlers}
                sandbox={sandbox}
                fallback={<div>Loading MCP App...</div>}
              />
            );
          }

          return null;
        }),
      )}

      <button onClick={() => sendMessage({ text: 'Show me a dashboard' })}>
        Send
      </button>
    </>
  );
}
```

`experimental_MCPAppRenderer` renders nothing for ordinary tools. For app-backed tools, it loads the resource, creates the sandbox bridge, sends tool input and result notifications to the iframe, and forwards supported app requests through your handlers.

## Best Practices

- Treat MCP App HTML as untrusted content. Render it in a sandboxed iframe, ideally through a sandbox proxy route on a separate origin.
- Never pass app-only tools to the model. Use `splitMCPAppTools` and expose only `modelVisible` tools.
- Validate every iframe request on the server before calling `client.callTool`.
- Cache app resources by `resourceUri` so repeated tool calls do not refetch identical HTML.
- Keep tool `content` and `structuredContent` useful without the UI, so text-only hosts still work.
- Close short-lived MCP clients when the response or host request finishes.

## Reference

<ExampleLinks
  examples={[
    {
      title: 'MCP Apps helpers',
      link: '/docs/reference/ai-sdk-core/mcp-apps',
    },
    {
      title: 'MCP App Renderer',
      link: '/docs/reference/ai-sdk-ui/mcp-app-renderer',
    },
  ]}
/>
