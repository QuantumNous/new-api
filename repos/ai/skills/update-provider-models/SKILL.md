---
name: update-provider-models
description: Add new or remove obsolete model IDs for existing AI SDK providers. Use when adding a model to a provider, removing an obsolete model, or processing a list of model changes from an issue. Triggers on "add model", "remove model", "new model ID", "obsolete model", "update model IDs".
metadata:
  internal: true
---

## Update Provider Model IDs

This skill covers adding new model IDs and removing obsolete ones across the AI SDK codebase. Each workflow uses search to discover all locations that need changes.

You may be asked to add or remove a single model ID, or to process a list of multiple model ID changes from an issue. For each model ID, follow the appropriate workflow:

- If a new model ID is being added, follow the `<adding-new-model>` workflow.
- If an obsolete model ID is being removed, follow the `<removing-obsolete-model>` workflow.

## Critical Rules

- **Exact matching**: Model IDs are often substrings of others (e.g. `grok-3` vs `grok-3-mini`). Always verify each search result is the exact model, not a substring match.
- **Respect sort order**: When inserting into any list (type unions, table rows, arrays), observe the existing order and place the new entry accordingly.
- **File naming for examples**: Use kebab-case with hyphens replacing dots (e.g. `gpt-5.4-codex` → `gpt-5-4-codex.ts`).
- **Sequential processing**: When handling multiple models, complete the full workflow for one model before starting the next.
- **Affected providers**: New model IDs always need to be added to the primary provider package and the AI Gateway. There may be additional affected packages (e.g. Bedrock, Vertex, OpenAI-compatible) if the model is available there or referenced in tests/docs.
- **Never make unrelated changes**: Only update model IDs and related references. Don't modify any other code, text, or formatting in the files you edit.
- **Never modify `CHANGELOG.md` files of `packages/codemod`**: Changelog files are historical records, codemods are migration scripts. Do not edit either when updating model IDs.

<adding-new-model>

## Workflow for Adding a New Model ID

### Step 1: Identify Scope

Determine:

- Provider name (e.g. `anthropic`, `openai`, `google`, `xai`)
- Exact model ID string (e.g. `claude-haiku-4-5-20260218`, `gemini-3.1-pro`, `gpt-5.4-codex`)
- Model type: chat, embedding, image, etc.
- Whether this is a new version of an existing older model, or even the stable version of an existing preview or experimental model
- Whether any provider packages other than the primary one and the AI Gateway need to be updated (e.g. Bedrock, Vertex, OpenAI-compatible)
  - If a similar model ID is listed in one of those other provider packages, the new model ID should likely be added there as well. Check the provider's documentation for clues on availability.

### Step 2: Find Where Similar Models Are Referenced

Search for a similar existing model from the same provider (e.g. a lower version, or the preview version being replaced) across `packages/`, `content/`, and `examples/`. This reveals all locations that need updates.

```bash
# Search quoted occurrences to find all reference locations
grep -r "'<similar-model-id>'" packages/ content/ examples/ --include='*.ts' --include='*.mdx' --include='*.md'
grep -r '"<similar-model-id>"' packages/ content/ examples/ --include='*.ts' --include='*.mdx' --include='*.md'
```

### Step 3: Update Type Definitions

For each relevant `packages` file found, add the new model ID to the type union (and const arrays if present), respecting existing sort order.

Examples of common locations for model ID type definitions:

- `packages/<provider>/src/*-options.ts` — the primary provider package
- `packages/gateway/src/gateway-language-model-settings.ts` — the AI Gateway package
- `packages/amazon-bedrock/src/**/*-options.ts` — if the model is available on Amazon Bedrock
- `packages/google-vertex/src/*-options.ts` — if the model is available on Google Vertex

This is NOT an exhaustive list — the search in Step 2 may reveal other files with model ID references that need updating as well.

**Never** replace a model ID here. Only add the new model ID. Replacing references to an older or preview model ID is only relevant in documentation and examples.

Example type union addition:

```typescript
export type SomeModelId =
  | 'existing-model-a'
  | 'new-model-id' // ← add in sorted position
  | 'existing-model-b'
  | (string & {});
```

Example const array addition:

```typescript
export const reasoningModelIds = [
  'existing-model-a',
  'new-model-id', // ← add in sorted position
  'existing-model-b',
] as const;
```

### Step 4: Update Documentation

For each `.mdx` file found in `content/`, add or update entries:

- **Capability tables**: Add a row for the new model in the correct position with the appropriate capability checks (`<Check />` or `<Cross />`).
- **Inline code examples**: If replacing a preview/older model as the recommended one, update code snippets like `const model = provider('old-model')` to use the new model.
- **"Latest" descriptions**: Update text like "Latest model with enhanced reasoning" to reference the new model.

If you found the similar model ID referenced in a specific package's `README.md` file, update the model ID in those code examples as well.

### Step 5: Create or Update Examples

**If the new model replaces an older one**: Find existing examples using the old model and update them to use the new model ID.

**If purely new with no predecessor**: Create new example files, one file per top-level function that is relevant for the new model (e.g. `generateText`, `streamText`, `generateImage`). For example, if it's a new language model, you would create files like:

- `examples/ai-functions/src/generate-text/<provider>/<model-kebab>.ts`
- `examples/ai-functions/src/stream-text/<provider>/<model-kebab>.ts`

Or if it's a new image model, you might create:

- `examples/ai-functions/src/generate-image/<provider>/<model-kebab>.ts`

Look for existing example files for the provider in the same folder, to use as a reference for your new example files.

In your search for the similar model ID, you may have found examples in which the model ID is part of a list of models (e.g. in an array of options for a test or example). In that case, add the new model ID to the same list in the example file, respecting sort order.

### Step 6: Update Tests

Where reasonable, replace references to the older or preview model with the new model in test files, especially if the new model is now the recommended one.

**Exception:** Do not replace model IDs in fixtures or snapshots, or tests that use those fixtures or snapshots, as those are meant to be stable and reflect actual API responses captured.

### Step 7: Run Tests

```bash
pnpm --filter @ai-sdk/<provider> test
pnpm --filter @ai-sdk/gateway test
```

Also run tests for any other affected packages:

```bash
pnpm --filter @ai-sdk/openai-compatible test  # if snapshots/tests were updated
pnpm --filter @ai-sdk/amazon-bedrock test     # if Bedrock options were updated
pnpm --filter @ai-sdk/google-vertex test      # if Vertex options were updated
```

</adding-new-model>

<removing-obsolete-model>

## Workflow for Removing an Obsolete Model ID

### Step 1: Identify Successor

Determine which model replaces the removed one in examples, tests, and docs. This is relevant for updating references.

If there is no obvious successor, you should leave old references in place in examples, docs, and tests.

### Step 2: Find All Exact Occurrences

Search for the model ID with quotes to avoid substring false positives:

```bash
# Single-quoted (TypeScript source, type unions)
grep -r "'<model-id>'" packages/ content/ examples/ --include='*.ts' --include='*.mdx' --include='*.md' --include='*.snap'

# Double-quoted (JSON in snapshots, test fixtures with embedded JSON, docs)
grep -r '"<model-id>"' packages/ content/ examples/ --include='*.ts' --include='*.mdx' --include='*.md' --include='*.snap'
```

Manually verify each result is the exact model and not a substring match (e.g. searching `'grok-3'` must not match `'grok-3-mini'`).

### Step 3: Remove from Type Definitions

Remove the `| 'model-id'` line from union types and entries from const arrays in `*-options.ts` files.

### Step 4: Update Documentation

- Remove rows from capability tables in `.mdx` files.
- Replace inline code examples and descriptions referencing the removed model with the successor.
- Update community provider docs in `content/providers/05-community-providers/`.

### Step 5: Update Examples

- Replace the removed model with the successor in example files that use it directly.
- Remove from model lists in examples.
- Delete dedicated example files only if no unique feature is demonstrated beyond the model itself (e.g. if the file is named after the model).

### Step 6: Update Tests and Snapshots

- Replace the model ID with the successor in `*.test.ts` files.
- Replace the model ID in `__snapshots__/*.snap` files — model IDs appear in serialized JSON strings.
- Replace in embedded JSON strings within test fixtures (e.g. `"model":"old-model"` → `"model":"new-model"`).
- Update `examples/ai-functions/src/e2e/*.test.ts` — remove from model arrays or replace.
- Update `packages/<provider>/README.md` if it contains code examples.

### Step 7: Run Tests

```bash
pnpm --filter @ai-sdk/<provider> test
```

Also run tests for any other affected packages (same as Workflow A Step 7).

</removing-obsolete-model>
