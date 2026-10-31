# @ai-sdk/tui

Run local or remote AI SDK agents in a terminal UI.

`@ai-sdk/tui` provides a full-screen interface with streaming output,
tool cards, approvals, markdown rendering, scrollback, and a pinned prompt.

## Install

```bash
npm install @ai-sdk/tui ai
pnpm add @ai-sdk/tui ai
bun add @ai-sdk/tui ai
```

## Usage

```ts
import { openai } from '@ai-sdk/openai';
import { runAgentTUI } from '@ai-sdk/tui';
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

await runAgentTUI({
  title: 'Weather Agent',
  agent: new ToolLoopAgent({
    model: openai('gpt-5.4-mini'),
    instructions:
      'You are a concise weather assistant.' +
      'Use the weather tool when the user asks about weather, ' +
      'then answer in markdown.',
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({ city: z.string() }),
        execute({ city }) {
          const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
          const weather =
            weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

          return { city, temperature: 72, weather };
        },
      }),
    },
    toolApproval: {
      weather: 'user-approval',
    },
  }),
});
```

To connect to a remote agent, pass a `ChatTransport` instead:

```ts
import { runAgentTUI } from '@ai-sdk/tui';
import { DefaultChatTransport } from 'ai';

await runAgentTUI({
  title: 'Remote Agent',
  transport: new DefaultChatTransport({ api: 'https://example.com/api/chat' }),
});
```

## Controls

- `Enter`: submit prompt
- `y` / `n`: approve or reject tool calls
- `Up` / `Down`: scroll transcript
- `PageUp` / `PageDown`: scroll transcript by a full page
- `Ctrl+L`: repaint
- `Esc` / `Ctrl+C`: exit

## API

```ts
await runAgentTUI({
  agent,
  title: 'My Agent',
  tools: 'collapsed',
  reasoning: 'hidden',
  responseStatistics: 'outputTokenCount',
  sandbox,
});
```

Settings:

- `agent`: AI SDK agent to run. Provide either `agent` or `transport`.
- `transport`: AI SDK chat transport used to communicate with a remote agent.
  Provide either `agent` or `transport`.
- `title`: optional title shown in the terminal UI.
- `tools`: tool call rendering mode. Use `"full"` to show tool input and output, `"collapsed"` to show only tool cards, `"auto-collapsed"` to show the latest tool expanded until another visible section appears, or `"hidden"` to omit tool calls. Defaults to `"auto-collapsed"`.
- `reasoning`: reasoning rendering mode. Use `"full"` to show reasoning, `"collapsed"` to show only reasoning cards, `"auto-collapsed"` to show the latest reasoning expanded until another visible section appears, or `"hidden"` to omit reasoning. Defaults to `"auto-collapsed"`.
- `responseStatistics`: response header statistic. Use `"outputTokensPerSecond"` to show output token throughput or `"outputTokenCount"` to show output token count. Defaults to `"outputTokensPerSecond"`.
- `sandbox`: optional sandbox session forwarded to every agent call as `experimental_sandbox` for tool descriptions and tool execution. Only available with `agent`.
