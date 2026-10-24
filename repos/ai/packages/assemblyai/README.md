# AI SDK - AssemblyAI Provider

The **[AssemblyAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/assemblyai)** for the [AI SDK](https://ai-sdk.dev/docs)
contains transcription model support for the AssemblyAI transcription API.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access AssemblyAI (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The AssemblyAI provider is available in the `@ai-sdk/assemblyai` module. You can install it with

```bash
npm i @ai-sdk/assemblyai
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `assemblyai` from `@ai-sdk/assemblyai`:

```ts
import { assemblyai } from '@ai-sdk/assemblyai';
```

## Example

```ts
import { assemblyai } from '@ai-sdk/assemblyai';
import { transcribe } from 'ai';

const { text } = await transcribe({
  model: assemblyai.transcription('universal-3-5-pro'),
  audio: new URL(
    'https://github.com/vercel/ai/raw/refs/heads/main/examples/ai-functions/data/galileo.mp3',
  ),
});
```

## Documentation

Please check out the **[AssemblyAI provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/assemblyai)** for more information.
