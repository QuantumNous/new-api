---
name: add-provider-package
description: Guide for adding new AI provider packages to the AI SDK. Use when creating a new @ai-sdk/<provider> package to integrate an AI service into the SDK.
metadata:
  internal: true
---

## Adding a New Provider Package

This guide covers the process of creating a new `@ai-sdk/<provider>` package to integrate an AI service into the AI SDK.

## First-Party vs Third-Party Providers

- **Third-party packages**: Any provider can create a third-party package. We're happy to link to it from our documentation.
- **First-party `@ai-sdk/<provider>` packages**: If you prefer a first-party package, please create an issue first to discuss.

## Reference Example

See https://github.com/vercel/ai/pull/8136/files for a complete example of adding a new provider.

## Provider Architecture

The AI SDK uses a layered provider architecture following the adapter pattern:

1. **Specifications** (`@ai-sdk/provider`): Defines interfaces like `LanguageModelV4`, `EmbeddingModelV4`, etc.
2. **Utilities** (`@ai-sdk/provider-utils`): Shared code for implementing providers
3. **Providers** (`@ai-sdk/<provider>`): Concrete implementations for each AI service
4. **Core** (`ai`): High-level functions like `generateText`, `streamText`, `generateObject`

## Step-by-Step Guide

### 1. Create Package Structure

Create a new folder `packages/<provider>` with the following structure:

```
packages/<provider>/
├── src/
│   ├── index.ts                  # Main exports
│   ├── version.ts                # Package version
│   ├── <provider>-provider.ts    # Provider implementation
│   ├── <provider>-provider.test.ts
│   ├── <provider>-*-options.ts   # Model-specific options
│   └── <provider>-*-model.ts     # Model implementations (e.g., language, embedding, image)
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
├── turbo.json
├── vitest.node.config.js
├── vitest.edge.config.js
└── README.md
```

Do not create a `CHANGELOG.md` file. It will be auto-generated.

### 2. Configure package.json

Set up your `package.json` with:

- `"name": "@ai-sdk/<provider>"`
- `"version": "0.0.0"` (initial version, will be updated by changeset)
- `"type": "module"`
- `"license": "Apache-2.0"`
- `"sideEffects": false`
- Dependencies on `@ai-sdk/provider` and `@ai-sdk/provider-utils` (use `workspace:*`)
- Dev dependencies: `@ai-sdk/test-server`, `@types/node`, `@vercel/ai-tsconfig`, `tsup`, `typescript`, `zod`
- `"engines": { "node": ">=22" }`
- Peer dependency on `zod` (both v3 and v4): `"zod": "^3.25.76 || ^4.1.8"`

Example package entry point configuration:

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

### 3. Create TypeScript Configurations

**tsconfig.json**:

```json
{
  "extends": "@vercel/ai-tsconfig/base.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**tsconfig.build.json**:

```json
{
  "extends": "./tsconfig.json",
  "exclude": [
    "**/*.test.ts",
    "**/*.test-d.ts",
    "**/__snapshots__",
    "**/__fixtures__"
  ]
}
```

### 4. Configure Build Tool (tsup)

Create `tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

### 5. Configure Test Runners

Create both `vitest.node.config.js` and `vitest.edge.config.js` (copy from existing provider like `anthropic`).

### 6. Implement Provider

**Provider implementation pattern**:

```typescript
// <provider>-provider.ts
import { NoSuchModelError } from '@ai-sdk/provider';
import { loadApiKey } from '@ai-sdk/provider-utils';

export interface ProviderSettings {
  apiKey?: string;
  baseURL?: string;
  // provider-specific settings
}

export class ProviderInstance {
  readonly apiKey?: string;
  readonly baseURL?: string;

  constructor(options: ProviderSettings = {}) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL;
  }

  private get baseConfig() {
    return {
      apiKey: () =>
        loadApiKey({
          apiKey: this.apiKey,
          environmentVariableName: 'PROVIDER_API_KEY',
          description: 'Provider API key',
        }),
      baseURL: this.baseURL ?? 'https://api.provider.com',
    };
  }

  languageModel(modelId: string) {
    return new ProviderLanguageModel(modelId, this.baseConfig);
  }

  // Shorter alias
  chat(modelId: string) {
    return this.languageModel(modelId);
  }
}

// Export default instance
export const providerName = new ProviderInstance();
```

### 7. Implement Model Classes

Each model type (language, embedding, image, etc.) should implement the appropriate interface from `@ai-sdk/provider`:

- `LanguageModelV4` for text generation models
- `EmbeddingModelV4` for embedding models
- `ImageModelV4` for image generation models
- etc.

**Schema guidelines**:

**Provider Options** (user-facing):

- Use `.optional()` unless `null` is meaningful
- Be as restrictive as possible for future flexibility

**Response Schemas** (API responses):

- Use `.nullish()` instead of `.optional()`
- Keep minimal - only include properties you need
- Allow flexibility for provider API changes

### 8. Create README.md

Include:

- Brief description linking to documentation
- Installation instructions
- Basic usage example
- Link to full documentation

### 9. Write Tests

- Unit tests for provider logic
- API response parsing tests using fixtures in `__fixtures__` subdirectory
- Both Node.js and Edge runtime tests

See `capture-api-response-test-fixture` skill for capturing real API responses for testing.

### 10. Add Examples

Create examples in `examples/ai-functions/src/` for each model type the provider supports:

- `generate-text/<provider>.ts` - Basic text generation
- `stream-text/<provider>.ts` - Streaming text
- `generate-object/<provider>.ts` - Structured output (if supported)
- `stream-object/<provider>.ts` - Streaming structured output (if supported)
- `embed/<provider>.ts` - Embeddings (if supported)
- `generate-image/<provider>.ts` - Image generation (if supported)
- etc.

Add feature-specific examples as needed (e.g., `<provider>-tool-call.ts`, `<provider>-cache-control.ts`).

### 11. Add Documentation

Create documentation in `content/providers/01-ai-sdk-providers/<last number + 10>-<provider>.mdx`

Include:

- Setup instructions
- Available models
- Model capabilities
- Provider-specific options
- Usage examples
- API configuration

### 12. Create Changeset

Run `pnpm changeset` and:

- Select the new provider package
- Choose `major` version (for new packages starting at 0.0.0)
- Describe what the package provides

### 13. Update References

Run `pnpm update-references` from the workspace root to update tsconfig references.

### 14. Build and Test

```bash
# From workspace root
pnpm build

# From provider package
cd packages/<provider>
pnpm test              # Run all tests
pnpm test:node         # Run Node.js tests
pnpm test:edge         # Run Edge tests
pnpm type-check        # Type checking

# From workspace root
pnpm type-check:full   # Full type check including examples
```

### 15. Run Examples

Test your examples:

```bash
cd examples/ai-functions
pnpm tsx src/generate-text/<provider>.ts
pnpm tsx src/stream-text/<provider>.ts
```

## Provider Method Naming

- **Full names**: `languageModel(id)`, `imageModel(id)`, `embeddingModel(id)` (required)
- **Short aliases**: `.chat(id)`, `.image(id)`, `.embedding(id)` (for DX)

## File Naming Conventions

- Source files: `kebab-case.ts`
- Test files: `kebab-case.test.ts`
- Type test files: `kebab-case.test-d.ts`
- Provider classes: `<Provider>Provider`, `<Provider>LanguageModel`, etc.

## Security Best Practices

- Never use `JSON.parse` directly - use `parseJSON` or `safeParseJSON` from `@ai-sdk/provider-utils`
- Load API keys securely using `loadApiKey` from `@ai-sdk/provider-utils`
- Validate all API responses against schemas

## Error Handling

Errors should extend `AISDKError` from `@ai-sdk/provider` and use a marker pattern:

```typescript
import { AISDKError } from '@ai-sdk/provider';

const name = 'AI_ProviderError';
const marker = `vercel.ai.error.${name}`;
const symbol = Symbol.for(marker);

export class ProviderError extends AISDKError {
  private readonly [symbol] = true;

  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ name, message, cause });
  }

  static isInstance(error: unknown): error is ProviderError {
    return AISDKError.hasMarker(error, marker);
  }
}
```

## Pre-release Mode

If `main` is set up to publish `beta` releases, no further action is necessary. Just make sure not to backport it to the `vX.Y` stable branch since it will result in an npm version conflict once we exit pre-release mode on `main`.

## Checklist

- [ ] Package structure created in `packages/<provider>`
- [ ] `package.json` configured with correct dependencies
- [ ] TypeScript configs set up (`tsconfig.json`, `tsconfig.build.json`)
- [ ] Build configuration (`tsup.config.ts`)
- [ ] Test configurations (`vitest.node.config.js`, `vitest.edge.config.js`)
- [ ] Provider implementation complete
- [ ] Model classes implement appropriate interfaces
- [ ] Unit tests written and passing
- [ ] API response test fixtures captured
- [ ] Examples created in `examples/ai-functions/src/`
- [ ] Documentation added in `content/providers/01-ai-sdk-providers/`
- [ ] README.md written
- [ ] Major changeset created
- [ ] `pnpm update-references` run
- [ ] All tests passing (`pnpm test` from package)
- [ ] Type checking passing (`pnpm type-check:full` from root)
- [ ] Examples run successfully

## Common Issues

- **Missing tsconfig references**: Run `pnpm update-references` from workspace root
- **Type errors in examples**: Run `pnpm type-check:full` to catch issues early
- **Test failures**: Ensure both Node and Edge tests pass
- **Build errors**: Check that `tsup.config.ts` is configured correctly

## Related Documentation

- [Provider Architecture](../../contributing/provider-architecture.md)
- [Provider Development Notes](../../contributing/providers.md)
- [Develop AI Functions Example](../develop-ai-functions-example/SKILL.md)
- [Capture API Response Test Fixture](../capture-api-response-test-fixture/SKILL.md)
