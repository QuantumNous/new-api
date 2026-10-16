# AGENTS.md

This file provides context for AI coding assistants (Cursor, GitHub Copilot, Claude Code, etc.) working with the Vercel AI SDK repository.

## Project Overview

The **AI SDK** by Vercel is a TypeScript/JavaScript SDK for building AI-powered applications with Large Language Models (LLMs). It provides a unified interface for multiple AI providers and framework integrations.

- **Repository**: https://github.com/vercel/ai
- **Documentation**: https://ai-sdk.dev/docs
- **License**: Apache-2.0

## Repository Structure

This is a **monorepo** using pnpm workspaces and Turborepo.

### Key Directories

| Directory                 | Description                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `packages/ai`             | Main SDK package (`ai` on npm)                                                       |
| `packages/provider`       | Provider interface specifications (`@ai-sdk/provider`)                               |
| `packages/provider-utils` | Shared utilities for providers and core (`@ai-sdk/provider-utils`)                   |
| `packages/<provider>`     | AI provider implementations (openai, anthropic, google, azure, amazon-bedrock, etc.) |
| `packages/<framework>`    | UI framework integrations (react, vue, svelte, angular, rsc)                         |
| `packages/codemod`        | Automated migrations for major releases                                              |
| `examples/`               | Example applications (ai-functions, next-openai, etc.)                               |
| `content/`                | Documentation source files (MDX)                                                     |
| `contributing/`           | Contributor guides and documentation                                                 |
| `tools/`                  | Internal tooling (tsconfig)                                                          |

### Core Package Dependencies

```
ai ─────────────────┬──▶ @ai-sdk/provider-utils ──▶ @ai-sdk/provider
                    │
@ai-sdk/<provider> ─┴──▶ @ai-sdk/provider-utils ──▶ @ai-sdk/provider
```

## Development Setup

### Requirements

- **Node.js**: v22, v24, or v26 (v22 recommended for development)
- **pnpm**: v10+ (`npm install -g pnpm@10`)

### Initial Setup

```bash
pnpm install        # Install all dependencies
pnpm build          # Build all packages
```

## Development Commands

### Root-Level Commands

| Command                  | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm install`           | Install dependencies                                              |
| `pnpm build`             | Build all packages                                                |
| `pnpm test`              | Run all tests (excludes examples)                                 |
| `pnpm check`             | Run linting (oxlint) and formatting (oxfmt) checks                |
| `pnpm fix`               | Fix linting and formatting issues                                 |
| `pnpm type-check:full`   | TypeScript type checking (includes examples)                      |
| `pnpm changeset`         | Add a changeset for your PR                                       |
| `pnpm update-references` | Update tsconfig.json references after adding package dependencies |

### Package-Level Commands

Run these from within a package directory (e.g., `packages/ai`):

| Command            | Description                 |
| ------------------ | --------------------------- |
| `pnpm build`       | Build the package           |
| `pnpm build:watch` | Build with watch mode       |
| `pnpm test`        | Run all tests (node + edge) |
| `pnpm test:node`   | Run Node.js tests only      |
| `pnpm test:edge`   | Run Edge runtime tests only |
| `pnpm test:watch`  | Run tests in watch mode     |

### Running Examples

```bash
cd examples/ai-functions
pnpm tsx src/stream-text/openai/basic.ts    # Run a specific example
```

### AI Functions Example Layout

- Place examples under `examples/ai-functions/src/<function>/<provider>/`
- Use `basic.ts` for the provider entry example file
- Place all other examples in the same provider folder using descriptive `kebab-case` file names
- Do not create flat top-level provider files like `src/stream-text/openai.ts`

## Core APIs

| Function                   | Purpose                    | Package |
| -------------------------- | -------------------------- | ------- |
| `generateText`             | Generate text completion   | `ai`    |
| `streamText`               | Stream text completion     | `ai`    |
| `generateObject`           | Generate structured output | `ai`    |
| `streamObject`             | Stream structured output   | `ai`    |
| `embed` / `embedMany`      | Generate embeddings        | `ai`    |
| `generateImage`            | Generate images            | `ai`    |
| `tool`                     | Define a tool              | `ai`    |
| `jsonSchema` / `zodSchema` | Define schemas             | `ai`    |

## Import Patterns

| What                                          | Import From                                   |
| --------------------------------------------- | --------------------------------------------- |
| Core functions (`generateText`, `streamText`) | `ai`                                          |
| Tool/schema utilities (`tool`, `jsonSchema`)  | `ai`                                          |
| Provider implementations                      | `@ai-sdk/<provider>` (e.g., `@ai-sdk/openai`) |
| Error classes                                 | `ai` (re-exports from `@ai-sdk/provider`)     |
| Provider type interfaces (`LanguageModelV4`)  | `@ai-sdk/provider`                            |
| Provider implementation utilities             | `@ai-sdk/provider-utils`                      |

## Coding Standards

### Formatting

- **Formatter**: oxfmt (via `pnpm fix` or `ultracite fix`)
- **Linter**: oxlint (via `pnpm check` or `ultracite check`)
- **Config**: `.oxfmtrc.jsonc` (formatter) and `.oxlintrc.json` (linter)
- **Pre-commit hook**: Runs `pnpm install` if `package.json` changes are staged

### Testing

- **Framework**: Vitest
- **Test files**: `*.test.ts` alongside source files
- **Type tests**: `*.test-d.ts` for type-level tests
- **Fixtures**: Store in `__fixtures__` subfolders
- **Snapshots**: Store in `__snapshots__` subfolders

### Zod Usage

The SDK supports both Zod 3 and Zod 4. Use correct imports:

```typescript
// For Zod 3 (compatibility code only)
import * as z3 from 'zod/v3';

// For Zod 4
import * as z4 from 'zod/v4';
// Use z4.core.$ZodType for type references
```

### JSON parsing

Never use `JSON.parse` directly in production code to prevent security risks.
Instead use `parseJSON` or `safeParseJSON` from `@ai-sdk/provider-utils`.

### Type Checking

Always run type checking after making code changes:

```bash
pnpm type-check:full    # Run from workspace root
```

This ensures your changes don't introduce type errors across the codebase, including examples.

### File Naming Conventions

- Source files: `kebab-case.ts`
- Test files: `kebab-case.test.ts`
- Type test files: `kebab-case.test-d.ts`
- React/UI components: `kebab-case.tsx`

## Error Pattern

Errors extend `AISDKError` from `@ai-sdk/provider` and use a marker pattern for `instanceof` checks:

```typescript
import { AISDKError } from '@ai-sdk/provider';

const name = 'AI_MyError';
const marker = `vercel.ai.error.${name}`;
const symbol = Symbol.for(marker);

export class MyError extends AISDKError {
  private readonly [symbol] = true; // used in isInstance

  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ name, message, cause });
  }

  static isInstance(error: unknown): error is MyError {
    return AISDKError.hasMarker(error, marker);
  }
}
```

## Architecture Decision Records (ADRs)

This repo uses ADRs in `contributing/decisions/` to capture important architecture decisions. Before making changes that touch architecture (new dependencies, new patterns, API design, infrastructure), check existing ADRs:

1. Read `contributing/decisions/README.md` for the index of decisions.
2. Read any accepted ADRs relevant to your area of work. Follow the decisions and implementation patterns they specify.
3. If you encounter a pattern in the code and wonder "why is it done this way?", check whether an ADR explains it.
4. If your work would contradict an existing accepted ADR, stop and discuss with the human before proceeding.

To propose or create a new ADR, use the ADR skill.

## Project Philosophies

For an overview of the project's key philosophies that guide decision making, see `contributing/project-philosophies.md`.

## Architecture

### Provider Pattern

The SDK uses a layered provider architecture following the adapter pattern:

1. **Specifications** (`@ai-sdk/provider`): Defines interfaces like `LanguageModelV4`
2. **Utilities** (`@ai-sdk/provider-utils`): Shared code for implementing providers
3. **Providers** (`@ai-sdk/<provider>`): Concrete implementations for each AI service
4. **Core** (`ai`): High-level functions like `generateText`, `streamText`, `generateObject`

For a focused conceptual walkthrough of AI functions, model specifications, and provider implementations, see `architecture/provider-abstraction.md`.

### Provider Development

**Provider Options Schemas** (user-facing):

- Use `.optional()` unless `null` is meaningful
- Be as restrictive as possible for future flexibility

**Response Schemas** (API responses):

- Use `.nullish()` instead of `.optional()`
- Keep minimal - only include properties you need
- Allow flexibility for provider API changes

**Fetching URLs from responses**:

- Every `getFromApi` call in this repository must set `validateUrl` explicitly
  (the option is optional for backwards compatibility with external callers, but
  omitting it skips validation — never rely on that; the
  `ai-sdk/require-validate-url` oxlint rule fails `pnpm check` otherwise). Use
  `true` when the URL comes from a provider response body (image/audio/video
  download or a polling URL); use `false` only for URLs built from a configured
  `baseURL`.
- Pass `credentialedOrigin` when a response URL may legitimately carry the API
  key on its first hop, so credentials are withheld off-origin.
- See [contributing/secure-url-handling.md](contributing/secure-url-handling.md).

### Adding New Packages

1. Create folder under `packages/<name>`
2. Add to root `tsconfig.json` references
3. Run `pnpm update-references` if adding dependencies between packages

## Contributing Guides

| Task                  | Guide                                   |
| --------------------- | --------------------------------------- |
| Add new provider      | `contributing/add-new-provider.md`      |
| Add new model         | `contributing/add-new-model.md`         |
| Testing & fixtures    | `contributing/testing.md`               |
| Provider architecture | `contributing/provider-architecture.md` |
| Building new features | `contributing/building-new-features.md` |
| Codemods              | `contributing/codemods.md`              |

## Changesets

- **Required**: Every PR modifying production code needs a changeset
- **Default**: Use `patch` (non-breaking changes)
- **Command**: `pnpm changeset` in workspace root
- **Note**: Don't select example packages - they're not published

## Task Completion Guidelines

These guidelines outline typical artifacts for different task types. Use judgment to adapt based on scope and context.

### Bug Fixes

A complete bug fix typically includes:

1. **Reproduction example**: Create/update an example in `examples/` that demonstrates the bug before fixing
2. **Unit tests**: Add tests that would fail without the fix (regression tests)
3. **Implementation**: Fix the bug
4. **Manual verification**: Run the reproduction example to confirm the fix
5. **Changeset**: Describe what was broken and how it's fixed

### New Features

A complete feature typically includes:

1. **Implementation**: Build the feature
2. **Examples**: Add usage examples in `examples/` demonstrating the feature
3. **Unit tests**: Comprehensive test coverage for new functionality
4. **Documentation**: Update relevant docs in `content/` for public APIs
5. **Changeset**: Describe the feature for release notes

### Refactoring / Internal Changes

- Unit tests for any changed behavior
- No documentation needed for internal-only changes
- Changeset only if it affects published packages

### When to Deviate

These are guidelines, not rigid rules. Adjust based on:

- **Scope**: Trivial fixes (typos, comments) may not need examples
- **Visibility**: Internal changes may not need documentation
- **Context**: Some changes span multiple categories

When uncertain about expected artifacts, ask for clarification.

## Do Not

- Add minor/major changesets
- Change public APIs without updating documentation
- Use `require()` for imports
- Add new dependencies without running `pnpm update-references`
- Modify `content/docs/08-migration-guides` or `packages/codemod` as part of broader codebase changes
