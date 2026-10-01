# AI SDK DevTools

A local development tool for debugging and inspecting AI SDK applications. View LLM requests, responses, tool calls, and multi-step interactions in a web-based UI.

> **Note**: This package is experimental and intended for local development only. Do not use in production environments.

## Installation

```bash
npm install @ai-sdk/devtools
# or
pnpm add @ai-sdk/devtools
```

## Requirements

- AI SDK v7 canary (`ai@canary`)
- Node.js compatible runtime

## Usage

### 1. Register the telemetry integration

Register `DevToolsTelemetry` globally so it captures all AI SDK calls:

```typescript
import { registerTelemetry } from 'ai';
import { DevToolsTelemetry } from '@ai-sdk/devtools';

registerTelemetry(DevToolsTelemetry());
```

Telemetry is enabled automatically once an integration is registered:

```typescript
import { generateText } from 'ai';

const result = await generateText({
  model: yourModel,
  prompt: 'What cities are in the United States?',
});
```

You can also pass the integration to individual calls instead of registering it
globally:

```typescript
import { streamText } from 'ai';
import { DevToolsTelemetry } from '@ai-sdk/devtools';

const result = streamText({
  model: yourModel,
  prompt: 'Hello!',
  telemetry: {
    integrations: [DevToolsTelemetry()],
  },
});
```

### 2. Run the viewer

```bash
npx @ai-sdk/devtools@latest
```

Open http://localhost:4983 to view your AI SDK interactions.

If you are using a monorepo, start DevTools from the same workspace where your
AI SDK code runs. The explicit `@latest` tag ensures that `npx` installs an
executable copy instead of selecting a transitive dependency whose binary is
not linked into that workspace.

## How it works

The `DevToolsTelemetry` integration hooks into the AI SDK telemetry lifecycle to
capture `generateText`, `streamText`, `generateObject`, and `streamObject` calls.
It captures:

- Input parameters and prompts
- Output content and tool calls
- Token usage and timing
- Raw provider data

Data is stored locally in a JSON file (`.devtools/generations.json`) and served through a web UI.

### Data flow

```
AI SDK call -> DevToolsTelemetry -> JSON file -> Hono API -> React UI
```

### Key concepts

- **Run**: A complete multi-step AI interaction, grouped by initial prompt
- **Step**: A single LLM call within a run

## Development

```bash
pnpm install
pnpm dev        # Start dev server at http://localhost:5173
```

## License

MIT
