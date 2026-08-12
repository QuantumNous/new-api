---
title: Scorecard
description: Monitoring and evaluating LLM applications with Scorecard
---

# Scorecard

[Scorecard](https://www.scorecard.io/) is an observability platform for monitoring and evaluating LLM applications.
After integrating with the AI SDK, you can use Scorecard to trace, monitor, and analyze your LLM providers, prompts, and application flows.

## Setup

Scorecard supports [AI SDK telemetry data](/docs/ai-sdk-core/telemetry).
You'll need to sign up at https://app.scorecard.io and get your API Key from your [settings page](https://app.scorecard.io/settings).

### Next.js

To use the AI SDK to send telemetry data to Scorecard, first set these environment variables in your project:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://tracing.scorecard.io/otel/v1/traces
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <Your Scorecard API Key>"
```

Next, install `@ai-sdk/otel` and create an `instrumentation.ts` file in your project root to initialize OpenTelemetry and register the AI SDK telemetry integration:

```typescript filename="instrumentation.ts"
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { registerOTel } from '@vercel/otel';

registerTelemetry(new LegacyOpenTelemetry());

export function register() {
  registerOTel({
    serviceName: 'my-service-name',
  });
}
```

Once the integration is registered, telemetry is captured automatically for all AI SDK calls:

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: 'Tell me a joke',
});
```

## What You'll See in Scorecard

After integrating, you'll be able to view in your Scorecard dashboard:

- **LLM call traces**: Detailed information about each AI SDK call
- **Performance metrics**: Latency, token usage, and cost tracking
- **Model information**: Which models and providers were used
- **Custom context**: Any additional context you provide via the `context` option
- **Error tracking**: Failed requests and debugging information
- **Usage analytics**: Patterns and trends in your LLM usage

## Resources

- [Scorecard Tracing Quickstart](https://docs.scorecard.io/intro/tracing-quickstart)
- [Scorecard Documentation](https://docs.scorecard.io/)
