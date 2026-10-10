---
name: ai-sdk
description: 'Answer questions about the AI SDK and help build AI-powered features. Use when developers: (1) Ask about AI SDK functions like generateText, streamText, ToolLoopAgent, embed, or tools, (2) Want to build AI agents, chatbots, RAG systems, or text generation features, (3) Have questions about AI providers (OpenAI, Anthropic, Google, etc.), streaming, tool calling, structured output, or embeddings, (4) Use React hooks like useChat or useCompletion. Triggers on: "AI SDK", "Vercel AI SDK", "generateText", "streamText", "add AI to my app", "build an agent", "tool calling", "structured output", "useChat".'
---

## What the AI SDK Is

The AI SDK by Vercel (the `ai` package on npm) is a TypeScript toolkit for building AI applications. It provides a unified API across model providers for text generation, structured output, tool calling, agents, embeddings, and framework UI integrations.

- Repository: https://github.com/vercel/ai
- Documentation: https://ai-sdk.dev/docs

## Critical: Do Not Trust Your Own Memory

Whatever you remember about the AI SDK is likely outdated. The SDK changes frequently across versions - APIs are renamed, removed, and added. Your training data almost certainly contains obsolete APIs, deprecated patterns, and model IDs that no longer exist. UI hooks like `useChat` are among the most frequently changed APIs, so be especially careful with client code.

**Never write AI SDK code from memory.** Always verify every API, option, and pattern against the documentation and source code for the version that is actually installed in the project.

## Use the Bundled, Version-Matched Docs

The `ai` package ships its full documentation and source code inside `node_modules`. These always match the installed version, so trust them over anything you remember.

1. Ensure `ai` is installed. If `node_modules/ai/` does not exist, install **only** the `ai` package using the project's package manager (e.g. `pnpm add ai`). Install provider packages (e.g. `@ai-sdk/openai`) and framework packages (e.g. `@ai-sdk/react`) later, when the task requires them.
2. Read and grep the bundled docs at `node_modules/ai/docs/` and the source at `node_modules/ai/src/`.
3. Provider and framework packages bundle their own docs at `node_modules/@ai-sdk/<name>/docs/`.
4. If something isn't in the bundled docs, search https://ai-sdk.dev/docs. You can append `.md` to any docs page URL to get its markdown, and search via `https://ai-sdk.dev/api/search-docs?q=your_query`.
5. If you cannot find support for an answer in the docs or source, say so explicitly — do not guess.

## AI Gateway: The Fastest Way to Start

The Vercel AI Gateway is the fastest way to get started with the AI SDK. It provides access to models from OpenAI, Anthropic, Google, and other providers through a single API, without installing provider packages or managing multiple API keys.

To set it up:

1. Authenticate with OIDC (for Vercel deployments) or get an AI Gateway API key.
2. Provide it to your app via the `AI_GATEWAY_API_KEY` environment variable.
3. Reference models with `provider/model` strings.

For exact setup, authentication, and usage, read the bundled guide and the AI Gateway docs.

### Choosing a Model

Never use model IDs from memory — models are released and retired frequently. Fetch the current list before writing code that references a model. Do not truncate the list (e.g. with `head`) so you can find the newest models:

```bash
# All available models
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '.data[].id'

# Filter by provider (e.g. anthropic, openai, google)
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("anthropic/")) | .id] | reverse | .[]'
```

When multiple versions of a model exist, prefer the one with the highest version number.

## Building and Consuming Agents

Use the SDK's built-in agent abstraction (such as `ToolLoopAgent`) rather than hand-rolling tool-calling loops. For end-to-end type safety, infer the UI message type from your agent definition when consuming it on the client (e.g. with `useChat`). Consuming an agent is framework-specific: check `package.json` to detect the stack, then follow the matching quickstart.

Look up the current agent, tool, and type-safety APIs in the bundled docs (`node_modules/ai/docs/`, especially the agents section) or at https://ai-sdk.dev/docs.

## DevTools

AI SDK DevTools captures your AI SDK calls - requests, responses, tool calls, token usage, and multi-step runs - so you can inspect exactly what your agents do. Use it while developing to debug generations. It is a separate package and is intended for local development only.

For setup instructions, read the bundled DevTools documentation.

## Keep the SDK Current

Outdated installs are the most common source of errors. Compare the installed version against the latest:

- **Installed:** the `version` field in `node_modules/ai/package.json`.
- **Latest:** run `npm view ai version`.

If the installed version is a major version (or more) behind the latest, tell the user they are on an old release, and recommend upgrading before continuing. Migration guides are at https://ai-sdk.dev/docs/migration-guides.

## After Making Changes

Run the project's type checker. Be minimal — only set options that differ from the defaults, checking docs or source for the defaults rather than over-specifying. Most type errors come from remembered, now-changed APIs; re-check the current docs and source when they occur.
