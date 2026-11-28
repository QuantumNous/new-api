# AI SDK - Google Vertex AI Provider

The **[Google Vertex provider](https://ai-sdk.dev/providers/ai-sdk-providers/google-vertex)** for the [AI SDK](https://ai-sdk.dev/docs) contains language model support for the [Google Vertex AI](https://cloud.google.com/vertex-ai) APIs.

This library includes a Google Vertex Anthropic provider and a Google Vertex MaaS provider. These providers closely follow the core Google Vertex library's usage patterns. See more in the [Google Vertex Anthropic Provider](#google-vertex-anthropic-provider) and [Google Vertex MaaS Provider](#google-vertex-maas-provider) sections below.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Google Vertex AI (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Google Vertex provider is available in the `@ai-sdk/google-vertex` module. You can install it with

```bash
npm i @ai-sdk/google-vertex
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Google Vertex Provider

The Google Vertex provider has two different authentication implementations depending on your runtime environment:

### Node.js Runtime

The Node.js runtime is the default runtime supported by the AI SDK. You can use the default provider instance to generate text with the `gemini-2.5-flash` model like this:

```ts
import { vertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';

const { text } = await generateText({
  model: vertex('gemini-2.5-flash'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

This provider supports all standard Google Cloud authentication options through the [`google-auth-library`](https://github.com/googleapis/google-auth-library-nodejs?tab=readme-ov-file#ways-to-authenticate). The most common authentication method is to set the path to a json credentials file in the `GOOGLE_APPLICATION_CREDENTIALS` environment variable. Credentials can be obtained from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

### Edge Runtime

The Edge runtime is supported through the `@ai-sdk/google-vertex/edge` module. Note the additional sub-module path `/edge` required to differentiate the Edge provider from the Node.js provider.

You can use the default provider instance to generate text with the `gemini-2.5-flash` model like this:

```ts
import { vertex } from '@ai-sdk/google-vertex/edge';
import { generateText } from 'ai';

const { text } = await generateText({
  model: vertex('gemini-2.5-flash'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

This method supports Google's [Application Default Credentials](https://github.com/googleapis/google-auth-library-nodejs?tab=readme-ov-file#application-default-credentials) through the environment variables `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and (optionally) `GOOGLE_PRIVATE_KEY_ID`. The values can be obtained from a json credentials file obtained from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

## Google Vertex Anthropic Provider

The Google Vertex Anthropic provider is available for both Node.js and Edge runtimes. It follows a similar usage pattern to the [core Google Vertex provider](#google-vertex-provider).

### Node.js Runtime

```ts
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { generateText } from 'ai';

const { text } = await generateText({
  model: vertexAnthropic('claude-3-5-sonnet@20240620'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

### Edge Runtime

```ts
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic/edge';
import { generateText } from 'ai';

const { text } = await generateText({
  model: vertexAnthropic('claude-3-5-sonnet@20240620'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

## Prompt Caching Support for Anthropic Claude Models

The Google Vertex Anthropic provider supports prompt caching for Anthropic Claude models. Prompt caching can help reduce latency and costs by reusing cached results for identical requests. Caches are unique to Google Cloud projects and have a five-minute lifetime.

### Enabling Prompt Caching

To enable prompt caching, you can use the `cacheControl` property in the settings. Here is an example demonstrating how to enable prompt caching:

```ts
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { generateText } from 'ai';
import fs from 'node:fs';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

async function main() {
  const result = await generateText({
    model: vertexAnthropic('claude-3-5-sonnet-v2@20241022', {
      cacheControl: true,
    }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'You are a JavaScript expert.',
          },
          {
            type: 'text',
            text: `Error message: ${errorMessage}`,
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
          {
            type: 'text',
            text: 'Explain the error message.',
          },
        ],
      },
    ],
  });

  console.log(result.text);
  console.log(result.providerMetadata?.anthropic);
}

main().catch(console.error);
```

## Custom Provider Configuration

You can create a custom provider instance using the `createVertex` function. This allows you to specify additional configuration options. Below is an example with the default Node.js provider which includes a `googleAuthOptions` object.

```ts
import { createVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';

const customProvider = createVertex({
  project: 'your-project-id',
  location: 'us-central1',
  googleAuthOptions: {
    credentials: {
      client_email: 'your-client-email',
      private_key: 'your-private-key',
    },
  },
});

const { text } = await generateText({
  model: customProvider('gemini-2.5-flash'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

The `googleAuthOptions` object is not present in the Edge provider options but custom provider creation is otherwise identical.

The Edge provider supports a `googleCredentials` option rather than `googleAuthOptions`. This can be used to specify the Google Cloud service account credentials and will take precedence over the environment variables used otherwise.

```ts
import { createVertex } from '@ai-sdk/google-vertex/edge';
import { generateText } from 'ai';

const customProvider = createVertex({
  project: 'your-project-id',
  location: 'us-central1',
  googleCredentials: {
    clientEmail: 'your-client-email',
    privateKey: 'your-private-key',
  },
});

const { text } = await generateText({
  model: customProvider('gemini-2.5-flash'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

### Google Vertex Anthropic Provider Custom Configuration

The Google Vertex Anthropic provider custom configuration is analogous to the above:

```ts
import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { generateText } from 'ai';

const customProvider = createVertexAnthropic({
  project: 'your-project-id',
  location: 'us-east5',
});

const { text } = await generateText({
  model: customProvider('claude-3-5-sonnet@20240620'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

And for the Edge runtime:

```ts
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic/edge';
import { generateText } from 'ai';

const customProvider = createVertexAnthropic({
  project: 'your-project-id',
  location: 'us-east5',
});

const { text } = await generateText({
  model: customProvider('claude-3-5-sonnet@20240620'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

## Google Vertex MaaS Provider

The Google Vertex MaaS (Model as a Service) provider offers access to partner and open models hosted on Vertex AI through an OpenAI-compatible Chat Completions API. It is available for both Node.js and Edge runtimes.

### Node.js Runtime

```ts
import { vertexMaas } from '@ai-sdk/google-vertex/maas';
import { generateText } from 'ai';

const { text } = await generateText({
  model: vertexMaas('deepseek-ai/deepseek-v3.2-maas'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

### Edge Runtime

```ts
import { vertexMaas } from '@ai-sdk/google-vertex/maas/edge';
import { generateText } from 'ai';

const { text } = await generateText({
  model: vertexMaas('deepseek-ai/deepseek-v3.2-maas'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

### Google Vertex MaaS Provider Custom Configuration

```ts
import { createVertexMaas } from '@ai-sdk/google-vertex/maas';
import { generateText } from 'ai';

const customProvider = createVertexMaas({
  project: 'your-project-id',
  location: 'us-east5',
});

const { text } = await generateText({
  model: customProvider('deepseek-ai/deepseek-v3.2-maas'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

And for the Edge runtime:

```ts
import { createVertexMaas } from '@ai-sdk/google-vertex/maas/edge';
import { generateText } from 'ai';

const customProvider = createVertexMaas({
  project: 'your-project-id',
  location: 'us-east5',
});

const { text } = await generateText({
  model: customProvider('deepseek-ai/deepseek-v3.2-maas'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

## Documentation

Please check out the **[Google Vertex provider](https://ai-sdk.dev/providers/ai-sdk-providers/google-vertex)** for more information.
