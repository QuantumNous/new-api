# @ai-sdk/harness-deepagents

A [HarnessV1](../harness) adapter that runs [Deep Agents](https://github.com/langchain-ai/deepagentsjs)
(LangChain's LangGraph-based agent harness) as a coding-agent runtime inside an
AI SDK sandbox.

This is a **bridge-backed** harness: the Deep Agents runtime runs inside the
sandbox via a Node bridge (`node bridge.mjs`) built on the shared
`@ai-sdk/harness/bridge` runtime, while the host adapter drives turns over a
WebSocket.

> **Status: happy-path validated.** The host adapter (`doStart` + session:
> `doPromptTurn`/`doStop`/`doDestroy`) and the Node bridge (driving the
> `deepagents` npm package via `createDeepAgent` + `streamEvents`) are validated
> end-to-end against a live Vercel Sandbox: text generation, streaming,
> multi-turn memory, and host-executed tools all work. Turn continuation,
> suspend/detach, cross-process resume, and built-in tool approvals throw
> `HarnessCapabilityUnsupportedError` and are follow-ups.

## Setup

```bash
pnpm add @ai-sdk/harness-deepagents @ai-sdk/harness
```

The harness installs the
bridge's Node dependencies (the `deepagents` package and LangChain) into its
bootstrap directory via `pnpm` at startup.

## Usage

```ts
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { deepAgents } from '@ai-sdk/harness-deepagents';

const agent = new HarnessAgent({
  harness: deepAgents,
  // ...sandbox provider configuration
});
```

Configure the model and auth via `createDeepAgents({ model, auth })`.

## Auth

Auth is optional and provider-aware: the provider is resolved from the model id
(`anthropic/…` or `openai/…`, defaulting to Anthropic). With none configured the
adapter falls back to ambient AI Gateway credentials (`AI_GATEWAY_API_KEY`, then
`VERCEL_OIDC_TOKEN`), then ambient provider creds (`ANTHROPIC_*` / `OPENAI_*`).
Pin explicitly with `auth.anthropic`, `auth.openai`, or `auth.gateway`:

```ts
createDeepAgents({
  model: 'openai/gpt-5',
  auth: { openai: { apiKey: process.env.OPENAI_API_KEY } },
});
```

## Built-in tools

| Common name | Native (LangGraph) tool |
| ----------- | ----------------------- |
| `read`      | `read_file`             |
| `write`     | `write_file`            |
| `bash`      | `shell`                 |
| `grep`      | `search`                |

See the [harness docs](https://ai-sdk.dev/docs) for broader concepts.
