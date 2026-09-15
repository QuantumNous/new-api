---
title: Patronus
description: Monitor, evaluate and debug your AI SDK application with Patronus
---

# Patronus Observability

[Patronus AI](https://patronus.ai) provides an end-to-end system to evaluate, monitor and improve performance of an LLM system, enabling developers to ship AI products safely and confidently. Learn more [here](https://docs.patronus.ai/docs).

When you build with the AI SDK, you can stream OpenTelemetry (OTEL) traces straight into Patronus and pair every generation with rich automatic evaluations.

## Setup

### 1. OpenTelemetry

Patronus exposes a fully‑managed OTEL endpoint. Configure an **OTLP exporter** to point at it, pass your API key, and you’re done—Patronus will automatically convert LLM spans into prompt/response records you can explore and evaluate.

#### Environment variables (recommended)

```bash filename=".env.local"
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.patronus.ai/v1/traces
OTEL_EXPORTER_OTLP_HEADERS="x-api-key:<PATRONUS_API_KEY>"
```

#### With `@vercel/otel`

```ts filename="instrumentation.ts"
import { registerOTel } from '@vercel/otel';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';

export function register() {
  registerOTel({
    serviceName: 'next-app',
    additionalSpanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
          headers: {
            'x-api-key': process.env.PATRONUS_API_KEY!,
          },
        }),
      ),
    ],
  });
}

registerTelemetry(new LegacyOpenTelemetry());
```

<Note>
  If you need gRPC instead of HTTP, swap the exporter for
  `@opentelemetry/exporter-trace-otlp-grpc` and use
  `https://otel.patronus.ai:4317`.
</Note>

### 2. Register the integration and enable telemetry

Once you've installed `@ai-sdk/otel` and added `registerTelemetry` to your `instrumentation.ts`, telemetry is captured automatically. Pass `telemetry` to attach metadata:

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Write a haiku about spring.',
  telemetry: {
    functionId: 'spring-haiku', // span name
    metadata: {
      userId: 'user-123', // custom attrs surface in Patronus UI
    },
  },
});
```

Every attribute inside `metadata` becomes an OTEL attribute and is indexed by Patronus for filtering.

## Example — tracing and automated evaluation

```ts filename="app/api/chat/route.ts"
import { trace } from '@opentelemetry/api';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const body = await req.json();
  const tracer = trace.getTracer('next-app');

  return await tracer.startActiveSpan('chat-evaluate', async span => {
    try {
      /* 1️⃣ generate answer */
      const answer = await generateText({
        model: openai('gpt-4o'),
        prompt: body.prompt,
        telemetry: { functionId: 'chat' },
      });

      /* 2️⃣ run Patronus evaluation inside the same trace */
      await fetch('https://api.patronus.ai/v1/evaluate', {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.PATRONUS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evaluators: [
            { evaluator: 'lynx', criteria: 'patronus:hallucination' },
          ],
          evaluated_model_input: body.prompt,
          evaluated_model_output: answer.text,
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
        }),
      });

      return new Response(answer.text);
    } finally {
      span.end();
    }
  });
}
```

Result: a single trace containing the root HTTP request, the LLM generation span, and your evaluation span—**all visible in Patronus** with the hallucination score attached.

## Once you've traced

- If you're tracing an agent, Patronus's AI assistant Percival will assist with error analysis and prompt optimization. Learn more [here](https://docs.patronus.ai/docs/percival/percival)
- Get set up on production monitoring and alerting by viewing logs and traces on Patronus and configuring webhooks for alerting. Learn more [here](https://docs.patronus.ai/docs/real_time_monitoring/webhooks)

## Resources

- [Patronus docs](https://docs.patronus.ai)
- [OpenTelemetry SDK (JS)](https://opentelemetry.io/docs/instrumentation/js/)
