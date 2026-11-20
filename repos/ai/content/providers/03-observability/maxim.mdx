---
title: Maxim
description: Evaluate & Observe LLM applications with Maxim
---

# Maxim Observability

[Maxim AI](https://getmaxim.ai) streamlines AI application development and deployment by applying traditional software best practices to non-deterministic AI workflows. Our evaluation and observability tools help teams maintain quality, reliability, and speed throughout the AI application lifecycle. Maxim integrates with the AI SDK to provide:

- Automatic Observability – Adds tracing, logging, and metadata to AI SDK calls with a simple wrapper.

- Unified Model Wrapping – Supports OpenAI, Anthropic, and Google etc. models uniformly.

- Custom Metadata & Tagging – Enables attaching trace names, tags, and session IDs to track usage.

- Streaming & Structured Output Support – Handles streaming responses and structured outputs seamlessly.

# Setting up Maxim with the AI SDK

## Requirements

```
"ai"
"@ai-sdk/openai"
"@ai-sdk/anthropic"
"@ai-sdk/google"
"@maximai/maxim-js"
```

## Environment Variables

```
MAXIM_API_KEY=
MAXIM_LOG_REPO_ID=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

## Initialize Logger

```javascript
import { Maxim } from '@maximai/maxim-js';

async function initializeMaxim() {
  const apiKey = process.env.MAXIM_API_KEY || '';
  if (!apiKey) {
    throw new Error(
      'MAXIM_API_KEY is not defined in the environment variables',
    );
  }

  const maxim = new Maxim({ apiKey });
  const logger = await maxim.logger({
    id: process.env.MAXIM_LOG_REPO_ID || '',
  });

  if (!logger) {
    throw new Error('Logger is not available');
  }

  return { maxim, logger };
}
```

## Wrap AI SDK Models with Maxim

```javascript
import { openai } from '@ai-sdk/openai';
import { wrapMaximAISDKModel } from '@maximai/maxim-js/vercel-ai-sdk';

const model = wrapMaximAISDKModel(openai('gpt-5'), logger);
```

## Make LLM calls using wrapped models

```javascript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { wrapMaximAISDKModel } from '@maximai/maxim-js/vercel-ai-sdk';

const model = wrapMaximAISDKModel(openai('gpt-5'), logger);

// Generate text with automatic logging
const response = await generateText({
  model: model,
  prompt: 'Write a haiku about recursion in programming.',
  temperature: 0.8,
  system: 'You are a helpful assistant.',
});

console.log('Response:', response.text);
```

## Working with Different AI SDK Functions

The wrapped model works seamlessly with all Vercel AI SDK functions:

### **Structured Output**

```javascript
import { generateText, Output } from 'ai';
import { z } from 'zod';

const response = await generateText({
  model: model,
  prompt: 'Generate a user profile for John Doe',
  output: Output.object({
    schema: z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
      interests: z.array(z.string()),
    }),
  }),
});

console.log(response.output);
```

### **Stream Text**

```javascript
import { streamText } from 'ai';

const { textStream } = await streamText({
  model: model,
  prompt: 'Write a short story about space exploration',
  system: 'You are a creative writer',
});

for await (const textPart of textStream) {
  process.stdout.write(textPart);
}
```

## Custom Metadata and Tracing

### **Using Custom Metadata**

```javascript
import { MaximVercelProviderMetadata } from '@maximai/maxim-js/vercel-ai-sdk';

const response = await generateText({
  model: model,
  prompt: 'Hello, how are you?',
  providerOptions: {
    maxim: {
      traceName: 'custom-trace-name',
      traceTags: {
        type: 'demo',
        priority: 'high',
      },
    } as MaximVercelProviderMetadata,
  },
});
```

### **Available Metadata Fields**

**Entity Naming:**

- `sessionName` - Override the default session name
- `traceName` - Override the default trace name
- `spanName` - Override the default span name
- `generationName` - Override the default LLM generation name

**Entity Tagging:**

- `sessionTags` - Add custom tags to the session `(object: {key: value})`
- `traceTags` - Add custom tags to the trace `(object: {key: value})`
- `spanTags` - Add custom tags to span `(object: {key: value})`
- `generationTags` - Add custom tags to LLM generations `(object: {key: value})`

**ID References:**

- `sessionId` - Link this trace to an existing session
- `traceId` - Use a specific trace ID
- `spanId` - Use a specific span ID

![Maxim Demo](https://cdn.getmaxim.ai/public/images/maxim_vercel.gif)

## Streaming Support

```javascript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { wrapMaximAISDKModel, MaximVercelProviderMetadata } from '@maximai/maxim-js/vercel-ai-sdk';

const model = wrapMaximAISDKModel(openai('gpt-5'), logger);

const { textStream } = await streamText({
  model: model,
  prompt: 'Write a story about a robot learning to paint.',
  system: 'You are a creative storyteller',
  providerOptions: {
    maxim: {
      traceName: 'Story Generation',
      traceTags: {
        type: 'creative',
        format: 'streaming'
      },
    } as MaximVercelProviderMetadata,
  },
});

for await (const textPart of textStream) {
  process.stdout.write(textPart);
}
```

## Multiple Provider Support

```javascript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { wrapMaximAISDKModel } from '@maximai/maxim-js/vercel-ai-sdk';

// Wrap different provider models
const openaiModel = wrapMaximAISDKModel(openai('gpt-5'), logger);
const anthropicModel = wrapMaximAISDKModel(
  anthropic('claude-3-5-sonnet-20241022'),
  logger,
);
const googleModel = wrapMaximAISDKModel(google('gemini-pro'), logger);

// Use them with the same interface
const responses = await Promise.all([
  generateText({ model: openaiModel, prompt: 'Hello from OpenAI' }),
  generateText({ model: anthropicModel, prompt: 'Hello from Anthropic' }),
  generateText({ model: googleModel, prompt: 'Hello from Google' }),
]);
```

## Next.js Integration

### **API Route Example**

```javascript
// app/api/chat/route.js
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { wrapMaximAISDKModel, MaximVercelProviderMetadata } from '@maximai/maxim-js/vercel-ai-sdk';
import { Maxim } from "@maximai/maxim-js";

const maxim = new Maxim({ apiKey });
const logger = await maxim.logger({ id: process.env.MAXIM_LOG_REPO_ID });
const model = wrapMaximAISDKModel(openai('gpt-5'), logger);

export async function POST(req) {
  const { messages } = await req.json();

  const result = await streamText({
    model: model,
    messages,
    system: 'You are a helpful assistant',
    providerOptions: {
      maxim: {
        traceName: 'Chat API',
        traceTags: {
          endpoint: '/api/chat',
          type: 'conversation'
        },
      } as MaximVercelProviderMetadata,
    },
  });

  return result.toAIStreamResponse();
}
```

### **Client-side Integration**

```javascript
// components/Chat.jsx
import { useChat } from 'ai/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Say something..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## Learn more

- After setting up Maxim tracing for the Vercel AI SDK, you can explore other Maxim platform capabilities:
  - Prompt Management: Version, manage, and dynamically apply prompts across environments and agents.
  - Evaluations: Run automated and manual evaluations on traces, generations, and full agent trajectories.
  - Simulations: Test agents in real-world scenarios with simulated multi-turn interactions and workflows.

For further details, checkout Vercel AI SDK's [Maxim integration documentation](https://www.getmaxim.ai/docs/sdk/typescript/integrations/vercel/vercel).
