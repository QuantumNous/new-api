---
title: Sentry
description: Monitor AI SDK calls and agent traces with Sentry
---

# Sentry Observability

[Sentry](https://sentry.io/) helps you monitor errors, traces, latency, and
token usage for AI applications. Sentry's Next.js and Node.js SDKs instrument
AI SDK v7 through the native Node.js telemetry channel, so you do not need
`@ai-sdk/otel`
or `registerTelemetry` to send AI SDK traces to Sentry.

Sentry captures spans for `generateText`, `streamText`, model calls, tool calls,
embeddings, reranking, token usage, and errors. Add a `functionId` with the AI
SDK `telemetry` option to make traces easier to find and group in Sentry.

<Note>
  AI SDK v7 support requires `@sentry/node`, `@sentry/nextjs`, or another Sentry
  server SDK version `10.62.0` or later. The native telemetry channel is
  available in the Node.js runtime; use a Node.js route or server process for
  these traces.
</Note>

## Setup

If Sentry is already configured in your application, skip to [Usage](#usage).
Otherwise, install and initialize the Sentry SDK for your runtime before running
AI SDK calls.

### Next.js

The Sentry wizard can create the full Next.js setup for you. The snippets below
show the server-side pieces relevant to AI SDK traces:

```bash
pnpm add @sentry/nextjs
```

Create or update your Sentry server config and enable tracing with
`tracesSampleRate` or `tracesSampler`:

```ts filename="sentry.server.config.ts"
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

If you are setting up Sentry manually in Next.js, make sure your
`instrumentation.ts` loads the server config for the Node.js runtime:

```ts filename="instrumentation.ts"
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}
```

### Node.js

```bash
pnpm add @sentry/node
```

Initialize Sentry at the start of your server entry point and enable tracing with
`tracesSampleRate` or `tracesSampler`:

```ts filename="instrumentation.ts"
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

The Vercel AI integration is enabled by default in Sentry server SDKs. If you
have disabled default integrations, add it back explicitly:

```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  integrations: [Sentry.vercelAIIntegration()],
});
```

## Usage

Use the AI SDK normally. No `registerTelemetry(new OpenTelemetry())` call and no
`telemetry.isEnabled: true` flag are required for Sentry.

```ts filename="app/api/generate/route.ts"
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

export const runtime = 'nodejs';

export async function POST() {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: 'What is the weather in Tokyo?',
    telemetry: {
      functionId: 'anthropic-weather-demo',
    },
  });

  return Response.json({ text: result.text });
}
```

For a standalone Node.js script, wrap the AI SDK call in a Sentry span so the AI
spans have a parent trace, then flush before the process exits:

```ts filename="index.ts"
import './instrumentation';
import * as Sentry from '@sentry/node';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

await Sentry.startSpan({ name: 'ai-sdk-demo' }, async () => {
  const result = await generateText({
    model: openai('gpt-5-mini'),
    prompt: 'Write a haiku about observability.',
    telemetry: {
      functionId: 'haiku-demo',
    },
  });

  console.log(result.text);
});

await Sentry.flush(2000);
```

After the request runs, open Sentry and look for `gen_ai.invoke_agent`,
`gen_ai.generate_content`, and `gen_ai.execute_tool` spans in your traces.

## Recording prompts and responses

By default, Sentry records metadata such as model, provider, latency, token
usage, and errors. Prompt and response content are only sent if you opt in.

Enable content capture globally with Sentry's `dataCollection.genAI` options:

```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  dataCollection: {
    genAI: {
      inputs: true,
      outputs: true,
    },
  },
});
```

Or enable it for one AI SDK call with the `telemetry` option:

```ts
const result = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Summarize this support ticket.',
  telemetry: {
    functionId: 'support-summary',
    recordInputs: true,
    recordOutputs: true,
  },
});
```

To opt out of Sentry AI telemetry for a sensitive call, set `telemetry.isEnabled`
to `false`.

## Resources

- [Sentry Vercel AI SDK integration documentation for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/integrations/vercelai/)
- [Sentry Vercel AI SDK integration documentation for Node.js](https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/vercelai/)
- [AI SDK telemetry documentation](/docs/ai-sdk-core/telemetry)
