# AI SDK - DeepSeek Provider

The **[DeepSeek provider](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek)** for the [AI SDK](https://ai-sdk.dev/docs) contains language model support for the [DeepSeek](https://www.deepseek.com) platform.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access DeepSeek (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The DeepSeek provider is available in the `@ai-sdk/deepseek` module. You can install it with

```bash
npm i @ai-sdk/deepseek
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `deepseek` from `@ai-sdk/deepseek`:

```ts
import { deepseek } from '@ai-sdk/deepseek';
```

## Example

```ts
import { deepseek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';

const { text } = await generateText({
  model: deepseek('deepseek-chat'),
  prompt: 'Write a JavaScript function that sorts a list:',
});
```

## Documentation

Please check out the **[DeepSeek provider](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek)** for more information.
