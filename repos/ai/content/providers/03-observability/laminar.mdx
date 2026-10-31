---
title: Laminar
description: Monitor your AI SDK applications with Laminar
---

# Laminar observability

[Laminar](https://laminar.sh) is an [open-source](https://github.com/lmnr-ai/lmnr), Otel-native observability platform purpose-built for AI agents.

Laminar features:

- [Tracing compatible with AI SDK and more](https://laminar.sh/docs/tracing/introduction),
- [Signals and alerts about your agent behavior](https://laminar.sh/docs/signals/introduction),
- [Evaluations](https://laminar.sh/docs/evaluations/introduction),
- [Agent Debugger](https://laminar.sh/docs/debugger/introduction)

<Note>
  A version of this guide is available in [Laminar's
  docs](https://laminar.sh/docs/tracing/integrations/vercel-ai-sdk).
</Note>

## Setup

You can use your coding agent to install Laminar or install it manually.

### Setup with your coding agent

Copy the prompt below and paste it to your coding agent, for it to integrate fully automatically.

```markdown
1. Run `npx lmnr-cli setup` at the project root to get started with Laminar. This command will authenticate the user, save a new project API key to .env, and install the Laminar skill.
2. Instrument this project with Laminar using the installed skill or the docs:
   https://laminar.sh/docs/tracing/integrations/vercel-ai-sdk
3. Run a traced path inside your application.
4. Verify instrumentation:
   `lmnr-cli sql query "SELECT * FROM traces ORDER BY start_time DESC LIMIT 1" --json`
```

### Manual setup

To setup Laminar manually, first install the `@lmnr-ai/lmnr` package.

<InstallPackages packages="@lmnr-ai/lmnr" />

### Get your project API key and set in the environment

Then, either sign up on [Laminar](https://laminar.sh) or self-host an instance ([github](https://github.com/lmnr-ai/lmnr)) and create a new project.

Use `npx lmnr-cli@latest setup`. This will:

- authenticate your device with Laminar,
- create a new project API key and save it to your .env as `LMNR_PROJECT_API_KEY`,
- install Laminar skill that your coding agent will use to instrument your agent using Laminar SDK

## Next.js

### Initialize tracing

In Next.js, Laminar initialization and the AI SDK telemetry integration should both be done in `instrumentation.{ts,js}`:

```javascript
export async function register() {
  // prevent this from running in the edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerTelemetry } = await import('ai');
    const { LaminarAiSdkTelemetry } = await import('@lmnr-ai/lmnr');

    registerTelemetry(new LaminarAiSdkTelemetry());
  }
}
```

### Add @lmnr-ai/lmnr to your next.config

In your `next.config.js` (`.ts` / `.mjs`), add the following lines:

```javascript
const nextConfig = {
  serverExternalPackages: ['@lmnr-ai/lmnr'],
};

export default nextConfig;
```

This is because Laminar depends on OpenTelemetry, which uses some Node.js-specific functionality, and we need to inform Next.js about it. Learn more in the [Next.js docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages).

### Tracing AI SDK calls

Once the integration is registered, telemetry is captured automatically on every AI SDK call:

```javascript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const { text } = await generateText({
  model: openai('gpt-5.4-mini'),
  prompt: 'What is Laminar flow?',
});
```

This will create spans for `ai.generateText`. Laminar collects and displays the following information:

- LLM call input and output
- Start and end time
- Duration / latency
- Provider and model used
- Input and output tokens
- Input and output price
- Additional metadata and span attributes

### Older versions of Next.js

If you are using 13.4 ≤ Next.js < 15, you will also need to enable the experimental instrumentation hook. Place the following in your `next.config.js`:

```javascript
module.exports = {
  experimental: {
    instrumentationHook: true,
  },
};
```

For more information, see Laminar's [AI SDK Integration guide](https://laminar.sh/docs/tracing/integrations/vercel-ai-sdk) and Next.js [instrumentation docs](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation). You can also learn how to enable all traces for Next.js in the docs.

### Usage with `@vercel/otel`

Laminar can live alongside `@vercel/otel` and trace AI SDK calls. The default Laminar setup will ensure that

- regular Next.js traces are sent via `@vercel/otel` to your Telemetry backend configured with Vercel,
- AI SDK and other LLM or browser agent traces are sent via Laminar.

```javascript
import { registerOTel } from '@vercel/otel';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerTelemetry } = await import('ai');
    const { initializeLaminarInstrumentations, LaminarAiSdkTelemetry } =
      await import('@lmnr-ai/lmnr');

    // Next.js telemetry
    registerOTel({
      serviceName: 'my-service',
      instrumentations: initializeLaminarInstrumentations(),
    });

    // Laminar AI SDK telemetry
    registerTelemetry(new LaminarAiSdkTelemetry());
  }
}
```

For an advanced configuration that allows you to trace all Next.js traces via Laminar, see an example [repo](https://github.com/lmnr-ai/lmnr-ts/tree/main/examples/nextjs).

### Usage with `@sentry/node`

Laminar can live alongside `@sentry/node` and trace AI SDK calls. Make sure to initialize Laminar **after** `Sentry.init`.

This will ensure that

- Whatever is instrumented by Sentry is sent to your Sentry backend,
- AI SDK and other LLM or browser agent traces are sent via Laminar.

```javascript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerTelemetry } = await import('ai');
    const Sentry = await import('@sentry/node');
    const { LaminarAiSdkTelemetry } = await import('@lmnr-ai/lmnr');

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
    });

    // Make sure to initialize Laminar **after** `Sentry.init`
    registerTelemetry(new LaminarAiSdkTelemetry());
  }
}
```

## Node.js

### Initialize tracing

Then, initialize tracing in your application:

```javascript
import { registerTelemetry } from 'ai';
import { LaminarAiSdkTelemetry } from '@lmnr-ai/lmnr';

registerTelemetry(new LaminarAiSdkTelemetry());
```

This must be done once in your application, as early as possible, but _after_ other tracing libraries (e.g. `@sentry/node`) are initialized.

Read more in Laminar [docs](https://laminar.sh/docs/tracing/introduction).

### Tracing AI SDK calls

Once the integration is registered, telemetry is captured automatically on every AI SDK call:

```javascript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const { text } = await generateText({
  model: openai('gpt-5.4-mini'),
  prompt: 'What is Laminar flow?',
});
```

This will create spans for `ai.generateText`. Laminar collects and displays the following information:

- LLM call input and output
- Start and end time
- Duration / latency
- Provider and model used
- Input and output tokens
- Input and output price
- Additional metadata and span attributes

### Usage with `@sentry/node`

Laminar can work with `@sentry/node` to trace AI SDK calls. Make sure to initialize Laminar **after** `Sentry.init`:

```javascript
const { LaminarAiSdkTelemetry } = await import('@lmnr-ai/lmnr');
const Sentry = await import('@sentry/node');
const { registerTelemetry } = await import('ai');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});

registerTelemetry(new LaminarAiSdkTelemetry());
```

This will ensure that

- Whatever is instrumented by Sentry is sent to your Sentry backend,
- AI SDK and other LLM or browser agent traces are sent via Laminar.

The two libraries allow for additional advanced configuration, but the default setup above is recommended.

## Additional configuration

### Laminar options

`LaminarAiSdkTelemetry` can pass options to Laminar.initialize(). For self-hosting users,

```javascript
import { registerTelemetry } from 'ai';
import { LaminarAiSdkTelemetry } from '@lmnr-ai/lmnr';

registerTelemetry(new LaminarAiSdkTelemetry({
  laminarOptions: {
    projectApiKey: process.env.LMNR_PROJECT_API_KEY,
    baseUrl: "http://localhost",
    httpPort: 8000,
    grpcPort: 8001,
  },
})));
```

### Do not record inputs or outputs

By default, Laminar integration records all inputs and outputs, but you can disable these in the constructor options.

```javascript
import { registerTelemetry } from 'ai';
import { LaminarAiSdkTelemetry } from '@lmnr-ai/lmnr';

registerTelemetry(new LaminarAiSdkTelemetry({
  recordInputs: false, // default true
  recordOutputs: false, // default true
})));
```

### Adding a span for every agent step

AI SDK telemetry integrations emit step spans for every agent step. By default, Laminar ignores these spans. You can
configure this in the constructor options.

```javascript
import { registerTelemetry } from 'ai';
import { LaminarAiSdkTelemetry } from '@lmnr-ai/lmnr';

registerTelemetry(new LaminarAiSdkTelemetry({
  createStepSpan: true, // default false
})));
```

### Span name

If you want to override the default span name, you can set the `functionId` inside the `telemetry` option.

```javascript
const { text } = await generateText({
  model: openai('gpt-5.4-mini'),
  prompt: `Write a poem about Laminar flow.`,
  telemetry: {
    functionId: 'poem-writer',
  },
});
```

### Nested spans

If you want to trace not just the AI SDK calls, but also other functions in your application, you can use Laminar's `observe` wrapper.

```javascript highlight="3"
import { observe } from '@lmnr-ai/lmnr';

const result = await observe({ name: 'my-function' }, async () => {
  // ... some work
  await generateText({
    //...
  });
  // ... some work
});
```

This will create a span with the name "my-function" and trace the function call. Inside it, you will see the nested `ai.generateText` spans.

To trace input arguments of the function that you wrap in `observe`, pass them to the wrapper as additional arguments. The return value of the function will be returned from the wrapper and traced as the span's output.

```javascript
const result = await observe(
  { name: 'poem writer' },
  async (topic: string, mood: string) => {
    const { text } = await generateText({
      model: openai('gpt-5.4-mini'),
      prompt: `Write a poem about ${topic} in ${mood} mood.`,
    });
    return text;
  },
  'Laminar flow',
  'happy',
);
```

### Metadata

In Laminar, metadata is set on the trace level. Metadata contains key-value pairs and can be used to filter traces.

```javascript
const { text } = await generateText({
  model: openai('gpt-5.4-mini'),
  prompt: `Write a poem about Laminar flow.`,
  telemetry: {
    metadata: {
      'my-key': 'my-value',
      'another-key': 'another-value',
    },
  },
});
```

This is converted to Laminar's [metadata](https://laminar.sh/docs/tracing/structure/metadata) and stored in the trace.

### Tags

One of the reserved metadata keys is `tags`. It can be used to add [tags](https://laminar.sh/docs/tracing/structure/tags) to the span.

Tags can subsequently be used to filter traces in Laminar.

```javascript
const { text } = await generateText({
  model: openai('gpt-5.4-mini'),
  prompt: `Write a poem about Laminar flow.`,
  telemetry: {
    metadata: {
      tags: ['fallback-model', 'api-handler'],
    },
  },
});
```

### Session ID and User ID

Traces in Laminar can be grouped into [sessions](https://laminar.sh/docs/tracing/structure/sessions) or by [user ID](https://laminar.sh/docs/tracing/structure/user-id). These are also
reserved metadata keys.

```javascript
const { text } = await generateText({
  model: openai('gpt-5.4-mini'),
  prompt: `Write a poem about Laminar flow.`,
  telemetry: {
    metadata: {
      sessionId: 'session-123',
      userId: 'user-123',
    },
  },
});
```
