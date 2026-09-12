---
title: Raindrop
description: Monitor AI SDK calls and agent traces with Raindrop
---

# Raindrop Observability

[Raindrop](https://www.raindrop.ai/) provides observability for AI applications. Its AI SDK integration records events and traces for `generateText`, `streamText`, `generateObject`, `streamObject`, model calls, tool calls, errors, latency, and token usage.

Raindrop supports the AI SDK v7 telemetry interface directly, so you can use `registerTelemetry` and the `telemetry` option without adding OpenTelemetry setup.

## Setup

Install the Raindrop AI SDK integration:

<InstallPackages packages="@raindrop-ai/ai-sdk" />

Set your Raindrop write key (create one in the [Raindrop dashboard](https://www.raindrop.ai/)):

```bash filename=".env.local"
RAINDROP_WRITE_KEY="..."
```

Then register Raindrop once at application startup. `raindrop()` reads `RAINDROP_WRITE_KEY` automatically and needs no `@ai-sdk/otel` or OpenTelemetry setup:

```ts filename="instrumentation.ts"
import { registerTelemetry } from 'ai';
import { raindrop } from '@raindrop-ai/ai-sdk';

registerTelemetry(raindrop());
```

## Usage

Once registered, AI SDK calls emit telemetry automatically. Use the `telemetry` option for function-level settings such as `functionId`:

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Write a short welcome message for a new user.',
  telemetry: {
    functionId: 'welcome-message',
  },
});
```

Raindrop records an event once a `userId` is available, so set the Raindrop `context` to attribute calls to a user. Provide it globally when you register (`raindrop({ context: { userId } })`) or per request via `telemetry.integrations` (see below). Without a `userId`, Raindrop still records a trace for the call but does not emit an event.

## Request-specific Raindrop context

If Raindrop event fields such as `userId`, `convoId`, or `eventName` change per request, pass a Raindrop integration through `telemetry.integrations` for that call:

```ts highlight="8-10,15-19,21"
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { raindrop } from '@raindrop-ai/ai-sdk';

const userId = 'user_123';
const convoId = 'chat_456';

const raindropTelemetry = raindrop({
  context: { userId, convoId, eventName: 'support-chat' },
});

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Summarize the latest support ticket.',
  telemetry: {
    functionId: 'support-summary',
    integrations: [raindropTelemetry],
  },
});

await raindropTelemetry.flush();
```

<Note>
  Per-call `telemetry.integrations` replace globally registered integrations for
  that call. If you also use another telemetry integration, include it in the
  same `integrations` array.
</Note>

## Streaming

Streaming calls work the same way. For AI SDK UI routes, return the v7 stream helpers and flush Raindrop when the stream finishes:

```ts filename="app/api/chat/route.ts" highlight="15-27"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { raindrop } from '@raindrop-ai/ai-sdk';

export async function POST(req: Request) {
  const { id, messages, userId } = (await req.json()) as {
    id: string;
    messages: UIMessage[];
    userId: string;
  };

  const raindropTelemetry = raindrop({
    context: { userId, convoId: id, eventName: 'chat' },
  });

  const result = streamText({
    model: openai('gpt-5-mini'),
    messages: await convertToModelMessages(messages),
    telemetry: {
      functionId: 'chat-route',
      integrations: [raindropTelemetry],
    },
    onEnd: async () => {
      await raindropTelemetry.flush();
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

## Privacy controls

`recordInputs` and `recordOutputs` control whether prompts and responses are attached to the **trace spans**:

```ts
const result = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Summarize this private document.',
  telemetry: {
    recordInputs: false,
    recordOutputs: false,
  },
});
```

These flags only affect span attributes. Raindrop's event payload still records the input (the last user message) and the output (the final text). To keep sensitive content out of Raindrop entirely, disable event capture so only traces are recorded:

```ts
registerTelemetry(raindrop({ events: { enabled: false } }));
```

Credential-shaped values in provider options are stripped from traces by default; customize this with `traces.transformSpan` or `traces.disableDefaultRedaction`.

## Resources

- [Raindrop AI SDK integration](https://www.raindrop.ai/docs/integrations/vercel-ai-sdk/)
- [AI SDK telemetry documentation](/docs/ai-sdk-core/telemetry)
