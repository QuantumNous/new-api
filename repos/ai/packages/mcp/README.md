# AI SDK - Model Context Protocol Client

The **Model Context Protocol (MCP) client** for the
[AI SDK](https://ai-sdk.dev/docs) lets you connect to MCP servers and use their
tools with AI SDK functions like `generateText` and `streamText`.

## Setup

The MCP client is available in the `@ai-sdk/mcp` module. You can install it with

```bash
npm i @ai-sdk/mcp ai zod
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend
adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Usage

Create an MCP client with `createMCPClient()`, fetch the server tools with
`mcpClient.tools()`, and pass them to an AI SDK call:

```ts
import { createMCPClient } from '@ai-sdk/mcp';
import { generateText, isStepCount } from 'ai';

const mcpClient = await createMCPClient({
  transport: {
    type: 'http',
    url: 'https://your-server.com/mcp',
    headers: {
      Authorization: `Bearer ${process.env.MCP_API_KEY}`,
    },
  },
});

try {
  const tools = await mcpClient.tools();

  const { text } = await generateText({
    model: 'openai/gpt-5.4',
    tools,
    stopWhen: isStepCount(10),
    prompt: 'Use the available tools to answer the user question.',
  });

  console.log(text);
} finally {
  await mcpClient.close();
}
```

The client converts MCP tool definitions into AI SDK tools, so model calls can
use them through the standard `tools` option.

For streaming responses, close the MCP client when the stream finishes:

```ts
import { createMCPClient } from '@ai-sdk/mcp';
import { streamText } from 'ai';

const mcpClient = await createMCPClient({
  transport: {
    type: 'http',
    url: 'https://your-server.com/mcp',
  },
});

const result = streamText({
  model: 'openai/gpt-5.4',
  tools: await mcpClient.tools(),
  prompt: 'Use the available tools to answer the user question.',
  onEnd: async () => {
    await mcpClient.close();
  },
});

for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}
```

## Transports

HTTP is recommended for production deployments:

```ts
import { createMCPClient } from '@ai-sdk/mcp';

const savedSession = await loadMcpSession();
let currentSessionId = savedSession?.sessionId;

const mcpClient = await createMCPClient({
  transport: {
    type: 'http',
    url: 'https://your-server.com/mcp',
    initialSessionId: savedSession?.sessionId,
    initialProtocolVersion: savedSession?.initializeResult.protocolVersion,
    terminateSessionOnClose: false,
    onSessionIdChange: sessionId => {
      currentSessionId = sessionId;
    },
    onSessionExpired: sessionId => {
      if (currentSessionId === sessionId) {
        currentSessionId = undefined;
        void clearMcpSession();
      }
    },
  },
  initialInitializeResult: savedSession?.initializeResult,
});

if (currentSessionId) {
  await saveMcpSession({
    sessionId: currentSessionId,
    initializeResult: mcpClient.initializeResult,
  });
}
```

SSE is also supported for MCP servers that use Server-Sent Events:

```ts
const mcpClient = await createMCPClient({
  transport: {
    type: 'sse',
    url: 'https://your-server.com/sse',
  },
});
```

For local MCP servers, you can use stdio transport from the `@ai-sdk/mcp/mcp-stdio`
subpath:

```ts
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

const mcpClient = await createMCPClient({
  transport: new Experimental_StdioMCPTransport({
    command: 'node',
    args: ['server.js'],
  }),
});
```

## Documentation

Please check out the
[AI SDK MCP documentation](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools) for
more information.
