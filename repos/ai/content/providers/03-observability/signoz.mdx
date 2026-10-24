---
title: SigNoz
description: Monitor, observe and debug your AI SDK application with SigNoz
---

# SigNoz Observability

[SigNoz](https://signoz.io/) is a single tool for all your monitoring and observability needs. Here are a few reasons why you should choose SigNoz:

- Single tool for observability(logs, metrics, and traces)
- Built on top of [OpenTelemetry](https://opentelemetry.io/), the open-source standard which frees you from any type of vendor lock-in
- Correlated logs, metrics and traces for much richer context while debugging
- Uses ClickHouse (used by likes of Uber & Cloudflare) as datastore - an extremely fast and highly optimized storage for observability data
- DIY Query builder, PromQL, and ClickHouse queries to fulfill all your use-cases around querying observability data

# Setup

- Create a [SigNoz Cloud Account](https://signoz.io/teams/)
- Generate a SigNoz Ingestion Key

## Instrument your Next.js application

Check out detailed instructions on how to set up OpenTelemetry instrumentation in your Next.js applications and view your application traces in SigNoz over [here](https://signoz.io/docs/instrumentation/opentelemetry-nextjs/).

## Send traces directly to SigNoz Cloud

**Step 1.** Install OpenTelemetry packages

```bash
npm install @vercel/otel @opentelemetry/api @ai-sdk/otel
```

**Step 2.** Update **`next.config.mjs`** to include instrumentationHook

> This step is only needed when using NextJs 14 and below

```jsx
/** @type {import('next').NextConfig} */
const nextConfig = {
  // include instrumentationHook experimental feature
  experimental: {
    instrumentationHook: true,
  },
};
export default nextConfig;
```

**Step 3.** Create **`instrumentation.ts`** file(in root project directory)

```jsx
import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { registerOTel, OTLPHttpJsonTraceExporter } from '@vercel/otel';
// Add otel logging
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR); // set diag log level to DEBUG when debugging

registerTelemetry(new LegacyOpenTelemetry());

export function register() {
  registerOTel({
    serviceName: '<service_name>',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: 'https://ingest.<region>.signoz.cloud:443/v1/traces',
      headers: { 'signoz-ingestion-key': '<your-ingestion-key>' },
    }),
  });
}
```

- **`<service_name>`** is the name of your service
- Set the **`<region>`** to match your SigNoz Cloud [**region**](https://signoz.io/docs/ingestion/signoz-cloud/overview/#endpoint)
- Replace **`<your-ingestion-key>`** with your SigNoz [**ingestion key**](https://signoz.io/docs/ingestion/signoz-cloud/keys/)

> The instrumentation file should be in the root of your project and not inside the app or pages directory. If you're using the src folder, then place the file inside src alongside pages and app.

Your Next.js app should be properly instrumented now.

## Enable Telemetry for Vercel AI SDK

The Vercel AI SDK uses [OpenTelemetry](https://signoz.io/blog/what-is-opentelemetry/) to collect telemetry data. OpenTelemetry is an open-source observability framework designed to provide standardized instrumentation for collecting telemetry data.

## Enabling Telemetry

Check out more detailed information about Vercel AI SDK's telemetry options visit [here](https://ai-sdk.dev/docs/ai-sdk-core/telemetry#telemetry).

With `@ai-sdk/otel` installed and `registerTelemetry` added to your `instrumentation.ts` (see Step 3 above), telemetry is captured automatically on every AI SDK call:

```jsx
const result = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Write a short story about a cat.',
});
```

You can also control whether you want to record the input values and the output values for the function. By default, both are enabled. You can disable them by setting the `recordInputs` and `recordOutputs` options to `false`.

```jsx
telemetry: { recordInputs: false, recordOutputs: false }
```

Disabling the recording of inputs and outputs can be useful for privacy, data transfer, and performance reasons. You might, for example, want to disable recording inputs if they contain sensitive information.

## Telemetry Metadata

You can provide a `functionId` to identify the function that the telemetry data is for, and `context` to include additional information in the telemetry data.

```jsx
const result = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Write a short story about a cat.',
  context: {
    something: 'custom',
    someOtherThing: 'other-value',
  },
  telemetry: {
    functionId: 'my-awesome-function',
  },
});
```

## Custom Tracer

If you want your traces to use a `TracerProvider` other than the one provided by the `@opentelemetry/api` singleton, pass a custom `Tracer` to the `LegacyOpenTelemetry` constructor:

```jsx
import { registerTelemetry, generateText } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';

const tracerProvider = new NodeTracerProvider();
registerTelemetry(
  new LegacyOpenTelemetry({
    tracer: tracerProvider.getTracer('ai'),
  }),
);

const result = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Write a short story about a cat.',
});
```

Your Vercel AI SDK commands should now automatically emit traces, spans, and events. You can find more details on the types of spans and events generated [here](https://ai-sdk.dev/docs/ai-sdk-core/telemetry#collected-data).

Finally, you should be able to view this data in Signoz Cloud under the traces tab.
