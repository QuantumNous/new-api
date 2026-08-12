# AI SDK - Moonshot AI Provider

The **[Moonshot AI provider](https://ai-sdk.dev/providers/ai-sdk-providers/moonshotai)** for the [AI SDK](https://ai-sdk.dev/docs) contains language model support for the [Moonshot AI](https://platform.moonshot.cn) platform, including the Kimi model series.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Moonshot AI (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Moonshot AI provider is available in the `@ai-sdk/moonshotai` module. You can install it with

```bash
npm i @ai-sdk/moonshotai
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `moonshotai` from `@ai-sdk/moonshotai`:

```ts
import { moonshotai } from '@ai-sdk/moonshotai';
```

## Language Model Example

```ts
import { moonshotai } from '@ai-sdk/moonshotai';
import { generateText } from 'ai';

const { text } = await generateText({
  model: moonshotai('kimi-k2.5'),
  prompt: 'Write a JavaScript function that sorts a list:',
});
```

## Thinking Mode Example (Kimi K2 Thinking)

```ts
import { moonshotai } from '@ai-sdk/moonshotai';
import { generateText } from 'ai';

const { text } = await generateText({
  model: moonshotai('kimi-k2-thinking'),
  prompt: 'Solve this problem step by step: What is 15% of 240?',
  moonshotai: {
    thinking: {
      type: 'enabled',
      budgetTokens: 2048,
    },
    reasoningHistory: 'interleaved',
  },
});
```

## Documentation

Please check out the **[Moonshot AI provider](https://ai-sdk.dev/providers/ai-sdk-providers/moonshotai)** for more information.
