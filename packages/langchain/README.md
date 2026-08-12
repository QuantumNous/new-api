# AI SDK - LangChain Adapter

The **[AI SDK](https://ai-sdk.dev)** LangChain adapter provides seamless integration between [LangChain](https://langchain.com/) and the AI SDK, enabling you to use LangChain agents and graphs with AI SDK UI components.

## Installation

```bash
npm install @ai-sdk/langchain @langchain/core
```

> **Note:** `@langchain/core` is a required peer dependency.

## Features

- Convert AI SDK `UIMessage` to LangChain `BaseMessage` format
- Transform LangChain/LangGraph streams to AI SDK `UIMessageStream`
- `ChatTransport` implementation for LangSmith deployments
- Full support for text, tool calls, and tool results
- Custom data streaming with typed events (`data-{type}`)

## Usage

### Converting Messages

Use `toBaseMessages` to convert AI SDK messages to LangChain format:

```ts
import { toBaseMessages } from '@ai-sdk/langchain';

// Convert UI messages to LangChain format
const langchainMessages = await toBaseMessages(uiMessages);

// Use with any LangChain model
const response = await model.invoke(langchainMessages);
```

### Streaming from LangGraph

Use `toUIMessageStream` to convert LangGraph streams to AI SDK format:

```ts
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { createUIMessageStreamResponse } from 'ai';

// Convert messages and stream from a LangGraph graph
const langchainMessages = await toBaseMessages(uiMessages);

const langchainStream = await graph.stream(
  { messages: langchainMessages },
  { streamMode: ['values', 'messages', 'tools'] },
);

// Convert to UI message stream response
return createUIMessageStreamResponse({
  stream: toUIMessageStream(langchainStream),
});
```

Use the `tools` stream mode when you want to stream LangGraph tool progress. The adapter converts `on_tool_event` events to preliminary tool output (`preliminary: true`) and the final `on_tool_end` event to final tool output.

### Streaming with Callbacks

Use callbacks to access the final LangGraph state, handle errors, or detect aborts:

```ts
const langchainStream = await graph.stream(
  { messages: langchainMessages },
  { streamMode: ['values', 'messages'] },
);

return createUIMessageStreamResponse({
  stream: toUIMessageStream<MyGraphState>(langchainStream, {
    onFinish: async finalState => {
      if (finalState) {
        await saveConversation(finalState.messages);
        await sendAnalytics(finalState);
      }
    },
    onError: error => console.error('Stream failed:', error),
    onAbort: () => console.log('Client disconnected'),
  }),
});
```

### Streaming with `streamEvents`

You can also use `toUIMessageStream` with `streamEvents()` for more granular event handling:

```ts
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { createUIMessageStreamResponse } from 'ai';

// Using streamEvents with an agent
const langchainMessages = await toBaseMessages(uiMessages);
const streamEvents = agent.streamEvents(
  { messages: langchainMessages },
  { version: 'v2' },
);

// Convert to UI message stream response
return createUIMessageStreamResponse({
  stream: toUIMessageStream(streamEvents),
});
```

The adapter automatically detects the stream type and handles:

- `on_chat_model_stream` events for text streaming
- `on_tool_start` and `on_tool_end` events for tool calls
- Reasoning content from contentBlocks

### Custom Data Streaming

LangChain tools can emit custom data events using `config.writer()`. The adapter converts these to typed `data-{type}` parts:

```ts
import { tool, type ToolRuntime } from 'langchain';

const analyzeDataTool = tool(
  async ({ query }, config: ToolRuntime) => {
    // Emit progress updates - becomes 'data-progress' in the UI
    config.writer?.({
      type: 'progress',
      id: 'analysis-1', // Include 'id' to persist in message.parts
      step: 'fetching',
      message: 'Fetching data...',
      progress: 50,
    });

    // ... perform analysis ...

    // Emit status update - becomes 'data-status' in the UI
    config.writer?.({
      type: 'status',
      id: 'analysis-1-status',
      status: 'complete',
      message: 'Analysis finished',
    });

    return 'Analysis complete';
  },
  {
    name: 'analyze_data',
    description: 'Analyze data with progress updates',
    schema: z.object({ query: z.string() }),
  },
);
```

Enable the `custom` stream mode to receive these events:

```ts
const stream = await graph.stream(
  { messages: langchainMessages },
  { streamMode: ['values', 'messages', 'custom'] },
);
```

**Custom data behavior:**

- Data with an `id` field is **persistent** (added to `message.parts` for rendering)
- Data without an `id` is **transient** (only delivered via the `onData` callback)
- The `type` field determines the event name: `{ type: 'progress' }` → `data-progress`

### LangSmith Deployment Transport

Use `LangSmithDeploymentTransport` with the AI SDK `useChat` hook to connect directly to a LangGraph deployment from the browser:

```tsx
import { useChat } from 'ai/react';
import { LangSmithDeploymentTransport } from '@ai-sdk/langchain';
import { useMemo } from 'react';

function Chat() {
  const transport = useMemo(
    () =>
      new LangSmithDeploymentTransport({
        url: 'https://your-deployment.us.langgraph.app',
        apiKey: process.env.LANGSMITH_API_KEY,
      }),
    [],
  );

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    transport,
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.parts.map(part => part.text).join('')}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## API Reference

### `toBaseMessages(messages)`

Converts AI SDK `UIMessage` objects to LangChain `BaseMessage` objects.

**Parameters:**

- `messages`: `UIMessage[]` - Array of AI SDK UI messages

**Returns:** `Promise<BaseMessage[]>`

### `convertModelMessages(modelMessages)`

Converts AI SDK `ModelMessage` objects to LangChain `BaseMessage` objects.

**Parameters:**

- `modelMessages`: `ModelMessage[]` - Array of model messages

**Returns:** `BaseMessage[]`

### `toUIMessageStream(stream, callbacks?)`

Converts a LangChain/LangGraph stream to an AI SDK `UIMessageStream`.

**Parameters:**

- `stream`: `AsyncIterable | ReadableStream` - A stream from LangChain `model.stream()`, LangGraph `graph.stream()`, or `streamEvents()`
- `callbacks?`: `StreamCallbacks<TState>` - Optional lifecycle callbacks:
  - `onStart()` - Called when stream initializes
  - `onToken(token)` - Called for each token
  - `onText(text)` - Called for each text chunk
  - `onFinal(text)` - Called with aggregated text (on success, error, or abort)
  - `onFinish(state)` - Called on success with LangGraph state (or `undefined` for other streams)
  - `onError(error)` - Called when stream errors
  - `onAbort()` - Called when stream is aborted

**Returns:** `ReadableStream<UIMessageChunk>`

**Supported stream types:**

- **Model streams** - Direct `AIMessageChunk` streams from `model.stream()`
- **LangGraph streams** - Streams with `streamMode: ['values', 'messages']`, or `['values', 'messages', 'tools']` for tool progress
- **streamEvents** - Event streams from `agent.streamEvents()` or `model.streamEvents()`

**Supported LangGraph stream events:**

- `messages` - Streaming message chunks (text, tool calls)
- `values` - State updates that finalize pending message chunks
- `tools` - Tool progress events (`on_tool_event` emits preliminary tool output with `preliminary: true`, final `on_tool_end` emits final output)
- `custom` - Custom data events (emitted as `data-{type}` chunks)

**Supported streamEvents events:**

- `on_chat_model_stream` - Token streaming from chat models
- `on_tool_start` - Tool execution start
- `on_tool_end` - Tool execution end with output

### `LangSmithDeploymentTransport`

A `ChatTransport` implementation for LangSmith/LangGraph deployments.

**Constructor Parameters:**

- `options`: `LangSmithDeploymentTransportOptions` - Configuration for the RemoteGraph connection
  - `url`: `string` - LangSmith deployment URL or local server URL
  - `apiKey?`: `string` - API key for authentication (optional for local development)
  - `graphId?`: `string` - The ID of the graph to connect to (defaults to `'agent'`)

**Implements:** `ChatTransport`

## Documentation

Please check out the [AI SDK documentation](https://ai-sdk.dev) for more information.
