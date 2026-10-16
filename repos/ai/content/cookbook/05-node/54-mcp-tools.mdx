---
title: Model Context Protocol (MCP) Tools
description: Learn how to use MCP tools with the AI SDK and Node
tags: ['node', 'tool use', 'agent', 'mcp']
---

# MCP Tools

The AI SDK supports Model Context Protocol (MCP) tools by offering a lightweight client that exposes a `tools` method for retrieving tools from a MCP server. After use, the client should always be closed to release resources.

If you prefer to use the official transports (optional), install the official Model Context Protocol TypeScript SDK.

<Snippet text="pnpm install @modelcontextprotocol/sdk" />

```ts
import { createMCPClient } from '@ai-sdk/mcp';
import { generateText, isStepCount } from 'ai';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { openai } from '@ai-sdk/openai';
// Optional: Official transports if you prefer them
// import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
// import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
// import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';

let clientOne;
let clientTwo;
let clientThree;

try {
  // Initialize an MCP client to connect to a `stdio` MCP server (local only):
  const transport = new Experimental_StdioMCPTransport({
    command: 'node',
    args: ['src/stdio/dist/server.js'],
  });

  const clientOne = await createMCPClient({
    transport,
  });

  // Connect to an HTTP MCP server directly via the client transport config
  const clientTwo = await createMCPClient({
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
  const clientThree = await createMCPClient({
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
  // clientTwo = await createMCPClient({ transport: httpTransport });
  // const sseTransport = new SSEClientTransport(new URL('http://localhost:3000/sse'));
  // clientThree = await createMCPClient({ transport: sseTransport });

  const toolSetOne = await clientOne.tools();
  const toolSetTwo = await clientTwo.tools();
  const toolSetThree = await clientThree.tools();
  const tools = {
    ...toolSetOne,
    ...toolSetTwo,
    ...toolSetThree, // note: this approach causes subsequent tool sets to override tools with the same name
  };

  const response = await generateText({
    model: 'openai/gpt-4o',
    tools,
    stopWhen: isStepCount(5),
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Find products under $100' }],
      },
    ],
  });

  console.log(response.text);
} catch (error) {
  console.error(error);
} finally {
  await Promise.all([
    clientOne.close(),
    clientTwo.close(),
    clientThree.close(),
  ]);
}
```
