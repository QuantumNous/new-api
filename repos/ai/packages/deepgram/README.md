# AI SDK - Deepgram Provider

The **[Deepgram provider](https://ai-sdk.dev/providers/ai-sdk-providers/deepgram)** for the [AI SDK](https://ai-sdk.dev/docs)
contains transcription model support for the Deepgram transcription API and speech model support for the Deepgram text-to-speech API.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Deepgram (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Deepgram provider is available in the `@ai-sdk/deepgram` module. You can install it with

```bash
npm i @ai-sdk/deepgram
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `deepgram` from `@ai-sdk/deepgram`:

```ts
import { deepgram } from '@ai-sdk/deepgram';
```

## Examples

### Transcription

```ts
import { deepgram } from '@ai-sdk/deepgram';
import { transcribe } from 'ai';

const { text } = await transcribe({
  model: deepgram.transcription('nova-3'),
  audio: new URL(
    'https://github.com/vercel/ai/raw/refs/heads/main/examples/ai-functions/data/galileo.mp3',
  ),
});
```

### Transcription with Language Detection

```ts
import { deepgram } from '@ai-sdk/deepgram';
import { transcribe } from 'ai';

const { text, language } = await transcribe({
  model: deepgram.transcription('nova-3'),
  audio: new URL(
    'https://github.com/vercel/ai/raw/refs/heads/main/examples/ai-functions/data/galileo.mp3',
  ),
  providerOptions: {
    deepgram: {
      detectLanguage: true,
    },
  },
});
```

### Text-to-Speech

```ts
import { deepgram } from '@ai-sdk/deepgram';
import { generateSpeech } from 'ai';

const { audio } = await generateSpeech({
  model: deepgram.speech('aura-2-helena-en'),
  text: 'Hello, welcome to Deepgram!',
});
```

## Documentation

Please check out the **[Deepgram provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/deepgram)** for more information.
