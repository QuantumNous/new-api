---
name: major-version-mode
description: "Context for working on the next AI SDK major release. Only use when explicitly invoked by the user (e.g. via '/major-version-mode'). Do NOT trigger autonomously based on task content."
metadata:
  internal: true
---

## Context

This task is part of the next AI SDK major release. Breaking changes are acceptable.

## Breaking Change Guidelines

While breaking changes are acceptable, it is still encouraged to minimize unnecessary disruption for 3P consumers of the AI SDK. Providing deprecated aliases and automated migration logic can help ease the transition.

### Renamed/changed exports

If renaming or modifying an exported function or type, provide a deprecated alias as a package-level export where feasible:

```typescript
/** @deprecated Use `newFunctionName` instead. */
export { newFunctionName as oldFunctionName } from './new-module';
```

Only do this if it doesn't introduce meaningful technical debt. If it does, skip the alias — but **check with the user first** before making a clean break.

### Modified message types (e.g. in `@ai-sdk/provider-utils`)

If modifying model message shapes (e.g. content part types in `packages/provider-utils/src/types/content-part.ts`):

1. **Deprecate in `@ai-sdk/provider-utils`** rather than removing immediately, if feasible. Mark deprecated types/members with a `@deprecated` JSDoc comment and a `TODO` note to remove in the following major version.
2. **Keep deprecated equivalents in `packages/ai/src/prompt/content-part.ts`** — this file is the consumer-facing layer and should retain the old shapes in the Zod schemas so existing consumer code continues to compile with a deprecation warning. Include a similar note about deprecation and removal in the following major version.
3. If clean deprecation isn't feasible without meaningful technical debt, a hard removal may be preferred — but **check with the user first**.

### Provider spec changes (`@ai-sdk/provider`)

The `provider` package defines the spec that provider implementers code against. It should generally not be modified outside of major versions, so keeping the spec clean and consistent is critical.

Breaking changes _without_ maintaining temporary backward compatibility measures are more acceptable here than elsewhere, because the audience is smaller — far fewer developers implement their own providers than build features on top of the AI SDK.

Rules:

- **Only modify the latest spec version.** Older versioned spec interfaces must remain completely untouched.
- Deprecated aliases are not required — a clean break is preferred to preserve spec clarity.
- The current spec version is **not** the same as the current AI SDK major version number. If it's unclear which spec version to operate on, **ask the user before proceeding**.

## Documentation

After implementing changes, update relevant documentation in `content/docs/`.

If the change requires consumers to update their code or migrate stored data, add a section to the latest migration guide:

- Find the migration guide with the highest version number in `content/docs/08-migration-guides/`
- Add a concise section explaining what changed and how to migrate
