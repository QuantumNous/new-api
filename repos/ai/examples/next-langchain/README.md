# AI SDK, Next.js, LangChain, OpenAI Examples

This example demonstrates how to use the [AI SDK](https://ai-sdk.dev/docs) with [Next.js](https://nextjs.org/), [LangChain](https://js.langchain.com), [LangGraph](https://langchain-ai.github.io/langgraph/), and [OpenAI](https://openai.com) to create AI-powered streaming applications.

## Examples Included

### 1. Basic Chat (`/`)

Basic chat example using LangChain's `ChatOpenAI` with message streaming and the `@ai-sdk/langchain` adapter.

### 2. Text Completion (`/completion`)

Simple text completion using the `useCompletion` hook with LangChain streaming:

- **`useCompletion`**: Uses AI SDK's completion hook for single-turn text generation
- **Streaming**: Real-time token streaming from LangChain's `ChatOpenAI`
- **`toUIMessageStream`**: Converts LangChain stream to AI SDK format

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { toUIMessageStream } from '@ai-sdk/langchain';

const model = new ChatOpenAI({ model: 'gpt-4o-mini' });
const stream = await model.stream([{ role: 'user', content: prompt }]);

return createUIMessageStreamResponse({
  stream: toUIMessageStream(stream),
});
```

### 3. LangGraph (`/langgraph`)

Demonstrates the `@ai-sdk/langchain` adapter with LangGraph:

- **`toBaseMessages`**: Converts AI SDK `UIMessage` to LangChain `BaseMessage` format
- **`toUIMessageStream`**: Converts LangGraph streams to AI SDK `UIMessageChunk` format

This example shows how to integrate a LangGraph agent with the AI SDK's `useChat` hook.

### 4. Multimodal Vision Input (`/multimodal`)

Demonstrates sending images to the model for analysis using the `@ai-sdk/langchain` adapter:

- **Image upload**: Attach images directly in the chat interface
- **Vision analysis**: Uses GPT-4o's vision capabilities to analyze images
- **Multimodal conversion**: The adapter converts images to OpenAI's `image_url` format for vision models

This example showcases the multimodal input support in `convertUserContent()` which handles images and files.

### 5. Image Generation Output (`/image-generation`)

Demonstrates generating images as multimodal output using OpenAI's image generation tool:

- **Responses API**: Uses `ChatOpenAI` with `useResponsesApi: true` to access built-in tools
- **Image generation tool**: Uses `tools.imageGeneration()` from `@langchain/openai`
- **Streaming output**: Generated images are streamed back as part of the response
- **AI SDK integration**: Images are rendered using the standard message parts system

```typescript
import { ChatOpenAI, tools } from '@langchain/openai';

const model = new ChatOpenAI({
  model: 'gpt-4o',
  useResponsesApi: true,
});

const modelWithImageGeneration = model.bindTools([
  tools.imageGeneration({
    size: '1024x1024',
    quality: 'medium',
    outputFormat: 'png',
  }),
]);
```

### 6. ReAct Agent (`/createAgent`)

Showcases LangChain's `createAgent` with the AI SDK adapter:

- Create agents with LangChain's `createAgent()`
- Define tools with `@langchain/core/tools`
- Stream responses using `toUIMessageStream`
- **Image generation**: Uses OpenAI's [Image Generation Tool](https://docs.langchain.com/oss/javascript/integrations/tools/openai#image-generation-tool) to create images

### 7. Human-in-the-Loop (`/hitl`)

Demonstrates LangChain's `humanInTheLoopMiddleware` for requiring user approval before executing sensitive tool actions:

- **`humanInTheLoopMiddleware`**: Middleware that intercepts tool calls and requests user approval
- **Selective approval**: Configure which tools require approval vs auto-approve
- **Approval workflow**: Uses `addToolApprovalResponse` with AI SDK's `dynamic-tool` parts
- **Thread persistence**: Uses `MemorySaver` to maintain conversation state across approvals

```typescript
import { createAgent, humanInTheLoopMiddleware } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';

const agent = createAgent({
  model,
  tools: [sendEmailTool, deleteFileTool, searchTool],
  checkpointer: new MemorySaver(),
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        send_email: { allowedDecisions: ['approve', 'edit', 'reject'] },
        delete_file: { allowedDecisions: ['approve', 'reject'] },
        search: false, // Auto-approve safe operations
      },
    }),
  ],
});
```

### 8. Custom Data Parts (`/custom-data`)

Demonstrates custom streaming events from LangGraph tools:

- Emit typed progress/status updates using `config.writer()`
- Custom data with `type` field becomes `data-{type}` events (e.g., `data-progress`)
- Include `id` field to persist data in `message.parts` for rendering
- Transient data (no `id`) is delivered via `onData` callback only

### 9. LangGraph Transport (`/langsmith`)

Connect directly to a LangGraph app from the browser using `LangSmithDeploymentTransport`:

- Uses `LangSmithDeploymentTransport` to create a transport for client-side communication
- No backend route needed - talks directly to the LangGraph server
- Works with both local development server and LangSmith deployments
- Includes a local LangGraph server for development (see below)

## Deploy your own

Deploy the example using [Vercel](https://vercel.com?utm_source=github&utm_medium=readme&utm_campaign=ai-sdk-example):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fai%2Ftree%2Fmain%2Fexamples%2Fnext-langchain&env=OPENAI_API_KEY&envDescription=OpenAI%20API%20Key&envLink=https%3A%2F%2Fplatform.openai.com%2Faccount%2Fapi-keys&project-name=ai-chat-langchain&repository-name=next-ai-chat-langchain)

## How to use

Execute [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) with [npm](https://docs.npmjs.com/cli/init), [Yarn](https://yarnpkg.com/lang/en/docs/cli/create/), or [pnpm](https://pnpm.io) to bootstrap the example:

```bash
npx create-next-app --example https://github.com/vercel/ai/tree/main/examples/next-langchain next-langchain-app
```

```bash
yarn create next-app --example https://github.com/vercel/ai/tree/main/examples/next-langchain next-langchain-app
```

```bash
pnpm create next-app --example https://github.com/vercel/ai/tree/main/examples/next-langchain next-langchain-app
```

To run the example locally you need to:

1. Sign up at [OpenAI's Developer Platform](https://platform.openai.com/signup).
2. Go to [OpenAI's dashboard](https://platform.openai.com/account/api-keys) and create an API KEY.
3. Set the required OpenAI environment variable as the token value as shown [the example env file](./.env.local.example) but in a new file called `.env.local`.
4. `pnpm install` to install the required dependencies.
5. `pnpm dev` to launch the development server.

## Key Code Patterns

### Converting UIMessages to LangChain Messages

```typescript
import { toBaseMessages } from '@ai-sdk/langchain';

// Simple one-line conversion - no factory functions needed!
const langchainMessages = await toBaseMessages(uiMessages);
```

### Streaming from LangGraph

```typescript
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';

// Convert messages
const langchainMessages = await toBaseMessages(messages);

// Stream from graph
const stream = await graph.stream(
  { messages: langchainMessages },
  { streamMode: ['values', 'messages'] },
);

// Return UI stream response
return createUIMessageStreamResponse({
  stream: toUIMessageStream(stream),
});
```

### Creating a LangChain Agent

```typescript
import { createAgent } from 'langchain';
import { tool } from '@langchain/core/tools';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { createUIMessageStreamResponse } from 'ai';
import { z } from 'zod';

// Define a tool using LangChain's tool decorator
const weatherTool = tool(
  async ({ city }) => `Weather in ${city}: sunny, 72°F`,
  {
    name: 'get_weather',
    description: 'Get the current weather in a location',
    schema: z.object({ city: z.string() }),
  },
);

// Create a LangChain agent
const agent = createAgent({
  model: 'openai:gpt-4o-mini',
  tools: [weatherTool],
  systemPrompt: 'You are a helpful weather assistant.',
});

// Convert messages and stream with the adapter
const langchainMessages = await toBaseMessages(messages);
const stream = await agent.stream(
  { messages: langchainMessages },
  { streamMode: ['values', 'messages'] },
);

return createUIMessageStreamResponse({
  stream: toUIMessageStream(stream),
});
```

### Streaming Custom Data from Tools

```typescript
import { tool, type ToolRuntime } from 'langchain';
import { z } from 'zod';

const analyzeDataTool = tool(
  async ({ dataSource }, config: ToolRuntime) => {
    // Emit progress updates - becomes 'data-progress' in the UI
    config.writer?.({
      type: 'progress',
      id: 'analysis-1', // Include 'id' to persist in message.parts
      step: 'processing',
      message: 'Running analysis...',
      progress: 50,
    });

    // ... perform work ...

    return 'Analysis complete';
  },
  {
    name: 'analyze_data',
    description: 'Analyze data with progress updates',
    schema: z.object({ dataSource: z.string() }),
  },
);

// Enable 'custom' stream mode
const stream = await graph.stream(
  { messages: langchainMessages },
  { streamMode: ['values', 'messages', 'custom'] },
);
```

### Connecting to LangGraph (Client-Side)

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { LangSmithDeploymentTransport } from '@ai-sdk/langchain';
import { useMemo } from 'react';

function Chat() {
  const transport = useMemo(
    () =>
      new LangSmithDeploymentTransport({
        // Local development server:
        url: 'http://localhost:2024',
        // Or for a LangSmith deployment:
        // url: 'https://your-deployment.langsmith.app',
        // apiKey: process.env.NEXT_PUBLIC_LANGSMITH_API_KEY,
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
  });

  // ... render chat UI
}
```

## Choosing Between stream() and streamEvents()

The `@ai-sdk/langchain` adapter supports both `graph.stream()` and `streamEvents()`. Here's when to use each:

### When to use `graph.stream()` with `streamMode`

| Use Case                    | Why                                                                         |
| --------------------------- | --------------------------------------------------------------------------- |
| **LangGraph workflows**     | Optimized for state-based graphs with `values`, `messages`, `updates` modes |
| **Tool execution tracking** | Clean tool call lifecycle with `messages` mode                              |
| **Custom data streaming**   | Use `custom` mode with `config.writer()` for typed events                   |
| **State snapshots**         | Get full state after each step with `values` mode                           |
| **Production apps**         | Simpler integration with AI SDK's `toUIMessageStream`                       |

```typescript
const stream = await graph.stream(
  { messages },
  { streamMode: ['values', 'messages'] },
);
```

### When to use `streamEvents()`

| Use Case                    | Why                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| **Debugging/observability** | Get detailed events for every component in the chain                    |
| **Filtering by event type** | Filter for specific events like `on_chat_model_stream`, `on_tool_start` |
| **Run metadata access**     | Access run IDs, names, tags for each component                          |
| **LCEL migration**          | When migrating apps that rely on callback-based streaming               |
| **Simple model streaming**  | Direct model streaming without LangGraph complexity                     |

```typescript
const streamEvents = model.streamEvents(messages, {
  version: 'v2',
});
```

### Event Types in streamEvents()

| Event                  | Description                       |
| ---------------------- | --------------------------------- |
| `on_chat_model_start`  | Model invocation started          |
| `on_chat_model_stream` | Token chunk received              |
| `on_chat_model_end`    | Model completed with full message |
| `on_tool_start`        | Tool execution started            |
| `on_tool_end`          | Tool execution completed          |
| `on_chain_start/end`   | Chain/graph lifecycle events      |

For most LangGraph applications, `graph.stream()` with appropriate `streamMode` options is recommended. Use `streamEvents()` when you need the additional granularity for debugging or when working with pure LangChain (non-LangGraph) applications.

## Learn More

To learn more about LangChain, LangGraph, OpenAI, Next.js, and the AI SDK take a look at the following resources:

- [AI SDK docs](https://ai-sdk.dev/docs) - learn more about the AI SDK
- [Vercel AI Playground](https://ai-sdk.dev/playground) - compare and tune 20+ AI models side-by-side
- [LangChain Documentation](https://js.langchain.com/docs) - learn about LangChain
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/) - learn about LangGraph
- [LangSmith Documentation](https://docs.smith.langchain.com/) - learn about LangSmith deployments
- [OpenAI Documentation](https://platform.openai.com/docs) - learn about OpenAI features and API
- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
