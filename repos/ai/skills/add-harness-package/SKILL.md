---
name: add-harness-package
description: Guide for adding new AI SDK harness packages. Use when creating a new @ai-sdk/harness-<name> package that adapts a coding-agent runtime to HarnessV1.
metadata:
  internal: true
---

## Adding a New Harness Package

This guide covers creating a new `@ai-sdk/harness-<name>` package for an agent harness.

A harness can be **host-driven**, where the runtime runs in the host process and uses the sandbox remotely, or **bridge-backed**, where a small bridge runs inside the sandbox because the runtime needs local access to the sandbox filesystem or process environment.
Prefer host-driven when the runtime supports it.

## First-Party vs Third-Party Harnesses

- **Third-party packages**: Any runtime can publish an external harness package.
- **First-party `@ai-sdk/harness-<name>` packages**: Create an issue first to discuss whether the runtime belongs in this repo.

## Reference Example

See https://github.com/vercel/ai/pull/16255/changes for a complete example of adding a new harness.

## Harness Architecture

The AI SDK uses a layered harness architecture following the adapter pattern:

1. **Harness specification** (`@ai-sdk/harness`): Defines interfaces like `HarnessV1` and `HarnessV1Session`
2. **Utilities** (`@ai-sdk/harness/utils`): Shared code for implementing harnesses
3. **Harness implementations** (`@ai-sdk/harness-<name>`): Concrete adapters for harnesses
4. **Harness agent** (`@ai-sdk/harness/agent`): The high-level user-facing `HarnessAgent` API

## Step-by-Step Guide

### 1. Create Package Structure

Create `packages/harness-<name>` with this baseline structure:

```
packages/harness-<name>/
├── src/
│   ├── index.ts
│   ├── <name>-harness.ts
│   ├── <name>-harness.test.ts
│   └── <name>-auth.ts              # if the runtime needs auth resolution
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
├── turbo.json
├── vitest.node.config.js
└── README.md
```

If the runtime must execute inside the sandbox, add bridge files as well:

```
src/
├── <name>-bridge-protocol.ts
├── <name>-bridge-protocol.test.ts
└── bridge/
    ├── index.ts
    ├── package.json
    └── pnpm-lock.yaml
```

Add a `CHANGELOG.md` containing just the package heading (`# @ai-sdk/harness-<name>`). Every package is required to have one.

### 2. Configure package.json

Use existing harness packages as the source of truth for scripts, exports, repository metadata, and publish settings.

Required package basics:

- `"name": "@ai-sdk/harness-<name>"`
- `"type": "module"`
- `"version": "0.0.0"` (starting point for new packages)
- `"license": "Apache-2.0"`
- `"sideEffects": false`
- dependency on `@ai-sdk/harness` via `workspace:*`
- dependency on `@ai-sdk/provider-utils` via `workspace:*` when using sandbox/auth/schema utilities
- runtime SDK/CLI dependencies required by the harness
- dev dependencies matching existing harness packages
- `"engines": { "node": ">=22" }`

For bridge packages, add any bridge asset copy step required for files under `src/bridge/`.

Bridge dependency rules (bridge-backed harnesses):

- The bridge's runtime deps live in `src/bridge/package.json` (installed in-sandbox at bootstrap), not the main package.json. After changing them, regenerate `src/bridge/pnpm-lock.yaml` with `pnpm --dir packages/harness-<name>/src/bridge install --lockfile-only --ignore-workspace` (runnable from the repo root).
- For every third-party import in `src/bridge/`, keep three things in sync: the import, the `external` array in `tsup.config.ts`, and the dep in `src/bridge/package.json`. A missing entry shows up only at sandbox runtime as a module-resolution error.
- Include packages the runtime _lazily_ imports — e.g. provider SDKs (`@anthropic-ai/sdk`, `openai`) resolved from the model id at runtime — even though nothing imports them directly. These fail only when a model of that provider is actually used.
- Match shared dependency versions (transport, schema, tooling, runtime SDKs) to what the other harness packages currently use — copy from a sibling package rather than choosing your own pins. Stale pins drift from security patches and can desync from the shared bridge runtime; check the current versions at creation time.

### 3. Create TypeScript, Build, and Test Configs

Copy the nearest existing harness package config files and adjust paths/package names:

- `tsconfig.json`
- `tsconfig.build.json`
- `tsup.config.ts`
- `turbo.json`
- `vitest.node.config.js`

Harness packages currently use Node tests only unless the implementation has a specific reason to add another runtime.

### 4. Implement the Harness Adapter

Export a factory from `<name>-harness.ts` and re-export it from `src/index.ts`.

Use the architecture doc for contract details. At implementation time, verify:

- return a `HarnessV1` with `specificationVersion: 'harness-v1'`;
- use a stable kebab-case `harnessId`;
- expose adapter-native built-in tools through `builtinTools`;
- keep construction synchronous and side-effect free;
- use `startOpts.sandboxSession` and `startOpts.sessionWorkDir`; never create a separate sandbox;
- throw `HarnessCapabilityUnsupportedError` from the method that needs an unsupported runtime capability;
- don't hardcode a default model unless the runtime technically requires one — some underlying SDKs have no default of their own. Otherwise pass the model only when the consumer configured one and leave the original SDK's default untouched; keep the session's `modelId` consistent with what's actually sent (don't report a model the bridge silently overrode);
- handle the `tools` and `instructions` that `doPromptTurn`/`doContinueTurn` may receive: if the runtime can't take custom `tools`, throw `HarnessCapabilityUnsupportedError` so it's obvious rather than silently dropped; if it has no native `instructions` input, prepend them to the first user message (the Codex/Claude Code workaround);
- quote interpolated paths (`workDir`, bridge-state dir, …) when building shell commands for `sandbox.run`/`sandbox.spawn` — they can contain spaces.

If the runtime needs in-sandbox setup, expose `getBootstrap()`.

### 5. Implement Runtime-Specific Concerns

Add only the concerns the runtime needs:

- auth resolution — for AI Gateway support, use the central `getAiGatewayAuthFromEnv()` helper rather than reading env directly. This ensures both `VERCEL_OIDC_TOKEN` and `AI_GATEWAY_API_KEY` are accepted as Gateway credential. When the runtime resolves provider per model, resolve the provider from the model id and set that provider's env; if routing through the gateway, note that base-URL conventions differ per provider (e.g. an Anthropic client appends `/v1/messages` to a root base, an OpenAI client appends to a `/v1` base);
- AI Gateway client attribution — follow the convention in existing harness packages: define a versioned client app value such as `ai-sdk/harness-<name>/${VERSION}` and use it for Gateway requests. Configure both `User-Agent` and `x-client-app` headers when the underlying runtime/SDK supports both; at least one of those two headers is required. If the runtime cannot set arbitrary headers directly, use the runtime-supported equivalent that produces one of those headers (e.g. an SDK client-app environment variable);
- custom-tool schema translation — if you convert host tools' JSON Schema into the runtime's tool format, convert _recursively_ (nested objects, array `items`, enums, descriptions); a flat top-level-only conversion silently drops the model's structured guidance. Passing the JSON Schema through directly, if the runtime accepts it, avoids the problem;
- skill or discovery-file materialization;
- native protocol to harness stream/control translation;
- lifecycle state schema;
- bridge protocol and diagnostics.

Certain structural conventions for harness adapters are being enforced via the `konsistent` CLI.
Run `pnpm konsistent` once you're done to check for those. Fix any violations flagged before proceeding.

### 6. Write Tests

Add focused Node tests for:

- factory metadata and settings;
- auth resolution;
- sandbox usage and path placement;
- host-driven remote operations or bridge protocol behavior;
- prompt/control event translation;
- resume session vs continue turn behavior;
- unsupported capability errors;
- skill materialization, if supported.

Use mocked sandbox sessions and bridge/runtime boundaries where possible. Do not require live provider credentials in unit tests.

`getBootstrap()` reads the _compiled_ bridge assets (e.g. `dist/bridge/index.mjs`), which don't exist when tests run against `src`, so a test that calls it will hit `ENOENT`. Mock `node:fs/promises` `readFile` for the bridge asset paths (see the Codex/OpenCode harness tests for the pattern).

### 7. Add README

Keep README short:

- package purpose;
- setup command;
- minimal `HarnessAgent` usage;
- required sandbox capabilities, such as ports for bridge-backed runtimes;
- notable auth configuration.

Link to the main harness docs for broader concepts.

### 8. Add Examples

Add relevant examples for the new harness.

- Add API/function examples under `examples/ai-functions` when the harness package needs a scriptable provider-behavior example.
- Add interactive examples mirroring the existing harness examples in `examples/harness-e2e-next` (Next.js) and `examples/harness-e2e-tui` (TUI).

### 9. Add Documentation

Create documentation in `content/providers/02-ai-sdk-harnesses/<next number>-<name>.mdx`.

Include:

- Setup instructions
- Required sandbox capabilities
- Authentication configuration
- Harness-specific options
- Usage examples
- Known limitations

Update `content/docs/03-ai-sdk-harnesses/05-harness-adapters.mdx` to list the new harness when it is ready to be public.

### 10. Update References and Validate

Run from the workspace root:

```bash
pnpm konsistent
pnpm update-references
pnpm --filter @ai-sdk/harness-<name> build
pnpm --filter @ai-sdk/harness-<name> test
pnpm type-check:full
```

Add a changeset with `pnpm changeset`. For a brand-new harness package's first release, use `major` (not the usual `patch`), matching the other harness packages.

Run relevant harness examples against a live sandbox **early** — don't rely on unit tests and `type-check` alone. Runtime API constraints (e.g. unexpected config-option rejections, the exact streaming event names the runtime emits, gateway base-URL format) surface only when the bridge actually drives the runtime, and they're far cheaper to find before the docs/examples are built on top.

## Checklist

- [ ] Package structure created in `packages/harness-<name>`
- [ ] `package.json` configured with correct dependencies
- [ ] TypeScript configs set up (`tsconfig.json`, `tsconfig.build.json`)
- [ ] Build configuration (`tsup.config.ts`)
- [ ] Test configuration (`vitest.node.config.js`)
- [ ] Harness adapter implementation complete
- [ ] Runtime placement handled without creating a hidden sandbox
- [ ] Bridge assets copied during build, if bridge-backed
- [ ] Auth resolution implemented, if needed
- [ ] AI Gateway requests include `User-Agent` and/or `x-client-app` client attribution
- [ ] Harness infra, skills, bridge code, and secrets kept out of `sessionWorkDir`
- [ ] Session resume and turn continuation tested
- [ ] Unit tests written and passing
- [ ] README.md written
- [ ] `CHANGELOG.md` added (package heading; required by `konsistent`)
- [ ] Changeset added (`major` for a first release)
- [ ] Examples added
- [ ] Documentation added in `content/providers/02-ai-sdk-harnesses/`
- [ ] Harness adapter list updated, if public
- [ ] Validated against a live sandbox (not just unit tests / type-check)
- [ ] `pnpm update-references` run
- [ ] Package build passing
- [ ] Package tests passing
- [ ] Type checking passing (`pnpm type-check:full` from root)
- [ ] Relevant examples run successfully

## Related Documentation

- [Harness Abstraction Architecture](../../architecture/harness-abstraction.md)
- [`@ai-sdk/harness` README](../../packages/harness/README.md)
- Existing harness packages with similar runtime placement
