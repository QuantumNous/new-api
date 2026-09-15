# AI SDK - Cartesia Provider

The **[Cartesia provider](https://ai-sdk.dev/providers/ai-sdk-providers/cartesia)** for the [AI SDK](https://ai-sdk.dev/docs)
contains Sonic 3.5 speech generation, Ink-Whisper batch transcription, and Ink 2 realtime and streaming transcription support.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Cartesia (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Cartesia provider is available in the `@ai-sdk/cartesia` module. You can install it with

```bash
npm i @ai-sdk/cartesia
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `cartesia` from `@ai-sdk/cartesia`:

```ts
import { cartesia } from '@ai-sdk/cartesia';
```

## Example

```ts
import { cartesia } from '@ai-sdk/cartesia';
import { generateSpeech } from 'ai';

const { audio } = await generateSpeech({
  model: cartesia.speech('sonic-3.5'),
  text: 'Hello from the Vercel AI SDK!',
  voice: 'a0e99841-438c-4a64-b679-ae501e7d6091',
});
```

## Documentation

Please check out the **[Cartesia provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/cartesia)** for more information.
