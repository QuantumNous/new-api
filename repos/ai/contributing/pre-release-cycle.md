# Pre-Release Cycle

This guide explains how to start and end a pre-release (beta) cycle for a new major version of the AI SDK.

## Overview

Every major release of the AI SDK introduces a new provider specification version (e.g. V3 to V4). Evolving the spec is the reason we do major releases — it lets us make breaking changes to the provider interface while giving provider authors a clear migration target.

A pre-release cycle lets us develop the next major version on `main` while keeping the current stable version available for patches. During the cycle:

- `main` publishes beta releases (e.g. `ai@7.0.0-beta.1`)
- A maintenance branch (e.g. `release-v6.0`) receives backported patches and publishes stable releases

## Starting a Pre-Release Cycle

### 1. Create a maintenance branch

Create a branch from the current `main` HEAD so the current stable version can continue receiving patches:

```bash
git checkout main
git pull origin main
git checkout -b release-v<current-major>.0   # e.g. release-v6.0
git push origin release-v<current-major>.0
```

The [release workflow](../.github/workflows/release.yml) already runs on `release-v*` branches, so no workflow changes are needed.

### 2. Set the npm dist-tag on the maintenance branch

On the new maintenance branch, update the `ci:release` script in the root `package.json` to publish with a version-specific npm dist-tag. This prevents maintenance releases from taking over the `latest` tag on npm:

```diff
-    "ci:release": "turbo clean && turbo build && changeset publish",
+    "ci:release": "turbo clean && turbo build && changeset publish --tag ai-v<current-major>",
```

For example, for `release-v6.0` use `--tag ai-v6`. Commit and push the change directly to the maintenance branch.

### 3. Enter pre-release mode on `main`

Switch back to `main` and enter changeset pre-release mode:

```bash
git checkout main
pnpm changeset pre enter beta
```

This modifies `.changeset/pre.json`. The `initialVersions` field should only contain packages from `packages/*/package.json` files — remove any other entries (e.g. `@example/*`, `tools/*`, or nested test packages). Commit and push the change (or open a PR).

### 4. Create a major changeset

Create a changeset that bumps every published package to the next major version:

```bash
pnpm changeset
```

Select all packages from `packages/*/package.json` (skip `@example/*`, `tools/*`, and any other non-`packages/` entries — they are private and not published) and choose `major` for each. Write a summary like:

> Start v7 pre-release

Commit the generated `.changeset/*.md` file.

### 5. Seed the new spec version

Every major release introduces a new provider specification version (e.g. V3 to V4). You must create a new version directory for **every** spec directory under `packages/provider/src/` that contains a versioned subdirectory. To find them, run:

```bash
ls -d packages/provider/src/*/v3
```

As of writing, the directories are: `embedding-model`, `embedding-model-middleware`, `image-model`, `image-model-middleware`, `language-model`, `language-model-middleware`, `provider`, `reranking-model`, `shared`, `speech-model`, `transcription-model`, `video-model`.

For **each** directory:

1. Copy the current spec directory (e.g. `v3/`) to a new version directory (e.g. `v4/`).
2. Rename all files from the old version to the new (e.g. `language-model-v3.ts` → `language-model-v4.ts`).
3. Inside each file, replace all occurrences of the old version with the new (e.g. `V3` → `V4`, `v3` → `v4` in type names, imports, and the `specificationVersion` literal).
4. Add `export * from './v4/index';` to the parent `index.ts` (before the v3 export).
5. Update cross-references: if the `provider` v4 spec imports other model types, ensure it imports from the new v4 paths (not v3).

Verify by running `pnpm build` in `packages/provider` — all new types should appear in the built `.d.ts` output.

### 6. Create mock test utilities

Create V4 counterparts for every mock file in `packages/ai/src/test/` (e.g. `mock-language-model-v3.ts` → `mock-language-model-v4.ts`). Update `packages/ai/test/index.ts` to export the new V4 mocks.

### 7. Update `packages/ai` for the new spec version

The core `packages/ai` package needs adapter functions, updated public APIs, and test updates to support the new spec version alongside older ones.

#### Adapter functions

Create V4 adapter files in `packages/ai/src/model/` for each model type. These use a `Proxy` to convert V3 models to V4 by overriding `specificationVersion`:

- `as-language-model-v4.ts`
- `as-embedding-model-v4.ts`
- `as-image-model-v4.ts`
- `as-speech-model-v4.ts`
- `as-transcription-model-v4.ts`
- `as-reranking-model-v4.ts`
- `as-video-model-v4.ts`
- `as-provider-v4.ts` (converts a V3 provider to V4 by wrapping all model factory methods)

Each adapter checks `specificationVersion` and returns the model as-is if already V4, or wraps it in a Proxy otherwise.

Each adapter should have a corresponding test file (e.g. `as-language-model-v4.test.ts`) that verifies:

- V4 input is returned as-is (identity check with `.toBe()`)
- V3 input is proxied with `specificationVersion` changed to `'v4'`
- V2 input (where applicable) is converted through V3 then to V4
- Properties and methods are preserved through the proxy

#### Public API updates

Update the following files to accept `V2 | V3 | V4` models at their public boundaries, converting to V4 internally using the adapters:

- `packages/ai/src/middleware/wrap-language-model.ts` — accept `LanguageModelV2 | V3 | V4`
- `packages/ai/src/middleware/wrap-image-model.ts` — accept `ImageModelV2 | V3 | V4`
- `packages/ai/src/middleware/wrap-embedding-model.ts` — accept `EmbeddingModelV3 | V4` (V2 is generic, not included; V3 kept for backward compatibility)
- `packages/ai/src/registry/custom-provider.ts` — accept V2/V3/V4 models in all model maps
- `packages/ai/src/registry/provider-registry.ts` — accept `ProviderV2 | V3 | V4`, convert with `asProviderV4`
- `packages/ai/src/types/language-model-middleware.ts` — relax to accept both V3 and V4 middleware

#### Test updates

- Create test files for each V4 adapter (e.g. `as-language-model-v4.test.ts`), verifying identity pass-through, V3→V4 conversion, and V2→V4 conversion.
- Update `resolve-model.test.ts` to test both V3→V4 conversion (using V3 mocks) and V4 pass-through (using V4 mocks) as separate test blocks.
- Update other test files to use V4 mocks where the code now returns V4 models (e.g. `custom-provider.test.ts`, `provider-registry.test.ts`, middleware tests). Use V4 mocks for any test that checks reference equality (`.toBe()`) on returned models.

Run `pnpm test` in `packages/ai` and `pnpm type-check:full` from the workspace root to verify.

### 8. Set up the documentation site (ai-sdk.dev)

The documentation site lives in the `ai-studio` repository and uses a Git submodule pointing at this repository. During the pre-release cycle the site needs versioned branches and Vercel deployments for both stable and beta docs.

In the `vercel/ai` repository:

1. Update `.github/workflows/update-sdk-submodule-v6.yml` to track the `release-v6.0` branch instead of `main`.
2. Create `.github/workflows/update-sdk-submodule-v7.yml` — this workflow fetches `main`, checks out the `sdk/v7` branch in `ai-studio`, and pushes to `origin sdk/v7`.

In the `ai-studio` repository:

3. Create a `sdk/v7` branch (the default branch stays `sdk/v6` for now so the production site continues serving stable docs).
4. In Vercel, create a v7 preview deployment connected to the `sdk/v7` branch (e.g. `v7.ai-sdk.dev`).

### 9. Merge to `main`

Open a PR with all the changes from steps 3-7. Once merged, the first beta release (e.g. `ai@7.0.0-beta.1`) will be published automatically.

## During the Pre-Release Cycle

### Day-to-day development

- All feature PRs continue to target `main`.
- Every PR still needs a changeset (use `patch` by default).
- Beta versions are published automatically when the **Version Packages** PR is merged.

### Adding a new package

When introducing a new package while `main` is in pre-release mode, set its initial `version` in `package.json` to plain `0.0.0` — **never** `0.0.0-canary.0` (or any `-<tag>.N` suffix). A pre-release suffix makes the version a "premajor", and semver treats a `major`/`minor`/`patch` bump on a premajor as merely dropping the suffix, so the package gets stuck at `0.0.0-canary.N` instead of advancing (e.g. a `major` changeset should produce `1.0.0-canary.0`). See [add-new-provider.md → When in pre-release mode](./add-new-provider.md#when-in-pre-release-mode).

### Backporting fixes to stable

To backport a fix from `main` to the maintenance branch, add the `backport` label to the merged PR. This creates a new PR targeting the maintenance branch automatically.

### Publishing stable patches

Patches merged into the maintenance branch trigger the release workflow and publish stable patch releases.

## Ending the Pre-Release Cycle

When the new major version is ready for stable release:

### 1. Exit pre-release mode

```bash
git checkout main
pnpm changeset pre exit
```

This removes `.changeset/pre.json`. Commit and push (or open a PR).

### 2. Publish the stable release

Once the exit-PR is merged, the next **Version Packages** PR will produce stable versions (e.g. `ai@7.0.0`). Merge it to publish.

### 3. Switch the documentation site

In the `ai-studio` repository, change the default branch from `sdk/v6` to `sdk/v7` so the production site serves the new major version. Update the Vercel production deployment accordingly.

### 4. Archive the maintenance branch

The maintenance branch (e.g. `release-v6.0`) can remain for emergency patches but will no longer receive regular backports.
