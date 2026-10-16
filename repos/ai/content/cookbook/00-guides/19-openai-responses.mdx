---
title: OpenAI Responses API
description: Get started with the OpenAI Responses API using the AI SDK.
tags: ['getting-started', 'agents']
---

# Get started with OpenAI Responses API

With the [release of OpenAI's responses API](https://openai.com/index/new-tools-for-building-agents/), there has never been a better time to start building AI applications, particularly those that require a deeper understanding of the world.

The [AI SDK](/) is a powerful TypeScript toolkit for building AI applications with large language models (LLMs) alongside popular frameworks like React, Next.js, Vue, Svelte, Node.js, and more.

## OpenAI Responses API

OpenAI recently released the Responses API, a brand new way to build applications on OpenAI's platform. The new API offers a way to persist chat history, a web search tool for grounding LLM responses, file search tool for finding relevant files, and a computer use tool for building agents that can interact with and operate computers. Let's explore how to use the Responses API with the AI SDK.

## Getting Started with the AI SDK

The AI SDK is the TypeScript toolkit designed to help developers build AI-powered applications with React, Next.js, Vue, Svelte, Node.js, and more. Integrating LLMs into applications is complicated and heavily dependent on the specific model provider you use.

The AI SDK abstracts away the differences between model providers, eliminates boilerplate code for building chatbots, and allows you to go beyond text output to generate rich, interactive components.

At the center of the AI SDK is [AI SDK Core](/docs/ai-sdk-core/overview), which provides a unified API to call any LLM. The code snippet below is all you need to call GPT-4o with the new Responses API using the AI SDK:

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai.responses('gpt-4o'),
  prompt: 'Explain the concept of quantum entanglement.',
});
```

### Generating Structured Data

While text generation can be useful, you might want to generate structured JSON data. For example, you might want to extract information from text, classify data, or generate synthetic data. AI SDK Core provides [`generateText`](/docs/reference/ai-sdk-core/generate-text) and [`streamText`](/docs/reference/ai-sdk-core/stream-text) with `Output` to generate structured data, allowing you to constrain model outputs to a specific schema.

```ts
import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const { output } = await generateText({
  model: openai.responses('gpt-4o'),
  output: Output.object({
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(
          z.object({ name: z.string(), amount: z.string() }),
        ),
        steps: z.array(z.string()),
      }),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});
```

This code snippet will generate a type-safe recipe that conforms to the specified zod schema.

### Using Tools with the AI SDK

The Responses API supports tool calling out of the box, allowing it to interact with external systems and perform discrete tasks. Here's an example of using tool calling with the AI SDK:

```ts
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const { text } = await generateText({
  model: openai.responses('gpt-4o'),
  prompt: 'What is the weather like today in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
  },
  stopWhen: isStepCount(5), // enable multi-step 'agentic' LLM calls
});
```

This example demonstrates how `stopWhen` transforms a single LLM call into an agent. The `stopWhen: isStepCount(5)` parameter allows the model to autonomously call tools, analyze results, and make additional tool calls as needed - turning what would be a simple one-shot completion into an intelligent agent that can chain multiple actions together to complete complex tasks.

### Web Search Tool

The Responses API introduces a built-in tool for grounding responses called `webSearch`. With this tool, the model can access the internet to find relevant information for its responses.

```ts
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const result = await generateText({
  model: openai.responses('gpt-4o-mini'),
  prompt: 'What happened in San Francisco last week?',
  tools: {
    web_search_preview: openai.tools.webSearchPreview(),
  },
});

console.log(result.text);
console.log(result.sources);
```

The `webSearch` tool also allows you to specify query-specific metadata that can be used to improve the quality of the search results.

```ts
import { generateText } from 'ai';

const result = await generateText({
  model: openai.responses('gpt-4o-mini'),
  prompt: 'What happened in San Francisco last week?',
  tools: {
    web_search_preview: openai.tools.webSearchPreview({
      searchContextSize: 'high',
      userLocation: {
        type: 'approximate',
        city: 'San Francisco',
        region: 'California',
      },
    }),
  },
});

console.log(result.text);
console.log(result.sources);
```

### MCP Tool

The Responses API also supports connecting to [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers. This allows models to call tools exposed by remote MCP servers or service connectors.

```ts
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const result = await generateText({
  model: openai.responses('gpt-5-mini'),
  prompt: 'Search the web for the latest NYC mayoral election results',
  tools: {
    mcp: openai.tools.mcp({
      serverLabel: 'web-search',
      serverUrl: 'https://mcp.exa.ai/mcp',
      serverDescription: 'A web-search API for AI agents',
    }),
  },
});

console.log(result.text);
```

For more details on configuring the MCP tool, including authentication, tool filtering, and connector support, see the [OpenAI provider documentation](/providers/ai-sdk-providers/openai#mcp-tool).

## Using Persistence

With the Responses API, you can persist chat history with OpenAI across requests. This allows you to send just the user's last message and OpenAI can access the entire chat history.

There are two options available to use persistence:

### With previousResponseId

```tsx filename="app/api/chat/route.ts"
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const result1 = await generateText({
  model: openai.responses('gpt-4o-mini'),
  prompt: 'Invent a new holiday and describe its traditions.',
});

const result2 = await generateText({
  model: openai.responses('gpt-4o-mini'),
  prompt: 'Summarize in 2 sentences',
  providerOptions: {
    openai: {
      previousResponseId: result1.providerMetadata?.openai.responseId as string,
    },
  },
});
```

### With Conversations

You can use the [Conversation API](https://platform.openai.com/docs/api-reference/conversations/create) to create a conversation.

Once you have created a conversation, you can continue it:

```tsx filename="app/api/chat/route.ts"
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const result = await generateText({
  model: openai.responses('gpt-4o-mini'),
  prompt: 'Summarize in 2 sentences',
  providerOptions: {
    openai: {
      // The Conversation ID created via the OpenAI API to continue
      conversation: 'conv_123',
    },
  },
});
```

## Migrating from Completions API

Migrating from the OpenAI Completions API (via the AI SDK) to the new Responses API is simple. To migrate, simply change your provider instance from `openai(modelId)` to `openai.responses(modelId)`:

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Completions API
const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Explain the concept of quantum entanglement.',
});

// Responses API
const { text } = await generateText({
  model: openai.responses('gpt-4o'),
  prompt: 'Explain the concept of quantum entanglement.',
});
```

When using the Responses API, provider specific options that were previously specified on the model provider instance have now moved to the `providerOptions` object:

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Completions API
const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Explain the concept of quantum entanglement.',
  providerOptions: {
    openai: {
      parallelToolCalls: false,
    },
  },
});

// Responses API
const { text } = await generateText({
  model: openai.responses('gpt-4o'),
  prompt: 'Explain the concept of quantum entanglement.',
  providerOptions: {
    openai: {
      parallelToolCalls: false,
    },
  },
});
```

## Get Started

Ready to get started? Here's how you can dive in:

1. Explore the documentation at [ai-sdk.dev/docs](/docs) to understand the full capabilities of the AI SDK.
2. Check out practical examples at [ai-sdk.dev/examples](/examples) to see the SDK in action and get inspired for your own projects.
3. Dive deeper with advanced guides on topics like Retrieval-Augmented Generation (RAG) and multi-modal chat at [ai-sdk.dev/docs/guides](/cookbook/guides).
4. Check out ready-to-deploy AI templates at [vercel.com/templates?type=ai](https://vercel.com/templates?type=ai).
