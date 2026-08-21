---
title: runAgentTUI
description: API Reference for the runAgentTUI function.
---

# `runAgentTUI()`

Runs a local agent or chat transport in an interactive terminal UI. The
terminal UI reads user prompts, streams assistant responses, renders markdown,
displays tool and reasoning sections, and handles manual tool approvals.

`runAgentTUI` runs until the user exits with `Esc` or `Ctrl+C`.

```ts
import { openai } from '@ai-sdk/openai';
import { runAgentTUI } from '@ai-sdk/tui';
import { ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: openai('gpt-5'),
  instructions: 'You are a helpful terminal assistant.',
});

await runAgentTUI({
  title: 'Assistant',
  agent,
});
```

## Import

<Snippet text={`import { runAgentTUI } from "@ai-sdk/tui"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'options',
      type: 'RunAgentTUIOptions',
      isRequired: true,
      description: 'Options for starting the terminal UI.',
      properties: [
        {
          type: 'RunAgentTUIOptions',
          parameters: [
            {
              name: 'agent',
              type: 'AgentTUIAgent',
              isOptional: true,
              description:
                'The agent to run. Provide exactly one of `agent` or `transport`. The agent must not require per-call options and must not use structured output.',
            },
            {
              name: 'transport',
              type: 'ChatTransport<UIMessage>',
              isOptional: true,
              description:
                'The transport used to communicate with a remote agent. Provide exactly one of `agent` or `transport`.',
            },
            {
              name: 'title',
              type: 'string',
              isOptional: true,
              description:
                'The title shown in the terminal UI. If omitted, no title is shown.',
            },
            {
              name: 'tools',
              type: "'full' | 'collapsed' | 'auto-collapsed' | 'hidden'",
              isOptional: true,
              description:
                'Controls how tool call sections are displayed. Defaults to `auto-collapsed`.',
            },
            {
              name: 'reasoning',
              type: "'full' | 'collapsed' | 'auto-collapsed' | 'hidden'",
              isOptional: true,
              description:
                'Controls how reasoning sections are displayed. Defaults to `auto-collapsed`.',
            },
            {
              name: 'responseStatistics',
              type: "'outputTokenCount' | 'outputTokensPerSecond'",
              isOptional: true,
              description:
                'Controls which response statistic is shown in response headers. Defaults to `outputTokensPerSecond`.',
            },
            {
              name: 'contextSize',
              type: 'number',
              isOptional: true,
              description:
                'The model context window size in tokens. When provided, the terminal UI shows total token usage as a percentage of this context window.',
            },
            {
              name: 'sandbox',
              type: 'Experimental_SandboxSession',
              isOptional: true,
              description:
                'Sandbox session that is passed through to the agent as `experimental_sandbox` on every call.',
            },
          ],
        },
      ],
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'returns',
      type: 'Promise<void>',
      description: 'A promise that resolves when the terminal UI exits.',
    },
  ]}
/>

## Types

### `AgentTUIAgent`

An agent that is compatible with the terminal UI:

```ts
type AgentTUIAgent = Agent<undefined, any, any, never>;
```

This means the agent has no per-call options and no structured output.

### `TerminalPartDisplayMode`

Controls how terminal sections are displayed:

```ts
type TerminalPartDisplayMode =
  | 'full'
  | 'collapsed'
  | 'auto-collapsed'
  | 'hidden';
```

- `"full"`: Show the section header and full content.
- `"collapsed"`: Show only the section header.
- `"auto-collapsed"`: Show the latest section expanded until another visible
  section appears, then collapse it.
- `"hidden"`: Omit the section entirely.

### `ResponseStatisticsMode`

Controls which response statistic is shown:

```ts
type ResponseStatisticsMode = 'outputTokenCount' | 'outputTokensPerSecond';
```

- `"outputTokenCount"`: Show the number of output tokens in the response.
- `"outputTokensPerSecond"`: Show output token throughput for the response.

## Example with Tool Display Options

```ts
await runAgentTUI({
  title: 'Assistant',
  agent,
  tools: 'auto-collapsed',
  reasoning: 'collapsed',
  responseStatistics: 'outputTokenCount',
  contextSize: 200_000,
});
```

## Example with a Chat Transport

```ts
import { DefaultChatTransport } from 'ai';

await runAgentTUI({
  title: 'Remote Assistant',
  transport: new DefaultChatTransport({
    api: 'https://example.com/api/chat',
  }),
});
```

## Example with Sandbox

```ts
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';

const sandboxSession = await createJustBashSandbox({
  cwd: '/home/user',
}).createSession();

await runAgentTUI({
  title: 'Sandbox Assistant',
  agent,
  sandbox: sandboxSession.restricted(),
});
```

The sandbox is forwarded to every `agent.stream()` call as
`experimental_sandbox`, making it available to tool description functions and
tool `execute` functions. Include the sandbox description in the agent
instructions when the model should know sandbox-specific details such as the
working directory or exposed ports.

## Compatibility

Use the `agent` option for agents that can run directly from free-form user
input. Use the `transport` option to communicate with a remote agent. Use
`agent.generate()` or `agent.stream()` directly when you need fixed prompts,
per-call options, structured output, custom result inspection, or custom stream
processing.

## Related

- [Terminal UI guide](/docs/agents/terminal-ui)
- [Building Agents](/docs/agents/building-agents)
- [ToolLoopAgent guide](/docs/agents/overview#toolloopagent-class)
