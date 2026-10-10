---
title: Call Tools
description: Learn how to call tools using the AI SDK and Node
tags: ['node', 'tool use']
---

# Call Tools

Some models allow developers to provide a list of tools that can be called at any time during a generation.
This is useful for extending the capabilities of a language model to either use logic or data to interact with systems external to the model.

```ts
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: 'openai/gpt-4.1',
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
    cityAttractions: tool({
      inputSchema: z.object({ city: z.string() }),
    }),
  },
  prompt:
    'What is the weather in San Francisco and what attractions should I visit?',
});
```

## Accessing Tool Calls and Tool Results

If the model decides to call a tool, it will generate a tool call. You can access the tool call by checking the `toolCalls` property on the result.

```ts highlight="31-44"
import { generateText, tool } from 'ai';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

async function main() {
  const result = await generateText({
    model: 'openai/gpt-4o',
    maxOutputTokens: 512,
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        }),
      }),
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
      }),
    },
    prompt:
      'What is the weather in San Francisco and what attractions should I visit?',
  });

  // typed tool calls:
  for (const toolCall of result.toolCalls) {
    if (toolCall.dynamic) {
      continue;
    }

    switch (toolCall.toolName) {
      case 'cityAttractions': {
        toolCall.input.city; // string
        break;
      }

      case 'weather': {
        toolCall.input.location; // string
        break;
      }
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
```

## Accessing Tool Results

You can access the result of a tool call by checking the `toolResults` property on the result.

```ts highlight="31-41"
import { generateText, tool } from 'ai';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

async function main() {
  const result = await generateText({
    model: 'openai/gpt-4o',
    maxOutputTokens: 512,
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        }),
      }),
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
      }),
    },
    prompt:
      'What is the weather in San Francisco and what attractions should I visit?',
  });

  // typed tool results for tools with execute method:
  for (const toolResult of result.toolResults) {
    if (toolResult.dynamic) {
      continue;
    }

    switch (toolResult.toolName) {
      case 'weather': {
        toolResult.input.location; // string
        toolResult.output.location; // string
        toolResult.output.temperature; // number
        break;
      }
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
```

<Note>
  `toolResults` will only be available if the tool has an `execute` function.
</Note>

## Model Response

When using tools, it's important to note that the model won't respond with the tool call results by default.
This is because the model has technically already generated its response to the prompt: the tool call.
Many use cases will require the model to summarize the results of the tool call within the context of the original prompt automatically.
You can achieve this by [using `stopWhen`](/cookbook/node/call-tools-multiple-steps)
which will automatically send toolResults to the model to trigger another generation.
