---
title: Call Tools in Multiple Steps
description: Learn how to call tools with multiple steps using the AI SDK and Node
tags: ['node', 'tool use', 'agent']
---

# Call Tools in Multiple Steps

Models call tools to gather information or perform actions that are not directly available to the model.
When tool results are available, the model can use them to generate another response.

You can enable multi-step tool calls in `generateText` by defining stopping conditions with `stopWhen`.
This allows you to define the conditions for which your agent should stop when the model generates a tool call.

```ts highlight={"7"}
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';

const { text, steps } = await generateText({
  model: 'openai/gpt-4.1',
  stopWhen: isStepCount(5),
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }: { location: string }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
  },
  prompt: 'What is the weather in San Francisco?',
});
```
