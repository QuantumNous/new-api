# @ai-sdk/workflow

WorkflowAgent is a class for building durable AI agents that can maintain state across workflow steps, call tools, and handle interruptions gracefully.

## Installation

```bash
npm install @ai-sdk/workflow ai
```

## Usage

```typescript
import { WorkflowAgent } from '@ai-sdk/workflow';
import { z } from 'zod';

const agent = new WorkflowAgent({
  model: 'anthropic/claude-opus',
  tools: {
    getWeather: {
      description: 'Get weather for a location',
      inputSchema: z.object({ location: z.string() }),
      execute: async ({ location }) => {
        // Fetch weather data
        return { temperature: 72, condition: 'sunny' };
      },
    },
  },
  system: 'You are a helpful weather assistant.',
});

const result = await agent.stream({
  messages: [{ role: 'user', content: 'What is the weather in SF?' }],
  writable: new WritableStream({
    write(chunk) {
      console.log('Chunk:', chunk);
    },
  }),
});

console.log('Final messages:', result.messages);
console.log('Steps:', result.steps);
```

## Features

- **Streaming Support**: Stream responses in real-time
- **Tool Calling**: Execute tools dynamically during conversation
- **Context Management**: Pass context between steps
- **Error Handling**: Robust error handling with callbacks
- **Structured Output**: Parse structured outputs from LLM responses
- **Step Callbacks**: Hook into each step of the agent loop
- **Provider-Executed Tools**: Support for provider-executed tools
- **Abort Support**: Cancel operations with AbortSignal

## API

See the [AI SDK documentation](https://ai-sdk.dev/docs) for full API details.

## License

Apache-2.0
