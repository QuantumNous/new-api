# LangGraph Development Server

This is a simple LangGraph agent for local development and testing with the `@ai-sdk/langchain` adapter.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

1. Create a `.env` file with your OpenAI API key:

   ```bash
   OPENAI_API_KEY=your-openai-api-key
   ```

1. Start the development server:

   ```bash
   pnpm dev
   # Or directly:
   npx @langchain/langgraph-cli dev
   ```

The server will start at `http://localhost:2024`.

> **Note:** When running the full example with `pnpm dev` from the parent directory, both Next.js and this LangGraph server start automatically.

## Available Tools

The agent includes two tools:

- **get_weather**: Returns mock weather data for a given city
- **calculator**: Performs basic mathematical calculations

## Customizing the Agent

This example uses `createAgent` from LangChain for simplicity. However, the LangGraph CLI can serve **any** LangGraph application, including:

- **Simple agents** with `createAgent` (like this one)
- **Complex multi-agent workflows** with custom `StateGraph`
- **RAG pipelines** with retrieval nodes
- **Human-in-the-loop workflows** with interrupt points
- **Custom graphs** with persistence and memory

For more advanced use cases, you can use the low-level LangGraph APIs:

```typescript
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';

const workflow = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('tools', new ToolNode(tools))
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent');

export const graph = workflow.compile();
```

See the [LangGraph documentation](https://langchain-ai.github.io/langgraph/) for more examples.

## Usage with AI SDK

Connect to this server from the frontend using `LangSmithDeploymentTransport`:

```typescript
import { LangSmithDeploymentTransport } from '@ai-sdk/langchain';
import { useChat } from '@ai-sdk/react';

const transport = new LangSmithDeploymentTransport({
  url: 'http://localhost:2024',
});

function Chat() {
  const { messages, sendMessage } = useChat({ transport });
  // ...
}
```

## Configuration

The `langgraph.json` file configures the LangGraph CLI:

```json
{
  "graphs": {
    "agent": "./src/agent.ts:graph"
  },
  "env": ".env"
}
```
