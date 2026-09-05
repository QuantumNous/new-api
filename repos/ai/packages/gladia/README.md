# AI SDK - Gladia Provider

The **[Gladia provider](https://ai-sdk.dev/providers/ai-sdk-providers/assemblyai)** for the [AI SDK](https://ai-sdk.dev/docs)
contains transcription model support for the Gladia transcription API.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Gladia (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Gladia provider is available in the `@ai-sdk/gladia` module. You can install it with

```bash
npm i @ai-sdk/gladia
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `gladia` from `@ai-sdk/gladia`:

```ts
import { gladia } from '@ai-sdk/gladia';
```

## Example

```ts
import { gladia } from '@ai-sdk/gladia';
import { transcribe } from 'ai';

const { text } = await transcribe({
  model: gladia.transcription(),
  audio: new URL(
    'https://github.com/vercel/ai/raw/refs/heads/main/examples/ai-functions/data/galileo.mp3',
  ),
});
```

## Documentation

Please check out the **[Gladia provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/gladia)** for more information.
