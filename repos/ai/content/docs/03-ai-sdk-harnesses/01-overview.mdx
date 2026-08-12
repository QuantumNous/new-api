---
title: Overview
description: Learn what AI SDK harnesses are and how they fit into the AI SDK.
---

# AI SDK Harnesses

The AI SDK harness abstraction lets you run established agent harnesses through a
single AI SDK surface. A harness is a complete agent runtime, such as Claude
Code, Codex, or Pi. It owns capabilities that are larger than a model call:
workspace access, built-in coding tools, native session state, compaction,
permission flows, and runtime-specific configuration. Additionally, all AI SDK
agent harnesses operate in a sandbox, keeping the host environment safe.

The AI SDK harness abstraction is separate from the provider/model abstraction.
Providers expose models to AI SDK Core functions such as `generateText` and
`streamText`. Harnesses expose agent runtimes to `HarnessAgent`.

Using a harness does not mean giving up customization. `HarnessAgent` lets you
provide your own instructions, skills, AI SDK tools, permission settings,
sandbox setup hooks, and adapter-specific configuration while preserving the
runtime behavior that makes each harness powerful.

The two abstractions are decoupled, but they use compatible primitives where
possible. Harness output is projected into AI SDK stream and response types, so
surfaces that consume AI SDK model streams can also consume harness streams. For
example, you can pass a `HarnessAgent` stream to `toUIMessageStream` and render
it with `useChat`. The API is designed to feel familiar to AI SDK users, but
harness runtimes have different concepts from lower-level language models.
Configuration follows AI SDK patterns where they fit and diverges where the
harness runtime has different behavior.

<Note>
  Harness packages are **experimental**. Expect breaking changes between
  releases as this early API gets further refined.
</Note>

## When to Use a Harness

Use a harness when you want an existing agent runtime to drive the task:

- Coding agents that can inspect and modify a sandboxed workspace.
- Agent runtimes with their own built-in tools and permission model.
- Multi-turn sessions where the runtime owns conversation history.
- Workflows that should preserve native harness behavior instead of re-creating
  it with a tool loop.

Use providers and models when you want direct control over the model call, the
tool loop, model settings, structured output, or a custom agent architecture.

## Core Concepts

Harnesses have four primary pieces:

- `HarnessAgent`: the AI SDK agent implementation you use in application code.
- Harness adapter: the package that connects to a runtime, such as
  `@ai-sdk/harness-claude-code`.
- Sandbox provider: the isolated filesystem and process environment where the
  harness runs.
- Session: the live conversation and workspace state for a harness run.

## Compatible Streams

`HarnessAgent.generate()` returns an AI SDK `GenerateTextResult`.
`HarnessAgent.stream()` returns an AI SDK `StreamTextResult`.

That means you can consume familiar fields:

- `result.text`
- `result.stream`
- `result.steps`
- `result.usage`
- `result.responseMessages`

Harness-specific events are translated into compatible stream parts. Text,
reasoning, tool calls, tool results, usage, and finish reasons use the same AI
SDK shapes where possible. Events without a first-class AI SDK part, such as
workspace file changes and compaction, are surfaced as dynamic
provider-executed tool parts.

## Sessions Matter

Unlike a language model call, a harness session owns state. The session carries
the harness runtime, sandbox, working directory, native conversation history,
and pending approvals.

Create a session before running turns:

```ts
const session = await agent.createSession();

try {
  const result = await agent.generate({
    session,
    prompt: 'Inspect the repository and summarize the test setup.',
  });

  console.log(result.text);
} finally {
  await session.destroy();
}
```

For server routes, use a stable `sessionId` and persist the resume state
returned by `session.detach()` or `session.stop()`.

## Next Steps

- [HarnessAgent](/docs/ai-sdk-harnesses/harness-agent) for the main API.
- [Skills](/docs/ai-sdk-harnesses/skills) for reusable instruction bundles.
- [Harness adapters](/docs/ai-sdk-harnesses/harness-adapters) for the implemented
  runtimes.
- [Workflow utilities](/docs/ai-sdk-harnesses/workflow-utilities) for durable
  long-running turns.
- [UI](/docs/ai-sdk-harnesses/ui) for `useChat` routes.
- [Terminal UI](/docs/ai-sdk-harnesses/terminal-ui) for `@ai-sdk/tui`.
