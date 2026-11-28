---
title: Get started with Gemini 3
description: Get started with Gemini 3 using the AI SDK.
tags: ['getting-started']
---

# Get started with Gemini 3

With the release of Gemini 3, Google's most intelligent model to date, there has never been a better time to start building AI applications that combine state-of-the-art reasoning with multimodal understanding.

The [AI SDK](/) is a powerful TypeScript toolkit for building AI applications with large language models (LLMs) like Gemini 3 alongside popular frameworks like React, Next.js, Vue, Svelte, Node.js, and more.

## Gemini 3

Gemini 3 represents a significant leap forward in AI capabilities, combining all of Gemini's strengths together to help you bring any idea to life. It delivers:

- State-of-the-art reasoning with unprecedented depth and nuance
- PhD-level performance on complex benchmarks like Humanity's Last Exam (37.5%) and GPQA Diamond (91.9%)
- Leading multimodal understanding with 81% on MMMU-Pro and 87.6% on Video-MMMU
- Best-in-class vibe coding and agentic capabilities
- Superior long-horizon planning for multi-step workflows

Gemini 3 Pro is currently available in preview, offering great performance across all benchmarks.

## Getting Started with the AI SDK

The AI SDK is the TypeScript toolkit designed to help developers build AI-powered applications with React, Next.js, Vue, Svelte, Node.js, and more. Integrating LLMs into applications is complicated and heavily dependent on the specific model provider you use.

The AI SDK abstracts away the differences between model providers, eliminates boilerplate code for building chatbots, and allows you to go beyond text output to generate rich, interactive components.

At the center of the AI SDK is [AI SDK Core](/docs/ai-sdk-core/overview), which provides a unified API to call any LLM. The code snippet below is all you need to call Gemini 3 with the AI SDK:

```ts
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

const { text } = await generateText({
  model: google('gemini-3-pro-preview'),
  prompt: 'Explain the concept of the Hilbert space.',
});
console.log(text);
```

### Enhanced Reasoning with Thinking Mode

Gemini 3 models can use enhanced reasoning through thinking mode, which improves their ability to solve complex problems. You can control the thinking level using the `thinkingLevel` provider option:

```ts
import { google, GoogleLanguageModelOptions } from '@ai-sdk/google';
import { generateText } from 'ai';

const { text } = await generateText({
  model: google('gemini-3-pro-preview'),
  prompt: 'What is the sum of the first 10 prime numbers?',
  providerOptions: {
    google: {
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: 'low',
      },
    } satisfies GoogleLanguageModelOptions,
  },
});

console.log(text);
```

The `thinkingLevel` parameter accepts different values to control the depth of reasoning applied to your prompt:

- Gemini 3 Pro supports: `'low'` and `'high'`
- Gemini 3 Flash supports: `'minimal'`, `'low'`, `'medium'`, and `'high'`

### Using Tools with the AI SDK

Gemini 3 excels at tool calling with improved reliability and consistency for multi-step workflows. Here's an example of using tool calling with the AI SDK:

```ts
import { z } from 'zod';
import { generateText, tool, isStepCount } from 'ai';
import { google } from '@ai-sdk/google';

const result = await generateText({
  model: google('gemini-3-pro-preview'),
  prompt: 'What is the weather in San Francisco?',
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
  },
  stopWhen: isStepCount(5), // enables multi-step calling
});

console.log(result.text);

console.log(result.steps);
```

### Using Google Search with Gemini

With [search grounding](https://ai.google.dev/gemini-api/docs/google-search), Gemini can access the latest information using Google search. Here's an example of using Google Search with the AI SDK:

```ts
import { google } from '@ai-sdk/google';
import { GoogleProviderMetadata } from '@ai-sdk/google';
import { generateText } from 'ai';

const { text, sources, providerMetadata } = await generateText({
  model: google('gemini-3-pro-preview'),
  tools: {
    google_search: google.tools.googleSearch({}),
  },
  prompt:
    'List the top 5 San Francisco news from the past week.' +
    'You must include the date of each article.',
});

// access the grounding metadata. Casting to the provider metadata type
// is optional but provides autocomplete and type safety.
const metadata = providerMetadata?.google as GoogleProviderMetadata | undefined;
const groundingMetadata = metadata?.groundingMetadata;
const safetyRatings = metadata?.safetyRatings;

console.log({ text, sources, groundingMetadata, safetyRatings });
```

### Building Interactive Interfaces

AI SDK Core can be paired with [AI SDK UI](/docs/ai-sdk-ui/overview), another powerful component of the AI SDK, to streamline the process of building chat, completion, and assistant interfaces with popular frameworks like Next.js, Nuxt, SvelteKit, and SolidStart.

AI SDK UI provides robust abstractions that simplify the complex tasks of managing chat streams and UI updates on the frontend, enabling you to develop dynamic AI-driven interfaces more efficiently.

With three main hooks — [`useChat`](/docs/reference/ai-sdk-ui/use-chat), [`useCompletion`](/docs/reference/ai-sdk-ui/use-completion), and [`useObject`](/docs/reference/ai-sdk-ui/use-object) — you can incorporate real-time chat capabilities, text completions, and streamed JSON into your app.

Let's explore building a chatbot with [Next.js](https://nextjs.org), the AI SDK, and Gemini 3 Pro:

In a new Next.js application, first install the AI SDK and the Google provider:

<Snippet text="pnpm install ai @ai-sdk/google" />

Then, create a route handler for the chat endpoint:

```tsx filename="app/api/chat/route.ts"
import { google } from '@ai-sdk/google';
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google('gemini-3-pro-preview'),
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

Finally, update the root page (`app/page.tsx`) to use the `useChat` hook:

```tsx filename="app/page.tsx"
'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useChat();
  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'Gemini: '}
          {message.parts.map((part, i) => {
            switch (part.type) {
              case 'text':
                return <div key={`${message.id}-${i}`}>{part.text}</div>;
            }
          })}
        </div>
      ))}

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput('');
        }}
      >
        <input
          className="fixed dark:bg-zinc-900 bottom-0 w-full max-w-md p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={e => setInput(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}
```

The useChat hook on your root page (`app/page.tsx`) will make a request to your AI provider endpoint (`app/api/chat/route.ts`) whenever the user submits a message. The messages are then displayed in the chat UI.

## Get Started

Ready to dive in? Here's how you can begin:

1. Explore the documentation at [ai-sdk.dev/docs](/docs) to understand the capabilities of the AI SDK.
2. Check out practical examples at [ai-sdk.dev/examples](/examples) to see the SDK in action.
3. Dive deeper with advanced guides on topics like Retrieval-Augmented Generation (RAG) at [ai-sdk.dev/docs/guides](/cookbook/guides).
4. Use ready-to-deploy AI templates at [vercel.com/templates?type=ai](https://vercel.com/templates?type=ai).
5. Read more about the [Google provider](/providers/ai-sdk-providers/google).
