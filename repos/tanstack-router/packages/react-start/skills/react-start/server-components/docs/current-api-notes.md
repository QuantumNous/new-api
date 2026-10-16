# Current API notes and stale example corrections

Validated against official TanStack Start, TanStack Router, TanStack blog, and Vite docs on 2026-04-13.

## Current setup shape

Use the current RSC setup:

- React 19+
- Vite 7+
- `@vitejs/plugin-rsc`
- `tanstackStart({ rsc: { enabled: true } })`
- `rsc()`
- `viteReact()`

## Current high-level APIs

Prefer:

- `renderServerComponent`
- `createCompositeComponent`
- `CompositeComponent`

Use low-level APIs only for custom transport:

- `renderToReadableStream`
- `createFromReadableStream`
- `createFromFetch`

## Current validation API

Use `.validator(...)` on `createServerFn`.

Important because some current RSC docs snippets still show the older `.validator(...)` spelling. Normalize those examples before copying them into real code.

## Current constraints

- RSC support is still experimental
- TanStack custom serialization is not available inside RSCs yet
- slot args must stay Flight-serializable
- `structuralSharing: false` is mandatory for Query-cached RSC values

## Stale example traps to avoid

### Old `renderRsc` examples

You may still find older official repo examples using `renderRsc` and older config shapes. Do not cargo-cult them into new code. Normalize to the current docs and current `@tanstack/react-start/rsc` APIs.

### Old validation snippets

If you see `.validator(z.object(...))` in an RSC example, rewrite it to `.validator(z.object(...))` to match the current server function API.

### Old Vite config shapes

If an example enables Start but does not also install and register `@vitejs/plugin-rsc`, treat it as stale for current TanStack Start RSC setup.

## Maintenance rule

When docs, examples, and repo snippets disagree:

1. prefer the current TanStack Start docs
2. prefer the current TanStack blog announcement over older repo samples
3. cross-check with current Server Functions and Execution Model docs
4. then normalize all local examples to one coherent modern API surface

## Official source list

- TanStack Start Server Components docs
- TanStack Start Server Functions docs
- TanStack Start Execution Model docs
- TanStack Start Import Protection docs
- TanStack Router Data Loading docs
- TanStack blog: React Server Components Your Way
- Vite docs for `@vitejs/plugin-rsc`
