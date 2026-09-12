---
title: Get started with Claude 4
description: Get started with Claude 4 using the AI SDK.
tags: ['getting-started']
---

# Get started with Claude 4

With the release of Claude 4, there has never been a better time to start building AI applications, particularly those that require complex reasoning capabilities and advanced intelligence.

The [AI SDK](/) is a powerful TypeScript toolkit for building AI applications with large language models (LLMs) like Claude 4 alongside popular frameworks like React, Next.js, Vue, Svelte, Node.js, and more.

## Claude 4

Claude 4 is Anthropic's most advanced model family to date, offering exceptional capabilities across reasoning, instruction following, coding, and knowledge tasks. Available in two variants—Sonnet and Opus—Claude 4 delivers state-of-the-art performance with enhanced reliability and control. Claude 4 builds on the extended thinking capabilities introduced in Claude 3.7, allowing for even more sophisticated problem-solving through careful, step-by-step reasoning.

Claude 4 excels at complex reasoning, code generation and analysis, detailed content creation, and agentic capabilities, making it ideal for powering sophisticated AI workflows, customer-facing agents, and applications requiring nuanced understanding and responses. Claude Opus 4 is an excellent coding model, leading on SWE-bench (72.5%) and Terminal-bench (43.2%), with the ability to sustain performance on long-running tasks that require focused effort and thousands of steps. Claude Sonnet 4 significantly improves on Sonnet 3.7, excelling in coding with 72.7% on SWE-bench while balancing performance and efficiency.

### Prompt Engineering for Claude 4 Models

Claude 4 models respond well to clear, explicit instructions. The following best practices can help achieve optimal performance:

1. **Provide explicit instructions**: Clearly state what you want the model to do, including specific steps or formats for the response.
2. **Include context and motivation**: Explain why a task is being performed to help the model better understand the underlying goals.
3. **Avoid negative examples**: When providing examples, only demonstrate the behavior you want to see, not what you want to avoid.

## Getting Started with the AI SDK

The AI SDK is the TypeScript toolkit designed to help developers build AI-powered applications with React, Next.js, Vue, Svelte, Node.js, and more. Integrating LLMs into applications is complicated and heavily dependent on the specific model provider you use.

The AI SDK abstracts away the differences between model providers, eliminates boilerplate code for building chatbots, and allows you to go beyond text output to generate rich, interactive components.

At the center of the AI SDK is [AI SDK Core](/docs/ai-sdk-core/overview), which provides a unified API to call any LLM. The code snippet below is all you need to call Claude 4 Sonnet with the AI SDK:

```ts
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const { text, reasoningText, reasoning } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'How will quantum computing impact cryptography by 2050?',
});
console.log(text);
```

### Reasoning Ability

Claude 4 enhances the extended thinking capabilities first introduced in Claude 3.7 Sonnet—the ability to solve complex problems with careful, step-by-step reasoning. Additionally, both Opus 4 and Sonnet 4 can now use tools during extended thinking, allowing Claude to alternate between reasoning and tool use to improve responses. You can enable extended thinking using the `thinking` provider option and specifying a thinking budget in tokens. For interleaved thinking (where Claude can think in between tool calls) you'll need to enable a beta feature using the `anthropic-beta` header:

```ts
import { anthropic, AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const { text, reasoningText, reasoning } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'How will quantum computing impact cryptography by 2050?',
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 15000 },
    } satisfies AnthropicLanguageModelOptions,
  },
  headers: {
    'anthropic-beta': 'interleaved-thinking-2025-05-14',
  },
});

console.log(text); // text response
console.log(reasoningText); // reasoning text
console.log(reasoning); // reasoning details including redacted reasoning
```

### Building Interactive Interfaces

AI SDK Core can be paired with [AI SDK UI](/docs/ai-sdk-ui/overview), another powerful component of the AI SDK, to streamline the process of building chat, completion, and assistant interfaces with popular frameworks like Next.js, Nuxt, SvelteKit, and SolidStart.

AI SDK UI provides robust abstractions that simplify the complex tasks of managing chat streams and UI updates on the frontend, enabling you to develop dynamic AI-driven interfaces more efficiently.

With three main hooks — [`useChat`](/docs/reference/ai-sdk-ui/use-chat), [`useCompletion`](/docs/reference/ai-sdk-ui/use-completion), and [`useObject`](/docs/reference/ai-sdk-ui/use-object) — you can incorporate real-time chat capabilities, text completions, and streamed JSON into your app.

Let's explore building a chatbot with [Next.js](https://nextjs.org), the AI SDK, and Claude Sonnet 4:

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
    model: anthropic('claude-sonnet-4-20250514'),
    messages: await convertToModelMessages(messages),
    headers: {
      'anthropic-beta': 'interleaved-thinking-2025-05-14',
    },
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 15000 },
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
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map(message => (
          <div
            key={message.id}
            className={`p-3 rounded-lg ${
              message.role === 'user' ? 'bg-blue-50 ml-auto' : 'bg-gray-50'
            }`}
          >
            <p className="font-semibold">
              {message.role === 'user' ? 'You' : 'Claude 4'}
            </p>
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return (
                  <div key={index} className="mt-1">
                    {part.text}
                  </div>
                );
              }
              if (part.type === 'reasoning') {
                return (
                  <pre
                    key={index}
                    className="bg-gray-100 p-2 rounded mt-2 text-xs overflow-x-auto"
                  >
                    <details>
                      <summary className="cursor-pointer">
                        View reasoning
                      </summary>
                      {part.text}
                    </details>
                  </pre>
                );
              }
            })}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          name="prompt"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ask Claude 4 something..."
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

<Note>
  You can access the model's reasoning tokens with the `reasoning` part on the
  message `parts`. The reasoning text is available in the `text` property of the
  reasoning part.
</Note>

The useChat hook on your root page (`app/page.tsx`) will make a request to your LLM provider endpoint (`app/api/chat/route.ts`) whenever the user submits a message. The messages are then displayed in the chat UI.

### Claude 4 Model Variants

Claude 4 is available in two variants, each optimized for different use cases:

- **Claude Sonnet 4**: Balanced performance suitable for most enterprise applications, with significant improvements over Sonnet 3.7.
- **Claude Opus 4**: Anthropic's most powerful model and the best coding model available. Excels at sustained performance on long-running tasks that require focused effort and thousands of steps, with the ability to work continuously for several hours.

## Get Started

Ready to dive in? Here's how you can begin:

1. Explore the documentation at [ai-sdk.dev/docs](/docs) to understand the capabilities of the AI SDK.
2. Check out practical examples at [ai-sdk.dev/examples](/examples) to see the SDK in action.
3. Dive deeper with advanced guides on topics like Retrieval-Augmented Generation (RAG) at [ai-sdk.dev/docs/guides](/cookbook/guides).
4. Use ready-to-deploy AI templates at [vercel.com/templates?type=ai](https://vercel.com/templates?type=ai).
