---
title: Overview
description: Learn how to build agents with the AI SDK.
---

# Agents

Agents are **large language models (LLMs)** that use **tools** in a **loop** to accomplish tasks.

These components work together:

- **LLMs** process input and decide the next action
- **Tools** extend capabilities beyond text generation (reading files, calling APIs, writing to databases)
- **Loop** orchestrates execution through:
  - **Context management** - Maintaining conversation history and deciding what the model sees (input) at each step
  - **Stopping conditions** - Determining when the loop (task) is complete

## Agent State and Context

Agents often need server-side state that should not be placed directly in the
prompt, such as tenant settings, request IDs, feature flags, credentials, or
progress through a task.

Use `runtimeContext` as the agent's shared runtime state. It flows through the
agent loop, is available in `prepareStep` and lifecycle callbacks, and can be
updated between steps. Use `toolsContext` for per-tool values such as API keys
or scoped permissions; each tool receives only its own typed `context` based on
its `contextSchema`.

Learn more in [Runtime and Tool
Context](/docs/ai-sdk-core/runtime-and-tool-context).

## ToolLoopAgent Class

The ToolLoopAgent class handles these three components. Here's an agent that uses multiple tools in a loop to accomplish a task:

```ts
import { ToolLoopAgent, tool } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

const weatherAgent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    weather: tool({
      description: 'Get the weather in a location (in Fahrenheit)',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
    convertFahrenheitToCelsius: tool({
      description: 'Convert temperature from Fahrenheit to Celsius',
      inputSchema: z.object({
        temperature: z.number().describe('Temperature in Fahrenheit'),
      }),
      execute: async ({ temperature }) => {
        const celsius = Math.round((temperature - 32) * (5 / 9));
        return { celsius };
      },
    }),
  },
});

const result = await weatherAgent.generate({
  prompt: 'What is the weather in San Francisco in celsius?',
});

console.log(result.text); // agent's final answer
console.log(result.steps); // steps taken by the agent
```

The agent automatically:

1. Calls the `weather` tool to get the temperature in Fahrenheit
2. Calls `convertFahrenheitToCelsius` to convert it
3. Generates a final text response with the result

The ToolLoopAgent handles the loop, context management, and stopping conditions.

## Why Use the ToolLoopAgent?

The ToolLoopAgent is the recommended approach for building agents with the AI SDK because it:

- **Reduces boilerplate** - Manages loops and message arrays
- **Improves reusability** - Define once, use throughout your application
- **Simplifies maintenance** - Single place to update agent configuration

For most use cases, start with the ToolLoopAgent. Use core functions (`generateText`, `streamText`) when you need explicit control over each step for complex structured workflows.

## HarnessAgent Class

Use `HarnessAgent` when you want to run a preconfigured established harness,
such as Claude Code, Codex, or Pi, instead of building the loop yourself around
a language model. Harnesses are a separate abstraction from providers and
models, but stream into AI SDK-compatible result and UI primitives.

Learn more in [Harnesses](/docs/ai-sdk-harnesses) and
[HarnessAgent](/docs/ai-sdk-harnesses/harness-agent).

The rest of this section focuses on `ToolLoopAgent`, which is the AI SDK agent
class for building your own model-and-tools loop.

## Terminal UI

Use `@ai-sdk/tui` to run a `ToolLoopAgent` in an interactive terminal UI. It is
useful for local agent development, demos, and internal tools where you want
prompt input, streamed responses, tool cards, reasoning sections, scrolling, and
tool approval prompts without building a custom interface.

```ts
import { runAgentTUI } from '@ai-sdk/tui';

await runAgentTUI({
  title: 'Weather Agent',
  agent: weatherAgent,
});
```

Learn more in [Terminal UI](/docs/agents/terminal-ui).

## Structured Workflows

Agents are flexible and powerful, but non-deterministic. When you need reliable, repeatable outcomes with explicit control flow, use core functions with structured workflow patterns combining:

- Conditional statements for explicit branching
- Standard functions for reusable logic
- Error handling for robustness
- Explicit control flow for predictability

[Explore workflow patterns](/docs/agents/workflows) to learn more about building structured, reliable systems.

## Next Steps

- **[Building Agents](/docs/agents/building-agents)** - Guide to creating agents with the ToolLoopAgent
- **[Runtime and Tool Context](/docs/ai-sdk-core/runtime-and-tool-context)** - How to pass shared agent state and per-tool context
- **[Workflow Patterns](/docs/agents/workflows)** - Structured patterns using core functions for complex workflows
- **[Loop Control](/docs/agents/loop-control)** - Execution control with stopWhen and prepareStep
