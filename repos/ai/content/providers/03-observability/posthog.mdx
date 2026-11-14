---
title: PostHog
description: Monitor and analyze LLM usage with PostHog
---

# PostHog LLM Analytics

[PostHog](https://posthog.com/) is an open source product analytics platform. With the PostHog LLM Analytics integration, you can track LLM usage alongside your product analytics to understand how AI features impact user behavior. PostHog provides:

- [LLM analytics](https://posthog.com/docs/llm-analytics/start-here) — cost, latency, and token usage per model and user
- [Product analytics](https://posthog.com/docs/product-analytics) — connect AI usage to user behavior and business metrics
- [Experiments](https://posthog.com/docs/experiments) — A/B test prompts, models, and AI features

## Setup

PostHog supports [AI SDK telemetry data](/docs/ai-sdk-core/telemetry) through [OpenTelemetry](https://opentelemetry.io/docs/). The `PostHogTraceExporter` from the `@posthog/ai` package sends `gen_ai.*` spans to PostHog's OTLP ingestion endpoint, where they are automatically converted into `$ai_generation` events.

<Tabs items={["Next.js", "Node.js"]}>
<Tab>

Next.js has built-in support for OpenTelemetry instrumentation via the [instrumentation hook](https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry).

**Step 1.** Install dependencies

```bash
npm install @posthog/ai @opentelemetry/sdk-node @opentelemetry/resources @ai-sdk/otel
```

**Step 2.** Create an `instrumentation.ts` file in your project root and register the AI SDK telemetry integration alongside your OTel setup:

```ts filename="instrumentation.ts"
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PostHogTraceExporter } from '@posthog/ai/otel';

registerTelemetry(new LegacyOpenTelemetry());

export function register() {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'my-nextjs-app',
    }),
    traceExporter: new PostHogTraceExporter({
      apiKey: process.env.POSTHOG_API_KEY!,
      host: 'https://us.i.posthog.com', // use https://eu.i.posthog.com for EU
    }),
  });
  sdk.start();
}
```

**Step 3.** Use the AI SDK with telemetry enabled in your route handlers or server actions

```ts highlight="6-11"
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Tell me a fun fact about hedgehogs.',
  telemetry: {
    functionId: 'my-ai-function',
    metadata: {
      posthog_distinct_id: 'user_123', // optional: links events to a PostHog user
    },
  },
});
```

</Tab>
<Tab>

**Step 1.** Install dependencies

```bash
npm install @posthog/ai @opentelemetry/sdk-node @opentelemetry/resources @ai-sdk/otel
```

**Step 2.** Initialize the OpenTelemetry SDK with PostHog's trace exporter

```ts filename="tracing.ts"
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PostHogTraceExporter } from '@posthog/ai/otel';
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'my-ai-app',
  }),
  traceExporter: new PostHogTraceExporter({
    apiKey: '<your-posthog-project-api-key>',
    host: 'https://us.i.posthog.com', // use https://eu.i.posthog.com for EU
  }),
});
sdk.start();
registerTelemetry(new LegacyOpenTelemetry());
```

**Step 3.** Use the AI SDK. Telemetry is captured automatically once the integration is registered:

```ts highlight="6-12"
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Tell me a fun fact about hedgehogs.',
  telemetry: {
    functionId: 'my-ai-function',
    metadata: {
      posthog_distinct_id: 'user_123', // optional: links events to a PostHog user
    },
  },
});

console.log(result.text);

await sdk.shutdown();
```

</Tab>
</Tabs>

<Note>
  The integration supports streaming functions like `streamText`. Each streamed
  call will produce `ai.streamText` spans that are captured by PostHog.
</Note>

## Configuration

### Linking events to PostHog users

Pass `posthog_distinct_id` in the `metadata` field to associate LLM events with a specific user in PostHog. If omitted, events are captured anonymously.

```ts highlight="6"
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Write a short story about a cat.',
  telemetry: {
    metadata: {
      posthog_distinct_id: 'user_123',
    },
  },
});
```

### Privacy controls

You can disable recording of inputs and outputs by setting `recordInputs` and `recordOutputs` to `false`:

```ts highlight="5-6"
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Write a short story about a cat.',
  telemetry: {
    recordInputs: false,
    recordOutputs: false,
  },
});
```

## Resources

- [PostHog LLM analytics docs](https://posthog.com/docs/llm-analytics/start-here)
- [PostHog AI SDK package](https://www.npmjs.com/package/@posthog/ai)
- [PostHog](https://posthog.com/)
