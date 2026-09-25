# AI SDK - Vercel Provider

The **[Vercel provider](https://ai-sdk.dev/providers/ai-sdk-providers/vercel)** for the [AI SDK](https://ai-sdk.dev/docs)
gives you access to the v0 API, designed for building modern web applications. The `v0-1.0-md` model supports text and image inputs, provides fast streaming responses, and is compatible with the OpenAI Chat Completions API format.

Key features include:

- Framework aware completions: Optimized for modern stacks like Next.js and Vercel
- Auto-fix: Identifies and corrects common coding issues during generation
- Quick edit: Streams inline edits as they're available
- Multimodal: Supports both text and image inputs

## Setup

The Vercel provider is available in the `@ai-sdk/vercel` module. You can install it with

```bash
npm i @ai-sdk/vercel
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `vercel` from `@ai-sdk/vercel`:

```ts
import { vercel } from '@ai-sdk/vercel';
```

## Example

```ts
import { vercel } from '@ai-sdk/vercel';
import { generateText } from 'ai';

const { text } = await generateText({
  model: vercel('v0-1.0-md'),
  prompt: 'Create a Next.js app',
});
```

## Documentation

Please check out the **[Vercel provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/vercel)** for more information.
