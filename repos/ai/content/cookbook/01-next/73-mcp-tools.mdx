---
title: Model Context Protocol (MCP) Tools
description: Learn how to use MCP tools with the AI SDK and Next.js
tags: ['next', 'tool use', 'agent', 'mcp']
---

# MCP Tools

The AI SDK supports Model Context Protocol (MCP) tools by offering a lightweight client that exposes a `tools` method for retrieving tools from a MCP server. After use, the client should always be closed to release resources.

## Server

Let's create a route handler for `/api/completion` that will generate text based on the input prompt and MCP tools that can be called at any time during a generation. The route will call the `streamText` function from the `ai` module, which will then generate text based on the input prompt and stream it to the client.

If you prefer to use the official transports (optional), install the official TypeScript SDK for Model Context Protocol:

<Snippet text="pnpm install @modelcontextprotocol/sdk" />

```ts filename="app/api/completion/route.ts"
import { createMCPClient } from '@ai-sdk/mcp';
import { streamText } from 'ai';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { openai } from '@ai-sdk/openai';
// Optional: Official transports if you prefer them
// import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
// import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
// import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  try {
    // Initialize an MCP client to connect to a `stdio` MCP server (local only):
    const transport = new Experimental_StdioMCPTransport({
      command: 'node',
      args: ['src/stdio/dist/server.js'],
    });

    const stdioClient = await createMCPClient({
      transport,
    });

    // Connect to an HTTP MCP server directly via the client transport config
    const httpClient = await createMCPClient({
      transport: {
        type: 'http',
        url: 'http://localhost:3000/mcp',

        // optional: configure headers
        // headers: { Authorization: 'Bearer my-api-key' },

        // optional: provide an OAuth client provider for automatic authorization
        // authProvider: myOAuthClientProvider,
      },
    });

    // Connect to a Server-Sent Events (SSE) MCP server directly via the client transport config
    const sseClient = await createMCPClient({
      transport: {
        type: 'sse',
        url: 'http://localhost:3000/sse',

        // optional: configure headers
        // headers: { Authorization: 'Bearer my-api-key' },

        // optional: provide an OAuth client provider for automatic authorization
        // authProvider: myOAuthClientProvider,
      },
    });

    // Alternatively, you can create transports with the official SDKs instead of direct config:
    // const httpTransport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));
    // const httpClient = await createMCPClient({ transport: httpTransport });
    // const sseTransport = new SSEClientTransport(new URL('http://localhost:3000/sse'));
    // const sseClient = await createMCPClient({ transport: sseTransport });

    const toolSetOne = await stdioClient.tools();
    const toolSetTwo = await httpClient.tools();
    const toolSetThree = await sseClient.tools();
    const tools = {
      ...toolSetOne,
      ...toolSetTwo,
      ...toolSetThree, // note: this approach causes subsequent tool sets to override tools with the same name
    };

    const response = await streamText({
      model: 'openai/gpt-4o',
      tools,
      prompt,
      // When streaming, the client should be closed after the response is finished:
      onEnd: async () => {
        await stdioClient.close();
        await httpClient.close();
        await sseClient.close();
      },
      // Closing clients onError is optional
      // - Closing: Immediately frees resources, prevents hanging connections
      // - Not closing: Keeps connection open for retries
      onError: async error => {
        await stdioClient.close();
        await httpClient.close();
        await sseClient.close();
      },
    });

    return response.toDataStreamResponse();
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

## Client

Let's create a simple React component that imports the `useCompletion` hook from the `@ai-sdk/react` module. The `useCompletion` hook will call the `/api/completion` endpoint when a button is clicked. The endpoint will generate text based on the input prompt and stream it to the client.

```tsx filename="app/page.tsx"
'use client';

import { useCompletion } from '@ai-sdk/react';

export default function Page() {
  const { completion, complete } = useCompletion({
    api: '/api/completion',
  });

  return (
    <div>
      <div
        onClick={async () => {
          await complete(
            'Please schedule a call with Sonny and Robby for tomorrow at 10am ET for me!',
          );
        }}
      >
        Schedule a call
      </div>

      {completion}
    </div>
  );
}
```
