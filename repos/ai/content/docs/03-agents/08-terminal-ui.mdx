---
title: Terminal UI
description: Run AI SDK agents in an interactive terminal UI.
---

# Terminal UI

The `@ai-sdk/tui` package lets you run a local `ToolLoopAgent` or connect to a
remote agent through a `ChatTransport` in an interactive terminal interface.
It is useful for local development, demos, and internal tools where a terminal
experience is enough and you do not want to build a custom UI.

The terminal UI handles prompt input, streamed assistant responses, markdown
rendering, tool cards, reasoning sections, scrolling, and tool approval prompts.

## Installation

Install `@ai-sdk/tui` alongside `ai` and the provider package you use:

<Snippet text={`pnpm add @ai-sdk/tui ai @ai-sdk/openai`} prompt={false} />

## Running an Agent

Create a `ToolLoopAgent` and pass it to `runAgentTUI`:

```ts
import { openai } from '@ai-sdk/openai';
import { runAgentTUI } from '@ai-sdk/tui';
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: openai('gpt-5'),
  instructions:
    'You are a helpful terminal assistant. Answer in markdown and use tools when they help.',
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72,
      }),
    }),
  },
});

await runAgentTUI({
  title: 'Weather Agent',
  agent,
});
```

`runAgentTUI` runs until the user exits with `Esc` or `Ctrl+C`.

## Connecting to a Remote Agent

Pass a `ChatTransport` instead of an `agent` to connect the terminal UI to a
remote AI SDK UI message endpoint:

```ts
import { runAgentTUI } from '@ai-sdk/tui';
import { DefaultChatTransport } from 'ai';

await runAgentTUI({
  title: 'Remote Agent',
  transport: new DefaultChatTransport({
    api: 'https://example.com/api/chat',
  }),
});
```

The transport controls the endpoint, authentication, request body, and other
remote communication behavior. The terminal UI keeps its internal chat id and
message history private to the transport contract.

## Sandbox

Pass a sandbox session with the `sandbox` option when your agent tools need an
execution environment:

```ts
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';

const sandboxSession = await createJustBashSandbox({
  cwd: '/home/user',
}).createSession();

await runAgentTUI({
  title: 'Sandbox Agent',
  agent,
  sandbox: sandboxSession.restricted(),
});
```

The terminal UI forwards the sandbox to every agent call as
`experimental_sandbox`. Tool description functions and tool `execute` functions
can read it from their options and delegate command or file operations to it.
Add the sandbox description to your agent instructions if the model should know
details such as the working directory, public hostname, or exposed ports.

## Display Options

You can control how tool calls, reasoning, and response statistics are shown:

```ts
await runAgentTUI({
  title: 'Weather Agent',
  agent,
  tools: 'auto-collapsed',
  reasoning: 'collapsed',
  responseStatistics: 'outputTokensPerSecond',
  contextSize: 200_000,
});
```

Settings:

- `tools`: Controls tool call rendering. Use `"full"` to show tool input and
  output, `"collapsed"` to show only tool cards, `"auto-collapsed"` to show the
  latest tool expanded until another visible section appears, or `"hidden"` to
  omit tool calls. Defaults to `"auto-collapsed"`.
- `reasoning`: Controls reasoning rendering. Use `"full"` to show reasoning,
  `"collapsed"` to show only reasoning cards, `"auto-collapsed"` to show the
  latest reasoning expanded until another visible section appears, or `"hidden"`
  to omit reasoning. Defaults to `"auto-collapsed"`.
- `responseStatistics`: Use `"outputTokensPerSecond"` to show output token
  throughput or `"outputTokenCount"` to show output token count. Defaults to
  `"outputTokensPerSecond"`.
- `contextSize`: When provided, the terminal UI shows total token usage as a
  percentage of the model context window.

## Tool Approvals

`runAgentTUI` supports `ToolLoopAgent` tool approval flows. When an agent emits a
manual approval request, the terminal UI prompts the user to approve or deny the
tool call before the agent continues.

```ts
const agent = new ToolLoopAgent({
  model: openai('gpt-5'),
  tools: { weather },
  toolApproval: {
    weather: ({ location }) =>
      location.toLowerCase().includes('san francisco')
        ? 'approved'
        : 'user-approval',
  },
});

await runAgentTUI({ title: 'Weather Agent', agent });
```

## Compatibility

When using the `agent` option, the agent must be runnable directly from terminal
user input. It must not require per-call options and must not use structured
output, because the terminal UI cannot infer those values from a free-form
prompt. Use a `transport` for remote agents that need custom request handling.

Use `agent.generate()` or `agent.stream()` directly for examples or apps that
need fixed prompts, call options, structured output, custom result inspection, or
custom stream processing.

## Controls

- `Enter`: submit prompt
- `y` / `n`: approve or deny tool calls
- `Up` / `Down`: scroll transcript
- `PageUp` / `PageDown`: scroll transcript by a full page
- `Ctrl+L`: repaint
- `Esc` / `Ctrl+C`: exit

## Next Steps

- [Building Agents](/docs/agents/building-agents) for creating `ToolLoopAgent`
  instances
- [Tool Approvals](/docs/agents/tool-approvals) for configuring human review of
  tool calls
- [runAgentTUI API Reference](/docs/reference/ai-sdk-tui/run-agent-tui) for
  detailed parameter documentation
