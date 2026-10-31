# AI SDK - Harness Specification and Agent

_This package is **experimental**._

`HarnessAgent` implementation plus the underlying harness specification, including an expanded network session sandbox interface to support harness sandbox needs.

## Setup

```bash
npm i ai zod @ai-sdk/harness @ai-sdk/harness-claude-code @ai-sdk/sandbox-vercel
```

## Usage

```ts
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { tool } from 'ai';
import { z } from 'zod/v4';

const agent = new HarnessAgent({
  harness: claudeCode,
  id: 'auth-agent',
  instructions:
    'You are a careful refactoring assistant. Prefer minimal diffs.',
  sandbox: createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
  }),
  sandboxConfig: {
    bootstrapHash: 'ripgrep-v1',
    onBootstrap: async ({ session, abortSignal }) => {
      const streamResult = await session.run({
        command:
          'command -v rg >/dev/null || (apt-get update && apt-get install -y ripgrep)',
        abortSignal,
      });
      if (result.exitCode !== 0) {
        throw new Error(`Failed to install ripgrep: ${result.stderr}`);
      }
    },
    onSession: async ({ session, sessionWorkDir, abortSignal }) => {
      await session.writeTextFile({
        path: `${sessionWorkDir}/README.md`,
        content: 'Workspace notes for this session.',
        abortSignal,
      });
    },
  },
  tools: {
    deploy: tool({
      description: 'Deploy to a target environment',
      inputSchema: z.object({ env: z.enum(['staging', 'production']) }),
      execute: async ({ env }) => ({ url: `https://${env}.example.com` }),
    }),
  },
});

const session = await agent.createSession();

try {
  const generateResult = await agent.generate({
    session,
    prompt: 'Fix the failing test in src/auth.ts',
  });
  console.log(generateResult.text);

  // Streaming
  const streamResult = await agent.stream({
    session,
    prompt: 'Now write a regression test',
  });
  for await (const part of streamResult.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }
} finally {
  await session.destroy();
}
```

Use `session.detach()` to park a bridge-backed session for later attach, `session.stop()` to save state and stop the sandbox, or `session.destroy()` to clean up without keeping resume state. Bridge-backed adapters such as Claude Code, Codex, OpenCode, and DeepAgents require a sandbox provider that exposes ports — `@ai-sdk/sandbox-vercel` is the supported choice today. `@ai-sdk/sandbox-just-bash` is suitable only for host-runtime or otherwise non-bridge flows, such as Pi.

`sandbox` is a required `HarnessV1SandboxProvider` — the agent calls `provider.createSession()` when a session starts. Use `sandboxConfig` for agent specific sandbox configuration that works independently from the sandbox provider that is used:

- Use `sandboxConfig.onSession` to prepare the acquired sandbox before the harness adapter starts. The hook runs for fresh and resumed sessions, so keep it idempotent.
- Use `sandboxConfig.onBootstrap` for expensive sandbox setup that should be baked into a reusable snapshot, such as installing tools or cloning a large repository. Provide `sandboxConfig.bootstrapHash` with it and change that value whenever the bootstrap output should invalidate the cached snapshot.
- Use `sandboxConfig.workDir` to set a stable working directory for the agent, relative to the sandbox's default working directory; otherwise regular sessions use the existing `<harnessId>-<sessionId>` directory. In that case, the `onBootstrap` callback receives the sandbox's default working directory.

Use `prepareHarnessSandboxTemplate()` to create or refresh the sandbox provider's
own reusable template for one harness before serving traffic. This is the
replacement for `prewarmHarness()`, which remains as a deprecated alias.

Use `prepareSandboxForHarness()` when you own an existing sandbox and want to
prepare it before creating your own snapshot. It applies the selected harness
bootstrap recipes and `sandboxConfig.onBootstrap`, returns the computed
preparation identity and per-harness recipe identities, and leaves snapshotting
or stopping the sandbox to your code. Later, create a sandbox from that snapshot
and pass the native sandbox object to `createVercelSandbox({ sandbox })` for the
`HarnessAgent`. When you reuse a caller-provided sandbox with a bridge-backed
harness, declare the available port pool, for example
`createVercelSandbox({ sandbox, bridgePorts: [4000] })`.

### Available harnesses

See the [harness adapters documentation](https://ai-sdk.dev/v7/docs/ai-sdk-harnesses/harness-adapters).

## Implementing a harness

Implement the `HarnessV1` factory and a `HarnessV1Session` whose `doPromptTurn` emits events; the agent surface, streaming, tool execution, and multi-turn state are handled for you. Read `startOpts.sandboxSession` for the network sandbox session the agent created and will stop on cleanup. Call `sandboxSession.restricted()` for the tool-safe file-IO/exec/spawn surface.

```ts
import type { HarnessV1, HarnessV1Session } from '@ai-sdk/harness';

export function myHarness(): HarnessV1 {
  return {
    specificationVersion: 'harness-v1',
    harnessId: 'my-harness',
    builtinTools: {},
    doStart: async startOpts => {
      const usage = {
        inputTokens: { total: 0, noCache: 0 },
        outputTokens: { total: 0, text: 0 },
      };
      const resumeState = {
        type: 'resume-session' as const,
        harnessId: 'my-harness',
        specificationVersion: 'harness-v1' as const,
        data: {},
      };
      const continueState = {
        type: 'continue-turn' as const,
        harnessId: 'my-harness',
        specificationVersion: 'harness-v1' as const,
        data: {},
      };
      const session: HarnessV1Session = {
        sessionId: startOpts.sessionId,
        isResume:
          startOpts.resumeFrom != null || startOpts.continueFrom != null,
        doPromptTurn: async promptOpts => {
          const done = Promise.resolve().then(() => {
            promptOpts.emit({ type: 'text-start', id: 't' });
            promptOpts.emit({ type: 'text-delta', id: 't', delta: 'Hello.' });
            promptOpts.emit({ type: 'text-end', id: 't' });
            promptOpts.emit({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              totalUsage: usage,
            });
          });
          return { submitToolResult: async () => {}, done };
        },
        doContinueTurn: async continueOpts => {
          const done = Promise.resolve().then(() => {
            continueOpts.emit({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              totalUsage: usage,
            });
          });
          return { submitToolResult: async () => {}, done };
        },
        doCompact: async () => {},
        doDetach: async () => resumeState,
        doStop: async () => resumeState,
        doDestroy: async () => {},
        doSuspendTurn: async () => continueState,
      };
      return session;
    },
  };
}
```
