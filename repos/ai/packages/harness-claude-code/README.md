# AI SDK - Claude Code Harness

`HarnessV1` adapter backed by [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk), which drives the `claude` CLI. The adapter ships a bridge process that runs inside a sandbox and talks to the host over a WebSocket on a sandbox-proxied loopback port.

## Setup

```bash
npm i @ai-sdk/harness-claude-code @ai-sdk/harness @ai-sdk/sandbox-vercel
```

The bridge installs `@anthropic-ai/claude-agent-sdk` and `@anthropic-ai/claude-code` inside the sandbox the first time the session starts.

## Usage

```ts
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createClaudeCode } from '@ai-sdk/harness-claude-code';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { tool } from 'ai';
import { z } from 'zod/v4';

const agent = new HarnessAgent({
  harness: createClaudeCode({
    skills: [
      {
        name: 'careful-refactors',
        description: 'Make minimal diffs and keep tests green.',
        content: 'Prefer changes that touch the fewest files possible.',
      },
    ],
  }),
  id: 'demo',
  sandbox: createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
  }),
  tools: {
    deploy: tool({
      description: 'Deploy a service.',
      inputSchema: z.object({ env: z.enum(['staging', 'production']) }),
      execute: async ({ env }) => ({ url: `https://${env}.example.com` }),
    }),
  },
  harnessOptions: {
    'claude-code': {
      thinking: { type: 'adaptive', display: 'summarized' },
    },
  },
});

const session = await agent.createSession();

try {
  const result = await agent.generate({
    session,
    prompt: 'Read README.md and summarise the goals.',
  });
  console.log(result.text);
} finally {
  await session.destroy();
}
```

The adapter requires a `HarnessV1SandboxProvider` whose handles expose at least one port — `@ai-sdk/sandbox-vercel` is the supported choice today. The agent calls `provider.createSession()` when a session starts. Use `session.detach()` to park the bridge and sandbox, `session.stop()` to save state and stop the sandbox, or `session.destroy()` to clean up without keeping resume state.
