---
title: Respan
description: Trace and monitor your AI SDK application with Respan
---

# Respan Observability

[Respan](https://www.respan.ai/) (formerly Keywords AI) is an LLM engineering platform for observability, evaluation, and gateway routing. Respan integrates with the AI SDK to provide:

- Tracing for each AI SDK call (input, output, token usage, cost, latency)
- Tool call and structured output capture
- Optional gateway routing across 250+ models behind a single endpoint

## Setup

The AI SDK supports tracing via OpenTelemetry. With the `VercelAIInstrumentor` from `@respan/instrumentation-vercel`, traces are exported to Respan automatically.

### Install

```bash
npm install ai @ai-sdk/openai @respan/respan @respan/instrumentation-vercel
```

### Configure environment variables

```bash filename=".env"
RESPAN_API_KEY="your-respan-api-key"
```

Get your API key from [platform.respan.ai](https://platform.respan.ai/platform/api/api-keys).

### Initialize Respan

<Tabs items={["Next.js", "Serverless / Node"]}>

<Tab>

Create `instrumentation.ts` at the root of your Next.js project:

```ts filename="instrumentation.ts"
import { Respan } from '@respan/respan';
import { VercelAIInstrumentor } from '@respan/instrumentation-vercel';

export async function register() {
  const respan = new Respan({
    apiKey: process.env.RESPAN_API_KEY,
    instrumentations: [new VercelAIInstrumentor()],
  });
  await respan.initialize();
}
```

Then mark the SDK packages as server-external in `next.config.ts`:

```ts filename="next.config.ts"
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@respan/respan', '@respan/instrumentation-vercel'],
};

export default nextConfig;
```

</Tab>

<Tab>

Initialize Respan at the top of your handler or entry point:

```ts
import { Respan } from '@respan/respan';
import { VercelAIInstrumentor } from '@respan/instrumentation-vercel';

const respan = new Respan({
  apiKey: process.env.RESPAN_API_KEY,
  instrumentations: [new VercelAIInstrumentor()],
});
await respan.initialize();
```

</Tab>

</Tabs>

### Generate text with telemetry enabled

```ts
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const result = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: 'Tell me a joke about AI',
  experimental_telemetry: { isEnabled: true },
});
```

Spans appear in the [Respan traces page](https://platform.respan.ai/platform/traces) with input, output, token usage, and cost.

## Gateway routing (optional)

To use Respan as a unified gateway across providers, point any AI SDK provider at `https://api.respan.ai/api` with your `RESPAN_API_KEY`. Provider keys are managed in Respan; only the Respan key is needed at runtime.

```ts
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const provider = createOpenAI({
  apiKey: process.env.RESPAN_API_KEY!,
  baseURL: 'https://api.respan.ai/api',
});

const result = await generateText({
  model: provider('gpt-4.1-nano'),
  prompt: 'Tell me a joke about AI',
  experimental_telemetry: { isEnabled: true },
});
```

The same gateway endpoint accepts Anthropic and Google models when used with their respective AI SDK providers (`createAnthropic`, `createGoogleGenerativeAI`) and the matching base path (`/api/anthropic`, `/api/google/gemini`).

## Resources

- [Respan + Vercel AI SDK documentation](https://www.respan.ai/docs/integrations/vercel-ai-sdk)
- [TypeScript example projects](https://github.com/respanai/respan-example-projects/tree/main/typescript/tracing/vercel-ai-sdk)
