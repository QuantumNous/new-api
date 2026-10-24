# File Uploads Architecture

This document explains how file uploads and provider references work in the AI SDK, covering the spec, the top-level API, provider implementations, and how provider references flow through messages.

## High-Level Architecture

- **AI function**: `uploadFile` — user-facing function that uploads a file via a provider's files interface
- **Spec**: `FilesV4` — interface that providers implement to support file uploads
- **Provider reference**: `SharedV4ProviderReference` (`Record<string, string>`) — maps provider names to provider-specific file identifiers

## Key Types

### `SharedV4ProviderReference`

Defined in [`packages/provider/src/shared/v4/shared-v4-provider-reference.ts`](../packages/provider/src/shared/v4/shared-v4-provider-reference.ts).

```ts
type SharedV4ProviderReference = Record<string, string>;
// Example: { openai: 'file-abc123', anthropic: 'file-xyz789' }
```

A mapping of provider names to provider-specific file identifiers. This allows the same logical file to be referenced across different providers without re-uploading.

### `FilesV4`

Defined in [`packages/provider/src/files/v4/files-v4.ts`](../packages/provider/src/files/v4/files-v4.ts).

```ts
type FilesV4 = {
  readonly specificationVersion: 'v4';
  readonly provider: string;
  uploadFile(options: {
    data: Uint8Array | string;
    mediaType?: string;
    filename?: string;
    providerOptions?: SharedV4ProviderOptions;
  }): PromiseLike<FilesV4UploadFileResult>;
};
```

The `uploadFile` method receives raw file data (not URLs) and returns a `FilesV4UploadFileResult` containing:

- `providerReference`: A `SharedV4ProviderReference` with the provider's file ID
- `providerMetadata`: Optional provider-specific metadata
- `warnings`: Any warnings from the provider

### `LanguageModelV4FilePart.data`

The `data` field on file parts in the prompt accepts `LanguageModelV4DataContent | SharedV4ProviderReference`. This is how uploaded files are referenced in messages — instead of passing inline bytes, you pass the provider reference returned from `uploadFile`.

## Implementing File Uploads in a Provider

### 1. Create the files interface

Create a files implementation that implements `FilesV4`. The implementation should:

- Call the provider's file upload API
- Return a `providerReference` with `{ [providerName]: fileId }`

Example structure (see [`packages/openai/src/files/openai-files.ts`](../packages/openai/src/files/openai-files.ts)):

```ts
export function createMyProviderFiles(config: MyProviderFilesConfig): FilesV4 {
  return {
    specificationVersion: 'v4',
    provider: config.provider, // e.g. 'myprovider.files'

    async uploadFile({ data, mediaType, filename, providerOptions }) {
      // 1. Parse provider-specific options if needed
      // 2. Call the provider's upload API
      // 3. Return the result
      return {
        providerReference: {
          myprovider: response.fileId,
        },
        warnings: [],
      };
    },
  };
}
```

### 2. Expose `files()` on the provider

Add a `files()` factory method to the provider that creates the files interface:

```ts
const provider = {
  // ... existing model factories
  files: () =>
    createMyProviderFiles({
      provider: 'myprovider.files',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    }),
};
```

### 3. Handle provider references in message conversion

In the message conversion code (e.g. `convert-to-myprovider-messages.ts`), check for provider references in file parts and resolve them using `resolveProviderReference` from `@ai-sdk/provider-utils`:

```ts
import { isProviderReference, resolveProviderReference } from '@ai-sdk/provider-utils';

// Inside the file part handling:
case 'file': {
  if (isProviderReference(part.data)) {
    const fileId = resolveProviderReference({
      reference: part.data,
      provider: 'myprovider',
    });
    // Use fileId in the provider-specific message format
    return { type: 'file', file: { file_id: fileId } };
  }

  // Handle URL and inline data as before...
}
```

`resolveProviderReference` (defined in [`packages/provider-utils/src/resolve-provider-reference.ts`](../packages/provider-utils/src/resolve-provider-reference.ts)) looks up the provider name in the reference and throws a descriptive error if no entry exists.

### Providers without file upload support

Providers that don't support file uploads should add a guard at the top of their `case 'file':` block to throw `UnsupportedFunctionalityError` when a provider reference is encountered:

```ts
import { isProviderReference } from '@ai-sdk/provider-utils';

case 'file': {
  if (isProviderReference(part.data)) {
    throw new UnsupportedFunctionalityError({
      functionality: 'file parts with provider references',
    });
  }
  // ... existing file handling code
}
```

This ensures TypeScript correctly narrows the type of `part.data` for subsequent code, and gives users a clear error message.

## Existing Implementations

| Provider  | Files implementation                                                                        | Message conversion                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI    | [`packages/openai/src/files/openai-files.ts`](../packages/openai/src/files/openai-files.ts) | [`packages/openai/src/chat/convert-to-openai-chat-messages.ts`](../packages/openai/src/chat/convert-to-openai-chat-messages.ts)       |
| Anthropic | [`packages/anthropic/src/anthropic-files.ts`](../packages/anthropic/src/anthropic-files.ts) | [`packages/anthropic/src/convert-to-anthropic-messages-prompt.ts`](../packages/anthropic/src/convert-to-anthropic-messages-prompt.ts) |
| Google    | [`packages/google/src/google-files.ts`](../packages/google/src/google-files.ts)             | [`packages/google/src/convert-to-google-messages.ts`](../packages/google/src/convert-to-google-messages.ts)                           |
| xAI       | [`packages/xai/src/files/xai-files.ts`](../packages/xai/src/files/xai-files.ts)             | [`packages/xai/src/convert-to-xai-chat-messages.ts`](../packages/xai/src/convert-to-xai-chat-messages.ts)                             |
