# AI SDK - Rev.ai Provider

The **[Rev.ai provider](https://ai-sdk.dev/providers/ai-sdk-providers/revai)** for the [AI SDK](https://ai-sdk.dev/docs)
contains language model support for the Rev.ai transcription API.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Rev.ai (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Rev.ai provider is available in the `@ai-sdk/revai` module. You can install it with

```bash
npm i @ai-sdk/revai
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `revai` from `@ai-sdk/revai`:

```ts
import { revai } from '@ai-sdk/revai';
```

## Example

```ts
import { revai } from '@ai-sdk/revai';
import { transcribe } from 'ai';

const { text } = await transcribe({
  model: revai.transcription('machine'),
  audio: new URL(
    'https://github.com/vercel/ai/raw/refs/heads/main/examples/ai-functions/data/galileo.mp3',
  ),
});
```

## Documentation

Please check out the **[Rev.ai provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/revai)** for more information.
