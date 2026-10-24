---
title: Get started with Claude 3.7 Sonnet
description: Get started with Claude 3.7 Sonnet using the AI SDK.
tags: ['getting-started']
---

# Get started with Claude 3.7 Sonnet

<Note type="warning">
  This guide is deprecated. [Claude 3.7 Sonnet was retired on February 19,
  2026](https://platform.claude.com/docs/en/about-claude/model-deprecations#2025-10-28-claude-sonnet-3-7-model)
  and can no longer be used with the Anthropic API.
</Note>

With the [release of Claude 3.7 Sonnet](https://www.anthropic.com/news/claude-3-7-sonnet), there has never been a better time to start building AI applications, particularly those that require complex reasoning capabilities.

The [AI SDK](/) is a powerful TypeScript toolkit for building AI applications with large language models (LLMs) like Claude 3.7 Sonnet alongside popular frameworks like React, Next.js, Vue, Svelte, Node.js, and more.

## Claude 3.7 Sonnet

Claude 3.7 Sonnet is Anthropic's most intelligent model to date and the first Claude model to offer extended thinking—the ability to solve complex problems with careful, step-by-step reasoning. With Claude 3.7 Sonnet, you can balance speed and quality by choosing between standard thinking for near-instant responses or extended thinking or advanced reasoning. Claude 3.7 Sonnet is state-of-the-art for coding, and delivers advancements in computer use, agentic capabilities, complex reasoning, and content generation. With frontier performance and more control over speed, Claude 3.7 Sonnet is a great choice for powering AI agents, especially customer-facing agents, and complex AI workflows.

## Getting Started with the AI SDK

The AI SDK is the TypeScript toolkit designed to help developers build AI-powered applications with React, Next.js, Vue, Svelte, Node.js, and more. Integrating LLMs into applications is complicated and heavily dependent on the specific model provider you use.

The AI SDK abstracts away the differences between model providers, eliminates boilerplate code for building chatbots, and allows you to go beyond text output to generate rich, interactive components.

At the center of the AI SDK is [AI SDK Core](/docs/ai-sdk-core/overview), which provides a unified API to call any LLM. The code snippet below is all you need to call Claude 3.7 Sonnet with the AI SDK:

```ts
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const { text, reasoningText, reasoning } = await generateText({
  model: anthropic('claude-3-7-sonnet-20250219'),
  prompt: 'How many people will live in the world in 2040?',
});
console.log(text); // text response
```

The unified interface also means that you can easily switch between providers by changing just two lines of code. For example, to use Claude 3.7 Sonnet via Amazon Bedrock:

```ts
import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

const { reasoning, text } = await generateText({
  model: amazonBedrock('anthropic.claude-3-7-sonnet-20250219-v1:0'),
  prompt: 'How many people will live in the world in 2040?',
});
```

### Reasoning Ability

Claude 3.7 Sonnet introduces a new extended thinking—the ability to solve complex problems with careful, step-by-step reasoning. You can enable it using the `thinking` provider option and specifying a thinking budget in tokens:

```ts
import { anthropic, AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const { text, reasoningText, reasoning } = await generateText({
  model: anthropic('claude-3-7-sonnet-20250219'),
  prompt: 'How many people will live in the world in 2040?',
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 12000 },
    } satisfies AnthropicLanguageModelOptions,
  },
});

console.log(reasoningText); // reasoning text
console.log(reasoning); // reasoning details including redacted reasoning
console.log(text); // text response
```

### Building Interactive Interfaces

AI SDK Core can be paired with [AI SDK UI](/docs/ai-sdk-ui/overview), another powerful component of the AI SDK, to streamline the process of building chat, completion, and assistant interfaces with popular frameworks like Next.js, Nuxt, and SvelteKit.

AI SDK UI provides robust abstractions that simplify the complex tasks of managing chat streams and UI updates on the frontend, enabling you to develop dynamic AI-driven interfaces more efficiently.

With four main hooks — [`useChat`](/docs/reference/ai-sdk-ui/use-chat), [`useCompletion`](/docs/reference/ai-sdk-ui/use-completion), and [`useObject`](/docs/reference/ai-sdk-ui/use-object) — you can incorporate real-time chat capabilities, text completions, streamed JSON, and interactive assistant features into your app.

Let's explore building a chatbot with [Next.js](https://nextjs.org), the AI SDK, and Claude 3.7 Sonnet:

In a new Next.js application, first install the AI SDK and the Anthropic provider:

<Snippet text="pnpm install ai @ai-sdk/anthropic" />

Then, create a route handler for the chat endpoint:

```tsx filename="app/api/chat/route.ts"
import { anthropic, AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    messages: await convertToModelMessages(messages),
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 12000 },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendReasoning: true,
    }),
  });
}
```

<Note>
  You can forward the model's reasoning tokens to the client with
  `sendReasoning: true` in the `toUIMessageStream` helper.
</Note>

Finally, update the root page (`app/page.tsx`) to use the `useChat` hook:

```tsx filename="app/page.tsx"
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export default function Page() {
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
    }
  };

  return (
    <>
      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            // text parts:
            if (part.type === 'text') {
              return <div key={index}>{part.text}</div>;
            }
            // reasoning parts:
            if (part.type === 'reasoning') {
              return <pre key={index}>{part.text}</pre>;
            }
          })}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          name="prompt"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
```

<Note>
  You can access the model's reasoning tokens with the `reasoning` part on the
  message `parts`.
</Note>

The useChat hook on your root page (`app/page.tsx`) will make a request to your LLM provider endpoint (`app/api/chat/route.ts`) whenever the user submits a message. The messages are then displayed in the chat UI.

## Get Started

Ready to dive in? Here's how you can begin:

1. Explore the documentation at [ai-sdk.dev/docs](/docs) to understand the capabilities of the AI SDK.
2. Check out practical examples at [ai-sdk.dev/examples](/examples) to see the SDK in action.
3. Dive deeper with advanced guides on topics like Retrieval-Augmented Generation (RAG) at [ai-sdk.dev/docs/guides](/cookbook/guides).
4. Use ready-to-deploy AI templates at [vercel.com/templates?type=ai](https://vercel.com/templates?type=ai).

Claude 3.7 Sonnet opens new opportunities for reasoning-intensive AI applications. Start building today and leverage the power of advanced reasoning in your AI projects.
