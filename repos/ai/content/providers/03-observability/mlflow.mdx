---
title: MLflow
description: Track, visualize, and debug Vercel AI SDK traces with MLflow Tracing
---

# MLflow Observability

<video
  src="https://mlflow.org/docs/latest/images/llms/tracing/vercel-ai-tracing.mp4"
  autoplay
  muted
  loop
  controls
  playsinline
  aria-label="MLflow Tracing Vercel AI SDK"
>
  <a href="https://mlflow.org/docs/latest/images/llms/tracing/vercel-ai-tracing.mp4">
    MLflow Tracing Vercel AI SDK demo video
  </a>
</video>

[MLflow Tracing](https://mlflow.org/docs/latest/genai/tracing) provides automatic tracing for applications built with the [Vercel AI SDK](https://ai-sdk.dev/) (the `ai` package) via OpenTelemetry, unlocking observability for TypeScript and JavaScript apps.

When enabled, MLflow records:

- Prompts/messages and generated responses
- Latencies and call hierarchy
- Token usage (when the provider returns it)
- Exceptions

## Quickstart (NextJS)

It is fairly straightforward to enable MLflow tracing for Vercel AI SDK if you are using NextJS.

<Note>
  No app handy? Try Vercel’s demo chatbot:
  https://vercel.com/templates/next.js/ai-chatbot-telemetry
</Note>

### 1. Start MLflow Tracking Server

```bash
mlflow server --backend-store-uri sqlite:///mlruns.db --port 5000
```

You can also start the server with Docker Compose; see the [MLflow Setup Guide](https://mlflow.org/docs/latest/genai/getting-started/connect-environment/).

### 2. Configure Environment Variables

Add these to `.env.local`:

```bash filename=".env.local"
OTEL_EXPORTER_OTLP_ENDPOINT=<your-mlflow-tracking-server-endpoint>
OTEL_EXPORTER_OTLP_TRACES_HEADERS=x-mlflow-experiment-id=<your-experiment-id>
OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/protobuf
```

For local testing: `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:5000`.

### 3. Enable OpenTelemetry

Install the Vercel OpenTelemetry integration:

```bash
pnpm i @opentelemetry/api @vercel/otel @ai-sdk/otel
```

Create `instrumentation.ts` in your project root and register the `LegacyOpenTelemetry` alongside your OTel provider setup:

```ts filename="instrumentation.ts"
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { registerOTel } from '@vercel/otel';

registerTelemetry(new LegacyOpenTelemetry());

export async function register() {
  registerOTel({ serviceName: 'next-app' });
}
```

Once the integration is registered, telemetry is emitted automatically for your AI SDK calls:

```ts filename="route.ts"
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const { text } = await generateText({
    model: openai('gpt-5'),
    prompt,
  });

  return new Response(JSON.stringify({ text }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

See the [Vercel OpenTelemetry docs](https://vercel.com/docs/tracing/instrumentation) for advanced options like context propagation.

### 4. Run the App and View Traces

Start your NextJS app and open MLflow UI at the tracking server endpoint (e.g., `http://localhost:5000`). Traces for AI SDK calls appear in the configured experiment.

## Other Node.js Applications

For other Node.js frameworks, wire up the OpenTelemetry Node SDK and OTLP exporter manually.

```ts filename="main.ts"
import { init } from 'mlflow-tracing';
import { registerTelemetry, generateText } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { openai } from '@ai-sdk/openai';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

const sdk = new NodeSDK({
  spanProcessors: [
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: '<your-mlflow-tracking-server-endpoint>/v1/traces',
        headers: { 'x-mlflow-experiment-id': '<your-experiment-id>' },
      }),
    ),
  ],
});

sdk.start();
init();
registerTelemetry(new LegacyOpenTelemetry());

const result = await generateText({
  model: openai('gpt-5'),
  prompt: 'What is MLflow?',
});

console.log(result.text);
sdk.shutdown();
```

```bash
npx tsx main.ts
```

## Streaming

Streaming is supported. Like `generateText`, traces are captured automatically once the integration is registered.

```ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const stream = await streamText({
  model: openai('gpt-5'),
  prompt: 'Explain vector databases in one paragraph.',
});

for await (const part of stream.textStream) {
  process.stdout.write(part);
}
```

## Disable auto-tracing

To disable tracing for Vercel AI SDK, set `telemetry: { isEnabled: false }` on the AI SDK call.

## Learn more

- After setting up MLflow Tracing for the AI SDK, you can tap into broader MLflow GenAI capabilities:
  - [Evaluation](https://mlflow.org/docs/latest/genai/eval-monitor/): Use built-in LLM judges and dataset management to systematically measure quality and monitor GenAI apps from development through production.
  - [Prompt Management](https://mlflow.org/docs/latest/genai/prompt-registry/): Centralize prompt templates with versioning, aliases, lineage, and collaboration so teams can reuse and compare prompts safely.
  - [MCP Server](https://mlflow.org/docs/latest/genai/mcp/): Connect your coding agent with MLflow MCP Server to interact with MLflow traces programmatically and improve your LLM applications.
- For more information about tracing in AI SDK, see the [telemetry documentation](/docs/ai-sdk-core/telemetry).
