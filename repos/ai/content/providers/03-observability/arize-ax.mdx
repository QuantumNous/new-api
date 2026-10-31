---
title: Arize AX
description: Trace, monitor, and evaluate LLM applications with Arize AX
---

# Arize AX Observability

[Arize AX](https://arize.com/docs/ax) is an enterprise-grade observability, evaluation, and experimentation platform purpose-built for agents and complex AI systems. It empowers teams to rigorously develop and improve real-world AI applications.

<Note>
  You can also find this guide in the [Arize AX
  docs](https://arize.com/docs/ax/integrations/ts-js-agent-frameworks/vercel).
</Note>

## Setup

Arize AX offers first-class OpenTelemetry integration and works directly with the AI SDK in both Next.js and Node.js environments.

<Note>
  Arize AX has an
  [OpenInferenceSimpleSpanProcessor](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-vercel/src/OpenInferenceSpanProcessor.ts#L32)
  and an
  [OpenInferenceBatchSpanProcessor](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-vercel/src/OpenInferenceSpanProcessor.ts#L86).
  All of the examples below can be used with either the simple or the batch
  processor. For more information on simple / batch span processors see our
  [documentation](https://arize.com/docs/ax/observe/tracing/configure/batch-vs-simple-span-processor#batch-vs-simple-span-processor).
</Note>

### Next.js

In Next.js applications, use one of the OpenInference span processors with `registerOtel` from `@vercel/otel`.

First, install the required dependencies for the AI SDK, OpenTelemetry and OpenInference.

```bash
npm install ai @ai-sdk/openai @ai-sdk/otel @vercel/otel @arizeai/openinference-vercel @opentelemetry/exporter-trace-otlp-proto
```

Then, in your `instrumentation.ts` file add the following, including the AI SDK telemetry integration registration:

```typescript filename="instrumentation"
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { registerOTel } from '@vercel/otel';
import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from '@arizeai/openinference-vercel';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

registerTelemetry(new LegacyOpenTelemetry());

export function register() {
  registerOTel({
    attributes: {
      model_id: 'my-ai-app',
      model_version: '1.0.0',
    },
    spanProcessors: [
      new OpenInferenceSimpleSpanProcessor({
        exporter: new OTLPTraceExporter({
          url: 'https://otlp.arize.com/v1/traces',
          headers: {
            space_id: process.env.ARIZE_SPACE_ID,
            api_key: process.env.ARIZE_API_KEY,
          },
        }),
        // Optionally add a span filter to only include AI related spans
        spanFilter: isOpenInferenceSpan,
      }),
    ],
  });
}
```

Spans will show up in Arize AX under the project specified in the `model_id` field above.

Once the integration is registered, telemetry is emitted automatically for all AI SDK calls:

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Please write a haiku.',
});
```

### Node.js

In Node.js you can use the `NodeSDK` or the `NodeTraceProvider`.

#### NodeSDK

First, install the required dependencies for the AI SDK, OpenTelemetry and OpenInference.

```bash
npm install ai @ai-sdk/openai @ai-sdk/otel @opentelemetry/sdk-node @arizeai/openinference-vercel @opentelemetry/exporter-trace-otlp-proto @opentelemetry/resources
```

Then, in your instrumentation.ts file add the following:

```typescript
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from '@arizeai/openinference-vercel';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    model_id: 'my-ai-app',
    model_version: '1.0.0',
  }),
  spanProcessors: [
    new OpenInferenceSimpleSpanProcessor({
      exporter: new OTLPTraceExporter({
        url: 'https://otlp.arize.com/v1/traces',
        headers: {
          space_id: process.env.ARIZE_SPACE_ID,
          api_key: process.env.ARIZE_API_KEY,
        },
      }),
      spanFilter: isOpenInferenceSpan,
    }),
  ],
});

sdk.start();
registerTelemetry(new LegacyOpenTelemetry());
```

Spans will show up in Arize AX under the project specified in the `model_id` field above.

Once the integration is registered, telemetry is emitted automatically for all AI SDK calls:

```typescript
const result = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Please write a haiku.',
});
```

#### NodeTraceProvider

First, install the required dependencies for the AI SDK, OpenTelemetry and OpenInference.

```bash
npm install ai @ai-sdk/openai @ai-sdk/otel @opentelemetry/sdk-trace-node @arizeai/openinference-vercel @opentelemetry/exporter-trace-otlp-proto @opentelemetry/resources
```

Then, in your instrumentation.ts file add the following:

```typescript
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from '@arizeai/openinference-vercel';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    model_id: 'my-ai-app',
    model_version: '1.0.0',
  }),
  spanProcessors: [
    new OpenInferenceSimpleSpanProcessor({
      exporter: new OTLPTraceExporter({
        url: 'https://otlp.arize.com/v1/traces',
        headers: {
          space_id: process.env.ARIZE_SPACE_ID,
          api_key: process.env.ARIZE_API_KEY,
        },
      }),
      spanFilter: isOpenInferenceSpan,
    }),
  ],
});
provider.register();
registerTelemetry(new LegacyOpenTelemetry());
```

Spans will show up in Arize AX under the project specified in the `model_id` field above.

Once the integration is registered, telemetry is emitted automatically for all AI SDK calls:

```typescript
const result = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Please write a haiku.',
});
```

## Resources

After sending spans to your Arize AX project check out other features:

- Rerunning spans in the [prompt playground](https://arize.com/docs/ax/prompts/prompt-playground) to iterate and compare prompts and parameters
- Add spans to [datasets](https://arize.com/docs/ax/develop/datasets) for evaluation and development workflows
- Continuously run [online evaluations](https://arize.com/docs/ax/evaluate/online-evals) on your incoming spans to understand application performance

AX has a [TypeScript client](https://www.npmjs.com/package/@arizeai/ax-client) for managing your datasets and evaluations.
