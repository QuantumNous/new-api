---
title: Runtime and Tool Context
description: Learn how runtime context, tool context, and telemetry context filtering work together.
---

# Runtime and Tool Context

Context lets you pass server-side state through a generation or agent loop
without putting that state into the prompt. The AI SDK separates shared runtime
state from per-tool execution state so agents can keep track of their work while
tools only receive the values they need.

Use context for values such as tenant information, feature flags, session data,
request IDs, API credentials, access tokens, or other application state that
should affect execution.

## Context Types

| Concept                           | Where you define it                                                | Where you read it                                                                               | Use it for                                                    |
| --------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `runtimeContext`                  | `generateText`, `streamText`, or `ToolLoopAgent` calls             | `prepareStep`, lifecycle callbacks, step results, and telemetry                                 | Shared generation or agent state                              |
| `toolsContext`                    | `generateText`, `streamText`, or `ToolLoopAgent` calls             | `prepareStep`, approval callbacks, tool context resolution, and tool description functions      | A map of per-tool context values keyed by tool name           |
| tool `context`                    | Each tool's `toolsContext` entry, validated by its `contextSchema` | Tool description functions, tool `execute`, `needsApproval`, and tool input lifecycle callbacks | Values needed by one tool                                     |
| `toolContext`                     | Derived from one tool's context                                    | Tool approval callbacks and tool execution events                                               | The event/callback name for one tool's context                |
| `telemetry.includeRuntimeContext` | The generation or agent call                                       | Telemetry filtering                                                                             | Top-level `runtimeContext` properties to include in telemetry |
| `telemetry.includeToolsContext`   | The generation or agent call                                       | Telemetry filtering                                                                             | Top-level tool context properties to include in telemetry     |

In agents, `runtimeContext` is the agent's shared runtime state. It flows
through the loop and can be read or updated in `prepareStep` between model
calls. Tool-specific data stays in `toolsContext`, where each tool receives only
its own validated `context`.

```txt
generateText / streamText / ToolLoopAgent
  -> runtimeContext
       -> prepareStep, lifecycle callbacks, step results
       -> telemetry, filtered by telemetry.includeRuntimeContext
  -> toolsContext
       -> prepareStep
       -> one tool's context / toolContext
            -> execute, approval callbacks, tool events
            -> telemetry, filtered by telemetry.includeToolsContext
```

## Runtime Context

Pass `runtimeContext` when you need shared state for the whole generation or
agent loop. It is not added to the model prompt automatically. Use it to
configure step preparation, track server-side state, or correlate lifecycle
events.

```ts
const result = await generateText({
  model: __MODEL__,
  prompt: 'Help the user plan their trip.',
  runtimeContext: {
    tenantId: 'tenant_123',
    plan: 'enterprise',
    requestId: 'req_abc',
  },
  prepareStep: async ({ runtimeContext }) => {
    if (runtimeContext.plan === 'enterprise') {
      return { temperature: 0.2 };
    }

    return {};
  },
});
```

`prepareStep` can return a new `runtimeContext`. The new value affects the
current step and all subsequent steps, which makes it the right place to update
agent state between turns of the loop.

## Tool Context

Use `toolsContext` for values that belong to a specific tool. Each tool declares
the context it expects with `contextSchema`; the matching `toolsContext` entry is
validated and passed to the tool as `context`.

```ts highlight="9-12,25-30"
import { generateText, tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get the weather in a location',
  inputSchema: z.object({
    location: z.string(),
  }),
  contextSchema: z.object({
    weatherApiKey: z.string(),
    defaultUnit: z.enum(['celsius', 'fahrenheit']),
  }),
  execute: async ({ location }, { context }) => {
    return fetchWeather({
      location,
      apiKey: context.weatherApiKey,
      unit: context.defaultUnit,
    });
  },
});

const result = await generateText({
  model: __MODEL__,
  tools: { weather: weatherTool },
  toolsContext: {
    weather: {
      weatherApiKey: process.env.WEATHER_API_KEY!,
      defaultUnit: 'fahrenheit',
    },
  },
  prompt: 'What is the weather in San Francisco?',
});
```

When at least one tool declares `contextSchema`, `toolsContext` is required for
the tools that need context. A tool receives only its own context, not the full
`toolsContext` map. Tool description functions receive the same typed `context`
before each model call, so descriptions can change with the current tool
context.

Treat tool context as immutable inside tools. If you need to change tool context
between steps, inspect the previous step in `prepareStep` and return an updated
`toolsContext`.

## Telemetry Context Filtering

Context often contains values that are useful inside your application but should
not be sent to telemetry providers. Use `telemetry.includeRuntimeContext` to
include selected top-level runtime context properties in telemetry, and
`telemetry.includeToolsContext` to include selected top-level tool context
properties per tool.

```ts highlight="34-43"
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

const customerLookup = tool({
  description: 'Look up customer account details',
  inputSchema: z.object({
    customerId: z.string(),
  }),
  contextSchema: z.object({
    apiKey: z.string(),
    region: z.string(),
  }),
  execute: async ({ customerId }, { context }) => {
    return lookupCustomer({
      customerId,
      apiKey: context.apiKey,
      region: context.region,
    });
  },
});

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: { customerLookup },
});

const result = await agent.generate({
  prompt: 'Check whether customer cust_123 is eligible for priority support.',
  runtimeContext: {
    requestId: 'req_abc',
    tenantId: 'tenant_123',
    userId: 'user_123',
  },
  telemetry: {
    includeRuntimeContext: {
      requestId: true,
    },
    includeToolsContext: {
      customerLookup: {
        region: true,
      },
    },
  },
  toolsContext: {
    customerLookup: {
      apiKey: process.env.CUSTOMER_API_KEY!,
      region: 'us',
    },
  },
});
```

In this example, telemetry receives `runtimeContext` with only `requestId` and the
`customerLookup` context with only `region`.

<Note>
  Context filters only affect telemetry integrations, including OpenTelemetry
  integrations. Tool execution, lifecycle callbacks, and returned results still
  receive the full context values.
</Note>

Context telemetry filtering is shallow. For `telemetry.includeRuntimeContext`, only
top-level properties marked as `true` are sent when it is configured; if it is
omitted, no runtime context properties are sent. For
`telemetry.includeToolsContext`, only top-level tool context properties marked as
`true` are sent when it is configured; if it is omitted, no tool context
properties are sent.

## Where Context Is Available

| Location                          | `runtimeContext`                              | `toolsContext`                              | Tool `context` / `toolContext`                           |
| --------------------------------- | --------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| `prepareStep`                     | Read and update                               | Read and update                             | Not directly                                             |
| Tool description functions        | Not passed directly                           | Not passed directly                         | Read one tool's validated `context`                      |
| Tool `execute`                    | Not passed directly                           | Not passed directly                         | Read one tool's validated `context`                      |
| Tool approval                     | Read in generic and per-tool callbacks        | Read in generic callbacks                   | Read as `toolContext` in per-tool callbacks              |
| Tool execution events             | Not included                                  | Not included                                | Read as `toolContext`                                    |
| Step results and finish callbacks | Read final or per-step state                  | Read final or per-step state                | Available through the per-tool entries in `toolsContext` |
| Telemetry                         | Filtered by `telemetry.includeRuntimeContext` | Filtered by `telemetry.includeToolsContext` | Filtered by `telemetry.includeToolsContext`              |

## Choosing the Right Context

- Use `runtimeContext` for state shared by the whole generation or agent loop,
  such as request metadata, tenant settings, feature flags, or agent progress.
- Use `toolsContext` and `contextSchema` for values needed by a specific tool,
  such as API keys, scoped clients, user permissions, or default tool settings.
- Use prompt messages for information the model should reason about or mention
  in its answer.
- Use `telemetry.includeRuntimeContext` and `telemetry.includeToolsContext` to
  reduce telemetry exposure, not as a general security boundary.

Learn more about [tools and tool calling](/docs/ai-sdk-core/tools-and-tool-calling),
[lifecycle callbacks](/docs/ai-sdk-core/lifecycle-callbacks), and
[telemetry](/docs/ai-sdk-core/telemetry).
