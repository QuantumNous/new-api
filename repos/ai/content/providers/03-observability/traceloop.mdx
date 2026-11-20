---
title: Traceloop
description: Monitoring and evaluating LLM applications with Traceloop
---

# Traceloop

[Traceloop](https://www.traceloop.com/) is a development platform for building reliable AI applications.
After integrating with the AI SDK, you can use Traceloop to trace, monitor, and experiment with LLM providers, prompts and flows.

## Setup

Traceloop supports [AI SDK telemetry data](/docs/ai-sdk-core/telemetry) through [OpenTelemetry](https://opentelemetry.io/docs/).
You'll need to sign up at https://app.traceloop.com and get an API Key.

### Next.js

To use the AI SDK to send telemetry data to Traceloop, set these environment variables in your Next.js app's `.env` file:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.traceloop.com
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <Your API Key>"
```

Install `@ai-sdk/otel` and register the `LegacyOpenTelemetry` in your `instrumentation.ts` file:

```typescript filename="instrumentation.ts"
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';

registerTelemetry(new LegacyOpenTelemetry());
```

You can then use the `telemetry` option to enable telemetry on supported AI SDK function calls:

```typescript highlight="7-12"
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: 'What is 2 + 2?',
  telemetry: {
    metadata: {
      query: 'weather',
      location: 'San Francisco',
    },
  },
});
```

## Resources

- [Traceloop demo chatbot](https://www.traceloop.com/docs/demo)
- [Traceloop docs](https://www.traceloop.com/docs)
