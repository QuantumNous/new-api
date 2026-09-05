---
title: Langfuse
description: Monitor, evaluate and debug your AI SDK application with Langfuse
---

# Langfuse Observability

[Langfuse](https://langfuse.com/) ([GitHub](https://github.com/langfuse/langfuse)) is an open source LLM engineering platform that helps teams to collaboratively develop, monitor, and debug AI applications. Langfuse integrates with the AI SDK to provide:

- [Application traces](https://langfuse.com/docs/tracing)
- Usage patterns
- Cost data by user and model
- Replay sessions to debug issues
- [Evaluations](https://langfuse.com/docs/scores/overview)

## Setup

The AI SDK v7 uses a callback-based telemetry system. Langfuse integrates with it through `@langfuse/vercel-ai-sdk`, while `LangfuseSpanProcessor` exports the resulting OpenTelemetry spans to Langfuse.

Install the AI SDK and Langfuse integration packages:

```bash
npm install ai @ai-sdk/openai @langfuse/client @langfuse/vercel-ai-sdk @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

The `@langfuse/vercel-ai-sdk` package targets AI SDK v7 and requires Node.js 22 or later.

You can set the Langfuse credentials via environment variables or directly to the `LangfuseSpanProcessor` constructor.

To get your Langfuse API keys, you can [self-host Langfuse](https://langfuse.com/docs/deployment/self-host) or sign up for Langfuse Cloud [here](https://cloud.langfuse.com). Create a project in the Langfuse dashboard to get your `secretKey` and `publicKey`.

<Tabs items={["Environment Variables", "Constructor"]}>

<Tab>

```bash filename=".env"
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_BASE_URL="https://cloud.langfuse.com" # EU region, use "https://us.cloud.langfuse.com" for US region
```

</Tab>

<Tab>

```ts
import { LangfuseSpanProcessor } from '@langfuse/otel';

new LangfuseSpanProcessor({
  secretKey: 'sk-lf-...',
  publicKey: 'pk-lf-...',
  baseUrl: 'https://cloud.langfuse.com', // EU region
  // baseUrl: 'https://us.cloud.langfuse.com', // US region
});
```

</Tab>
</Tabs>

Now register the Langfuse span processor with OpenTelemetry and register the Langfuse AI SDK telemetry integration once at application startup.

<Tabs items={["Next.js","Node.js"]}>
<Tab>

Next.js has support for OpenTelemetry instrumentation on the framework level. Learn more about it in the [Next.js OpenTelemetry guide](https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry).

Create or update your `instrumentation.ts` file:

```ts filename="instrumentation.ts"
import { registerTelemetry } from 'ai';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import { NodeSDK } from '@opentelemetry/sdk-node';

export const langfuseSpanProcessor = new LangfuseSpanProcessor();

const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});

sdk.start();

registerTelemetry(new LangfuseVercelAiSdkIntegration());
```

If you stream responses from a serverless route, flush the span processor after the response is scheduled so traces are exported before the function exits.

</Tab>
<Tab>

Add `LangfuseSpanProcessor` to your OpenTelemetry setup and register `LangfuseVercelAiSdkIntegration` with the AI SDK:

```ts
import { openai } from '@ai-sdk/openai';
import { registerTelemetry, generateText } from 'ai';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();
registerTelemetry(new LangfuseVercelAiSdkIntegration());

async function main() {
  const result = await generateText({
    model: openai('gpt-5.5'),
    maxOutputTokens: 50,
    prompt: 'Invent a new holiday and describe its traditions.',
    telemetry: {
      functionId: 'my-awesome-function',
    },
  });

  console.log(result.text);

  await sdk.shutdown(); // Flushes the trace to Langfuse
}

main().catch(console.error);
```

</Tab>
</Tabs>

Done! Once the integration is registered, AI SDK v7 calls emit telemetry by default and Langfuse maps the spans into traces, generations, tool calls, embeddings, and reranks.

## Example Application

For the current setup, see Langfuse's [Vercel AI SDK integration guide](https://langfuse.com/integrations/frameworks/vercel-ai-sdk). Langfuse also maintains a sample repository at [langfuse/langfuse-vercel-ai-nextjs-example](https://github.com/langfuse/langfuse-vercel-ai-nextjs-example).

## Configuration

### Pass Custom Attributes

Use `propagateAttributes` from `@langfuse/tracing` to attach Langfuse trace attributes such as users, sessions, tags, and trace metadata to all observations created inside the callback.

```ts
import { propagateAttributes } from '@langfuse/tracing';

const result = await propagateAttributes(
  {
    traceName: 'story-generation',
    userId: 'user-123',
    sessionId: 'session-456',
    tags: ['story', 'cat'],
    metadata: {
      route: 'api/story',
      experiment: 'variant-a',
    },
  },
  () =>
    generateText({
      model: openai('gpt-5.5'),
      prompt: 'Write a short story about a cat.',
      telemetry: {
        functionId: 'story-generation',
      },
    }),
);
```

### Include Runtime Context in Langfuse Metadata

AI SDK v7 excludes `runtimeContext` from telemetry events unless each top-level key is explicitly included. Langfuse maps included runtime context keys to observation metadata.

```ts
const result = await generateText({
  model: openai('gpt-5.5'),
  prompt: 'Write a short story about a cat.',
  runtimeContext: {
    route: 'api/story',
    feature: 'cat-story',
  },
  telemetry: {
    functionId: 'story-generation',
    includeRuntimeContext: {
      route: true,
      feature: true,
    },
  },
});
```

### Link Langfuse Prompts to Generations

You can link Langfuse Prompt Management versions to AI SDK model-call observations by passing the fetched prompt through `runtimeContext.langfusePrompt` and including that key in telemetry.

```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { LangfuseClient } from '@langfuse/client';

const langfuseClient = new LangfuseClient();
const langfusePrompt = await langfuseClient.getPrompt('support-chat/default');

const result = await generateText({
  model: openai('gpt-5.5'),
  prompt: langfusePrompt.compile({ topic: 'RAG' }),
  runtimeContext: {
    route: 'support-chat',
    langfusePrompt,
  },
  telemetry: {
    functionId: 'support-chat',
    includeRuntimeContext: {
      route: true,
      langfusePrompt: true,
    },
  },
});
```

Langfuse maps included runtime context keys to observation metadata, except `langfusePrompt`, which is used for prompt linking. Learn more about prompts in Langfuse [here](https://langfuse.com/docs/prompts/get-started).

### Group Multiple Executions in One Trace

Create an active Langfuse observation and run multiple AI SDK calls inside it. The AI SDK observations become children of the active observation.

```ts
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing';

await startActiveObservation('holiday-traditions', async () => {
  await propagateAttributes(
    {
      traceName: 'holiday-traditions',
      userId: 'user-123',
      sessionId: 'session-456',
      tags: ['holiday-generator'],
    },
    async () => {
      for (let i = 0; i < 3; i++) {
        const result = await generateText({
          model: openai('gpt-5.5'),
          maxOutputTokens: 50,
          prompt: 'Invent a new holiday and describe its traditions.',
          telemetry: {
            functionId: `holiday-tradition-${i}`,
          },
        });

        console.log(result.text);
      }
    },
  );
});

await sdk.shutdown();
```

The resulting trace hierarchy will be:

![Vercel nested trace in Langfuse UI](https://langfuse.com/images/docs/vercel-nested-trace.png)

### Disable Tracking of Input/Output

By default, the exporter captures the input and output of each request. You can disable this behavior by setting the `recordInputs` and `recordOutputs` options to `false`.

```ts
const result = await generateText({
  model: openai('gpt-5.5'),
  prompt: 'Write a short story about a cat.',
  telemetry: {
    recordInputs: false,
    recordOutputs: false,
  },
});
```

### Disable Telemetry for One Call

Telemetry is enabled by default when a telemetry integration is registered. You can opt out for a single AI SDK call:

```ts
const result = await generateText({
  model: openai('gpt-5.5'),
  prompt: 'Write a short story about a cat.',
  telemetry: {
    isEnabled: false,
  },
});
```

## Troubleshooting

- Make sure your application is on Node.js 22 or later.
- Use the latest AI SDK package and install `@langfuse/vercel-ai-sdk`;
- If `runtimeContext` values are missing in Langfuse, add each top-level key to `telemetry.includeRuntimeContext`.
- On Next.js, make sure that you only have a single instrumentation file.
- If you use Sentry, make sure to either:
  - set `skipOpenTelemetrySetup: true` in Sentry.init
  - follow Sentry's docs on how to manually set up Sentry with OTEL

## Learn more

- After setting up Langfuse Tracing for the AI SDK, you can utilize any of the other Langfuse [platform features](https://langfuse.com/docs):
  - [Prompt Management](https://langfuse.com/docs/prompts): Collaboratively manage and iterate on prompts, use them with low-latency in production.
  - [Evaluations](https://langfuse.com/docs/scores): Test the application holistically in development and production using user feedback, LLM-as-a-judge evaluators, manual reviews, or custom evaluation pipelines.
  - [Experiments](https://langfuse.com/docs/datasets): Iterate on prompts, models, and application design in a structured manner with datasets and evaluations.
- For more information about Langfuse's AI SDK v7 integration, see the [Langfuse Vercel AI SDK integration guide](https://langfuse.com/integrations/frameworks/vercel-ai-sdk).
- For more information, see the [telemetry documentation](/docs/ai-sdk-core/telemetry) of the AI SDK.
