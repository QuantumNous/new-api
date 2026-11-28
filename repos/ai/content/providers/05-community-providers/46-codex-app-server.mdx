---
title: Codex CLI (App Server)
description: Learn how to use the Codex CLI App Server provider for mid-execution message injection and persistent threads.
---

# Codex CLI (App Server) Provider

The [ai-sdk-provider-codex-app-server](https://github.com/pablof7z/ai-sdk-provider-codex-app-server) community provider enables using OpenAI's GPT-5 series models through the [Codex CLI](https://github.com/openai/codex) app-server mode. Unlike the standard Codex CLI provider, it supports **mid-execution message injection** and **persistent threads**.

## Key Features

- **Mid-execution injection**: Send additional instructions while the agent is working
- **Persistent threads**: Maintain conversation context across multiple calls
- **Session control**: Interrupt running turns, inject messages at checkpoints
- **Tool streaming**: Real-time visibility into command executions and file changes

## Version Compatibility

| Provider Version | AI SDK Version | Status |
| ---------------- | -------------- | ------ |
| 1.x              | v6             | Stable |

## Setup

<InstallPackages packages="ai-sdk-provider-codex-app-server" />

## Provider Instance

Import the default provider instance:

```ts
import {
  createCodexAppServer,
  type Session,
} from 'ai-sdk-provider-codex-app-server';

let session: Session;

const provider = createCodexAppServer({
  defaultSettings: {
    onSessionCreated: s => {
      session = s;
    },
  },
});
```

## Mid-Execution Injection

The killer feature of this provider is the ability to inject messages while the agent is actively working:

```ts
import {
  createCodexAppServer,
  type Session,
} from 'ai-sdk-provider-codex-app-server';
import { streamText } from 'ai';

let session: Session;

const provider = createCodexAppServer({
  defaultSettings: {
    onSessionCreated: s => {
      session = s;
    },
  },
});

const model = provider('gpt-5.1-codex-max');

// Start streaming
const resultPromise = streamText({
  model,
  prompt: 'Write a calculator in Python',
});

// Inject additional instructions mid-execution
setTimeout(async () => {
  await session.injectMessage('Also add a square root function');
}, 2000);

const result = await resultPromise;
console.log(await result.text);
```

## Session API

The session object provides control over active turns:

```ts
interface Session {
  readonly threadId: string;
  readonly turnId: string | null;

  // Inject a message mid-execution
  injectMessage(content: string | UserInput[]): Promise<void>;

  // Interrupt the current turn
  interrupt(): Promise<void>;

  // Check if a turn is active
  isActive(): boolean;
}
```

## Model Discovery

Discover available models and their capabilities:

```ts
import { listModels } from 'ai-sdk-provider-codex-app-server';

const { models, defaultModel } = await listModels();

for (const model of models) {
  console.log(`${model.id}: ${model.description}`);
  const efforts = model.supportedReasoningEfforts.map(e => e.reasoningEffort);
  console.log(`  Reasoning: ${efforts.join(', ')}`);
}
```

## Settings

```ts
interface CodexAppServerSettings {
  codexPath?: string; // Path to codex binary
  cwd?: string; // Working directory
  approvalMode?: 'never' | 'on-request' | 'on-failure' | 'untrusted';
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  threadMode?: 'persistent' | 'stateless';
  mcpServers?: Record<string, McpServerConfig>;
  verbose?: boolean;
  logger?: Logger | false;
  onSessionCreated?: (session: Session) => void;
  env?: Record<string, string>;
  baseInstructions?: string;
  resume?: string; // Thread ID to resume
}
```

## Thread Modes

- **persistent** (default): Reuses the same thread across calls, maintaining context
- **stateless**: Creates a fresh thread for each call

```ts
const model = provider('gpt-5.1-codex-max', {
  threadMode: 'stateless', // Fresh thread each call
});
```

## Per-Call Overrides

Override settings per call using `providerOptions`:

```ts
const result = await streamText({
  model,
  prompt: 'Analyze this code',
  providerOptions: {
    'codex-app-server': {
      reasoningEffort: 'high',
      threadMode: 'stateless',
    },
  },
});
```

## Model Capabilities

| Model                | Image Input | Object Generation | Tool Streaming | Mid-Execution |
| -------------------- | ----------- | ----------------- | -------------- | ------------- |
| `gpt-5.3-codex`      | <Check />   | <Check />         | <Check />      | <Check />     |
| `gpt-5.2-codex`      | <Check />   | <Check />         | <Check />      | <Check />     |
| `gpt-5.1-codex-max`  | <Check />   | <Check />         | <Check />      | <Check />     |
| `gpt-5.1-codex-mini` | <Check />   | <Check />         | <Check />      | <Check />     |

## Comparison with Codex CLI Provider

| Feature              | Codex CLI Provider | Codex App Server |
| -------------------- | ------------------ | ---------------- |
| Mid-execution inject | <Cross />          | <Check />        |
| Persistent threads   | <Cross />          | <Check />        |
| Session control      | <Cross />          | <Check />        |
| Tool streaming       | <Cross />          | <Check />        |
| One-shot execution   | <Check />          | <Check />        |

Use the **Codex CLI provider** for simple one-shot tasks. Use the **Codex App Server provider** when you need human-in-the-loop workflows, real-time course correction, or collaborative coding.

## Requirements

- Node.js 22 or higher
- Codex CLI installed globally (v0.60.0+ recommended)
- ChatGPT Plus/Pro subscription or OpenAI API key

For more details, see the [provider documentation](https://github.com/pablof7z/ai-sdk-provider-codex-app-server).
