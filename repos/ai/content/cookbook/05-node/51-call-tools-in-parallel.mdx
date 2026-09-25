---
title: Call Tools in Parallel
description: Learn how to call tools in parallel using the AI SDK in Node.js
tags: ['node', 'tool use']
---

# Call Tools in Parallel

Some language models support calling tools in parallel. This is particularly useful when multiple tools are independent of each other and can be executed in parallel during the same generation step.

```ts
import { generateText, tool } from 'ai';
import { z } from 'zod';
__PROVIDER_IMPORT__;

const result = await generateText({
  model: __MODEL__,
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        city: z.string().describe('The city to get the weather for'),
        unit: z
          .enum(['C', 'F'])
          .describe('The unit to display the temperature in'),
      }),
      execute: async ({ city, unit }) => {
        // This function would normally make an API request to get the weather.
        const weather = { value: 25, description: 'Sunny' };
        return `It is currently ${weather.value}°${unit} and ${weather.description} in ${city}!`;
      },
    }),
  },
  prompt: 'What is the weather in Paris and New York?',
});

// The model will call the weather tool twice in parallel
console.log(result.toolCalls);
// [
//   { toolName: 'weather', input: { city: 'Paris', unit: 'C' } },
//   { toolName: 'weather', input: { city: 'New York', unit: 'C' } }
// ]

console.log(result.toolResults);
// [
//   { toolName: 'weather', input: { city: 'Paris', unit: 'C' }, output: 'It is currently 25°C and Sunny in Paris!' },
//   { toolName: 'weather', input: { city: 'New York', unit: 'C' }, output: 'It is currently 25°C and Sunny in New York!' }
// ]
```
