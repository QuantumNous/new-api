---
name: vercel-react-best-practices
description: React and Next.js performance optimization guidelines from Vercel Engineering. Use when writing, reviewing, or refactoring React/Next.js code involving components, Next.js pages, Server Components, Server Actions, data fetching, bundle size, rendering behavior, or performance improvements.
---

# Vercel React Best Practices

Use this skill for React and Next.js performance work. The full Vercel guide is stored in `references/full-guide.md`; do not read the whole file by default.

## Workflow

1. Identify the relevant performance area from the task or code under review.
2. Search `references/full-guide.md` for the matching section or rule heading.
3. Read only the relevant section before changing or reviewing code.
4. Prioritize higher-impact categories before lower-impact micro-optimizations.

## Priority Order

1. Eliminating waterfalls: sequential async work, API route chains, missing `Promise.all`, Suspense boundaries.
2. Bundle size optimization: barrel imports, heavy client modules, dynamic imports, deferred third-party libraries.
3. Server-side performance: Server Actions auth, RSC serialization, per-request deduplication, cross-request caching, `after()`.
4. Client-side data fetching: SWR deduplication, global listeners, passive scroll listeners, localStorage schema.
5. Re-render optimization: derived state, effect dependencies, memo boundaries, functional state updates, transitions, refs.
6. Rendering performance: hydration mismatches, long lists, static JSX, SVG precision, resource hints, script loading.
7. JavaScript performance: repeated lookups, array passes, storage reads, layout thrashing, sort/min-max choices.
8. Advanced patterns: one-time initialization, stable callback refs, effect events.

## Reference

- Full compiled guide: `references/full-guide.md`
- Original project: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
