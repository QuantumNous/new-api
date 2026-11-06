# AI SDK - OpenTelemetry

The **OpenTelemetry integration** for the [AI SDK](https://ai-sdk.dev/docs)
collects tracing spans for AI SDK calls and sends them through your configured
OpenTelemetry setup.

## Setup

The OpenTelemetry integration is available in the `@ai-sdk/otel` module. You can
install it with

```bash
npm i @ai-sdk/otel
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend
adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Usage

Register the telemetry integration once at application startup with
`registerTelemetry()`:

```ts
import { OpenTelemetry } from '@ai-sdk/otel';
import { registerTelemetry } from 'ai';

registerTelemetry(new OpenTelemetry());
```

For Next.js applications, place this in `instrumentation.ts` alongside your
OpenTelemetry provider setup. For Node.js applications, register it at the top
level of your entry file.

Once registered, AI SDK calls emit telemetry events by default:

```ts
import { generateText } from 'ai';

const result = await generateText({
  model: 'openai/gpt-5.4',
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
  telemetry: {
    functionId: 'recipe-generator',
  },
});
```

You can opt out for an individual call with `telemetry.isEnabled`:

```ts
const result = await generateText({
  model: 'openai/gpt-5.4',
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
  telemetry: {
    isEnabled: false,
  },
});
```

## OpenTelemetry

`OpenTelemetry` is the recommended integration. It emits spans that follow the
[OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/).

You can pass a custom tracer when you want to use a specific `TracerProvider`:

```ts
import { OpenTelemetry } from '@ai-sdk/otel';
import { registerTelemetry } from 'ai';

registerTelemetry(
  new OpenTelemetry({
    tracer: tracerProvider.getTracer('gen_ai'),
  }),
);
```

You can also add custom attributes to spans with `enrichSpan`:

```ts
import { OpenTelemetry } from '@ai-sdk/otel';
import { registerTelemetry } from 'ai';

registerTelemetry(
  new OpenTelemetry({
    enrichSpan: ({ spanType, operationId, callId }) => ({
      'my_app.span_type': spanType,
      'my_app.operation_id': operationId,
      'my_app.call_id': callId,
    }),
  }),
);
```

## Legacy Telemetry

`LegacyOpenTelemetry` emits the older AI SDK-specific span format with `ai.*`
attributes. Use it when an existing observability integration depends on the
legacy span shape:

```ts
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { registerTelemetry } from 'ai';

registerTelemetry(new LegacyOpenTelemetry());
```

## Documentation

Please check out the
[AI SDK telemetry documentation](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)
for more information.
