---
title: Writing a Custom Provider
description: Create a custom provider package for an OpenAI-compatible provider leveraging the AI SDK OpenAI Compatible package.
---

# Writing a Custom Provider

You can create your own provider package that leverages the AI SDK's [OpenAI Compatible package](https://www.npmjs.com/package/@ai-sdk/openai-compatible). Publishing your provider package to [npm](https://www.npmjs.com/) can give users an easy way to use the provider's models and stay up to date with any changes you may have. Here's an example structure:

### File Structure

```bash
packages/example/
├── src/
│   ├── example-chat-settings.ts       # Chat model types and settings
│   ├── example-completion-settings.ts # Completion model types and settings
│   ├── example-embedding-settings.ts  # Embedding model types and settings
│   ├── example-image-settings.ts      # Image model types and settings
│   ├── example-provider.ts            # Main provider implementation
│   ├── example-provider.test.ts       # Provider tests
│   └── index.ts                       # Public exports
├── package.json
├── tsconfig.json
├── tsup.config.ts                     # Build configuration
└── README.md
```

### Key Files

1. **example-chat-settings.ts** - Define chat model IDs and settings:

```ts
export type ExampleChatModelId =
  | 'example/chat-model-1'
  | 'example/chat-model-2'
  | (string & {});
```

The completion, embedding, and image settings are implemented similarly to the chat settings.

2. **example-provider.ts** - Main provider implementation:

```ts
import { LanguageModelV4, EmbeddingModelV4 } from '@ai-sdk/provider';
import {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel,
  OpenAICompatibleImageModel,
} from '@ai-sdk/openai-compatible';
import {
  FetchFunction,
  loadApiKey,
  withoutTrailingSlash,
} from '@ai-sdk/provider-utils';
// Import your model id and settings here.

export interface ExampleProviderSettings {
  /**
Example API key.
*/
  apiKey?: string;
  /**
Base URL for the API calls.
*/
  baseURL?: string;
  /**
Custom headers to include in the requests.
*/
  headers?: Record<string, string>;
  /**
Optional custom url query parameters to include in request urls.
*/
  queryParams?: Record<string, string>;
  /**
Custom fetch implementation. You can use it as a middleware to intercept requests,
or to provide a custom fetch implementation for e.g. testing.
*/
  fetch?: FetchFunction;
}

export interface ExampleProvider {
  /**
Creates a model for text generation.
*/
  (
    modelId: ExampleChatModelId,
    settings?: ExampleChatSettings,
  ): LanguageModelV4;

  /**
Creates a chat model for text generation.
*/
  chatModel(
    modelId: ExampleChatModelId,
    settings?: ExampleChatSettings,
  ): LanguageModelV4;

  /**
Creates a completion model for text generation.
*/
  completionModel(
    modelId: ExampleCompletionModelId,
    settings?: ExampleCompletionSettings,
  ): LanguageModelV4;

  /**
Creates a text embedding model for text generation.
*/
  .embeddingModel(
    modelId: ExampleEmbeddingModelId,
    settings?: ExampleEmbeddingSettings,
  ): EmbeddingModelV4<string>;

  /**
Creates an image model for image generation.
*/
  imageModel(
    modelId: ExampleImageModelId,
    settings?: ExampleImageSettings,
  ): ImageModelV4;
}

export function createExample(
  options: ExampleProviderSettings = {},
): ExampleProvider {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? 'https://api.example.com/v1',
  );
  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'EXAMPLE_API_KEY',
      description: 'Example API key',
    })}`,
    ...options.headers,
  });

  interface CommonModelConfig {
    provider: string;
    url: ({ path }: { path: string }) => string;
    headers: () => Record<string, string>;
    fetch?: FetchFunction;
  }

  const getCommonModelConfig = (modelType: string): CommonModelConfig => ({
    provider: `example.${modelType}`,
    url: ({ path }) => {
      const url = new URL(`${baseURL}${path}`);
      if (options.queryParams) {
        url.search = new URLSearchParams(options.queryParams).toString();
      }
      return url.toString();
    },
    headers: getHeaders,
    fetch: options.fetch,
  });

  const createChatModel = (
    modelId: ExampleChatModelId,
    settings: ExampleChatSettings = {},
  ) => {
    return new OpenAICompatibleChatLanguageModel(
      modelId,
      settings,
      getCommonModelConfig('chat'),
    );
  };

  const createCompletionModel = (
    modelId: ExampleCompletionModelId,
    settings: ExampleCompletionSettings = {},
  ) =>
    new OpenAICompatibleCompletionLanguageModel(
      modelId,
      settings,
      getCommonModelConfig('completion'),
    );

  const create.embeddingModel = (
    modelId: ExampleEmbeddingModelId,
    settings: ExampleEmbeddingSettings = {},
  ) =>
    new OpenAICompatibleEmbeddingModel(
      modelId,
      settings,
      getCommonModelConfig('embedding'),
    );

  const createImageModel = (
    modelId: ExampleImageModelId,
    settings: ExampleImageSettings = {},
  ) =>
    new OpenAICompatibleImageModel(
      modelId,
      settings,
      getCommonModelConfig('image'),
    );

  const provider = (
    modelId: ExampleChatModelId,
    settings?: ExampleChatSettings,
  ) => createChatModel(modelId, settings);

  provider.completionModel = createCompletionModel;
  provider.chatModel = createChatModel;
  provider.embeddingModel = create.embeddingModel;
  provider.imageModel = createImageModel;

  return provider;
}

// Export default instance
export const example = createExample();
```

3. **index.ts** - Public exports:

```ts
export { createExample, example } from './example-provider';
export type {
  ExampleProvider,
  ExampleProviderSettings,
} from './example-provider';
```

4. **package.json** - Package configuration:

```js
{
  "name": "@company-name/example",
  "version": "0.0.1",
  "dependencies": {
    "@ai-sdk/openai-compatible": "^0.0.7",
    "@ai-sdk/provider": "^1.0.2",
    "@ai-sdk/provider-utils": "^2.0.4",
    // ...additional dependencies
  },
  // ...additional scripts and module build configuration
}
```

### Usage

Once published, users can use your provider like this:

```ts
import { example } from '@company-name/example';
import { generateText } from 'ai';

const { text } = await generateText({
  model: example('example/chat-model-1'),
  prompt: 'Hello, how are you?',
});
```

This structure provides a clean, type-safe implementation that leverages the OpenAI Compatible package while maintaining consistency with the usage of other AI SDK providers.

### Internal API

As you work on your provider you may need to use some of the internal API of the OpenAI Compatible package. You can import these from the `@ai-sdk/openai-compatible/internal` package, for example:

```ts
import { convertToOpenAICompatibleChatMessages } from '@ai-sdk/openai-compatible/internal';
```

You can see the latest available exports in the AI SDK [GitHub repository](https://github.com/vercel/ai/blob/main/packages/openai-compatible/src/internal/index.ts).
