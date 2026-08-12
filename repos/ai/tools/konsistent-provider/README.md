# AI SDK - Konsistent Conventions

_**Preliminary readme file.** Most of this will only be relevant once this becomes a published package._

Reusable [konsistent](https://github.com/vercel-labs/konsistent) conventions for the AI SDK and its providers.

This package serves two purposes:

1. **Convention library.** It exports the structural conventions that the AI SDK monorepo enforces across its own packages — required package files, provider symbol exports, model file naming, and so on — so they can be referenced from any `konsistent.json` via `@konsistent/convention`'s reusable-convention mechanism.
2. **Ready-to-use config for third-party provider packages.** It also ships a `konsistent.json` at the package root that wires those conventions into a working configuration for an external `@your-org/<provider>` package. Third-party provider authors can apply the same checks the AI SDK applies to its own providers, without restating any rules.

## Usage in third-party provider packages

Add both `konsistent` and `@ai-sdk/konsistent-provider` as dev dependencies of your provider package:

```bash
pnpm add -D konsistent @ai-sdk/konsistent-provider
```

Then run `konsistent` against the bundled config, supplying your provider's kebab-case id as the `providerId` placeholder:

```bash
konsistent --config-package='@ai-sdk/konsistent-provider' --placeholder='providerId:my-provider'
```

Replace `my-provider` with the actual kebab-case id you use in your package and source files. This drives the symbol-name and file-name checks (`createMyProvider`, `my-provider-provider.ts`, `MyProviderLanguageModel`, etc.).

## Usage as a convention library

If you'd rather author your own `konsistent.json` and pull in only the conventions you want, declare `@ai-sdk/konsistent-provider` as a convention source and reference its conventions by name:

```json
{
  "version": "v1",
  "conventionSources": {
    "aisdk": "@ai-sdk/konsistent-provider"
  },
  "conventions": [
    {
      "use": "aisdk/provider-package-must-export-provider-creator-and-settings",
      "paths": ["src/index.ts"]
    }
  ]
}
```

See the source of `src/index.ts` for the full list of available conventions.
