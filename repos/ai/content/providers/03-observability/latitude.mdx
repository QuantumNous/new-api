---
title: Latitude
description: Monitor and debug your AI SDK application with Latitude
---

# Latitude Observability

[Latitude](https://latitude.so) ([GitHub](https://github.com/latitude-dev/latitude-llm)) is an open-source MIT-licensed platform for AI agent observability with semantic trace search and issue tracking. It integrates with the AI SDK to capture:

- Traces of every `generateText`, `streamText`, and tool call
- Token usage and latency per call
- Errors and failure patterns grouped as recurring issues

## Setup

Latitude's SDK registers a global OpenTelemetry tracer. Once you register the AI SDK's telemetry integration, every AI SDK call emits spans automatically.

Install both packages:

<InstallPackages packages="@latitude-data/telemetry @ai-sdk/otel" />

Sign in at [app.latitude.so](https://app.latitude.so) and grab your API key and project slug from the dashboard. Set them in your environment:

```bash filename=".env"
LATITUDE_API_KEY="..."
LATITUDE_PROJECT_SLUG="..."
```

Initialize Latitude and register telemetry once at startup. After that, every AI SDK call emits traces automatically:

```ts
import { Latitude } from '@latitude-data/telemetry';
import { registerTelemetry, generateText } from 'ai';
import { OpenTelemetry } from '@ai-sdk/otel';
import { openai } from '@ai-sdk/openai';

const latitude = new Latitude({
  apiKey: process.env.LATITUDE_API_KEY!,
  project: process.env.LATITUDE_PROJECT_SLUG!,
});

registerTelemetry(new OpenTelemetry());

const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello',
});

await latitude.shutdown();
```

For named traces and per-call metadata (tags, user IDs, session IDs), wrap calls in Latitude's `capture()` helper:

```ts
import { capture } from '@latitude-data/telemetry';

await capture('generate-support-reply', async () => {
  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: 'Hello',
  });
  return text;
});
```

## Resources

- [Latitude Vercel AI SDK guide](https://docs.latitude.so/telemetry/frameworks/vercel-ai-sdk)
- [Latitude documentation](https://docs.latitude.so)
- [GitHub repository](https://github.com/latitude-dev/latitude-llm)
