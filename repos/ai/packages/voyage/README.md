# AI SDK - Voyage AI Provider

The **[Voyage AI provider](https://ai-sdk.dev/providers/ai-sdk-providers/voyage)** for the [AI SDK](https://ai-sdk.dev/docs) contains embedding and reranking model support for the [Voyage AI](https://voyageai.com/) APIs.

## Setup

The Voyage AI provider is available in the `@ai-sdk/voyage` module. You can install it with

```bash
npm i @ai-sdk/voyage
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `voyage` from `@ai-sdk/voyage`:

```ts
import { voyage } from '@ai-sdk/voyage';
```

## Example

```ts
import { voyage } from '@ai-sdk/voyage';
import { embedMany } from 'ai';

const { embeddings } = await embedMany({
  model: voyage.textEmbedding('voyage-3'),
  values: [
    'Sunny days are great for hiking',
    'Machine learning is a subset of AI',
  ],
});
```

## Documentation

Please check out the **[Voyage AI provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/voyage)** for more information.
