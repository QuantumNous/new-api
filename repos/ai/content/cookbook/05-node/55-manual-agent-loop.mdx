---
title: Manual Agent Loop
description: Learn how to create your own agentic loop with full control over tool execution
tags: ['node', 'agent']
---

# Manual Agent Loop

When you need complete control over the agentic loop and tool execution, you can manage the agent flow yourself rather than using `prepareStep` and `stopWhen`. This approach gives you full flexibility over when and how tools are executed, message history management, and loop termination conditions.

This pattern is useful when you want to:

- Implement custom logic between tool calls
- Handle tool execution errors in specific ways
- Add custom logging or monitoring
- Integrate with external systems during the loop
- Have complete control over the conversation history

## Example

```ts
import { ModelMessage, streamText, tool } from 'ai';
import 'dotenv/config';
import z from 'zod';

const getWeather = async ({ location }: { location: string }) => {
  return `The weather in ${location} is ${Math.floor(Math.random() * 100)} degrees.`;
};

const messages: ModelMessage[] = [
  {
    role: 'user',
    content: 'Get the weather in New York and San Francisco',
  },
];

async function main() {
  while (true) {
    const result = streamText({
      model: 'openai/gpt-4o',
      messages,
      tools: {
        getWeather: tool({
          description: 'Get the current weather in a given location',
          inputSchema: z.object({
            location: z.string(),
          }),
        }),
        // add more tools here, omitting the execute function so you handle it yourself
      },
    });

    // Stream the response (only necessary for providing updates to the user)
    for await (const chunk of result.stream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }

      if (chunk.type === 'tool-call') {
        console.log('\\nCalling tool:', chunk.toolName);
      }
    }

    // Add LLM generated messages to the message history
    const responseMessages = await result.responseMessages;
    messages.push(...responseMessages);

    const finishReason = await result.finishReason;

    if (finishReason === 'tool-calls') {
      const toolCalls = await result.toolCalls;

      // Handle all tool call execution here
      for (const toolCall of toolCalls) {
        if (toolCall.toolName === 'getWeather') {
          const toolOutput = await getWeather(toolCall.input);
          messages.push({
            role: 'tool',
            content: [
              {
                toolName: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                type: 'tool-result',
                output: { type: 'text', value: toolOutput }, // update depending on the tool's output format
              },
            ],
          });
        }
        // Handle other tool calls
      }
    } else {
      // Exit the loop when the model doesn't request to use any more tools
      console.log('\\n\\nFinal message history:');
      console.dir(messages, { depth: null });
      break;
    }
  }
}

main().catch(console.error);
```

## Key Concepts

### Message Management

The example maintains a `messages` array that tracks the entire conversation history. After each model response, the generated messages are added to this history:

```ts
const responseMessages = await result.responseMessages;
messages.push(...responseMessages);
```

### Tool Execution Control

Tool execution is handled manually in the loop. When the model requests tool calls, you process each one individually:

```ts
if (finishReason === 'tool-calls') {
  const toolCalls = await result.toolCalls;

  for (const toolCall of toolCalls) {
    if (toolCall.toolName === 'getWeather') {
      const toolOutput = await getWeather(toolCall.input);
      // Add tool result to message history
      messages.push({
        role: 'tool',
        content: [
          {
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            type: 'tool-result',
            output: { type: 'text', value: toolOutput },
          },
        ],
      });
    }
  }
}
```

### Loop Termination

The loop continues until the model stops requesting tool calls. You can customize this logic to implement your own termination conditions:

```ts
if (finishReason === 'tool-calls') {
  // Continue the loop
} else {
  // Exit the loop
  break;
}
```

## Extending This Example

### Custom Loop Control

Implement maximum iterations or time limits:

```ts
let iterations = 0;
const MAX_ITERATIONS = 10;

while (iterations < MAX_ITERATIONS) {
  iterations++;
  // ... rest of the loop
}
```

### Parallel Tool Execution

Execute multiple tools in parallel for better performance:

```ts
const toolPromises = toolCalls.map(async toolCall => {
  if (toolCall.toolName === 'getWeather') {
    const toolOutput = await getWeather(toolCall.input);
    return {
      role: 'tool' as const,
      content: [
        {
          toolName: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          type: 'tool-result' as const,
          output: { type: 'text' as const, value: toolOutput },
        },
      ],
    };
  }
  // Handle other tools
});

const toolResults = await Promise.all(toolPromises);
messages.push(...toolResults.filter(Boolean));
```

This manual approach gives you complete control over the agentic loop while still leveraging the AI SDK's powerful streaming and tool calling capabilities.
