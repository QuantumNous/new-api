# Task 3 report: verify official root frontend migration

## Status

PARTIAL. The integration worktree already contains the official root frontend
at `web/` and has no `web/default/` or `web/classic/` trees. Docker, make, and
CI all use `web` as the sole frontend entrypoint, so no source or build
configuration changes were necessary for this task. This report records the
verification evidence and the existing frontend test failures.

## Directory and reference audit

The requested search was run:

```text
rg -n "web/default|web/classic|default/src|classic/src" \
  --glob '!docs/superpowers/evidence/**' .
```

All matches are in migration planning/specification documents. No Docker,
makefile, CI, package, or frontend source file references an obsolete frontend
path. `web/src`, `web/package.json`, `web/bun.lock`, and `web/vitest.config.ts`
are present, and the old directories do not exist in `HEAD`.

## Frontend checks

Run from `web/` with Bun 1.3.6:

- `bun install --frozen-lockfile`: passed; 1,194 packages installed.
- `bun run typecheck`: passed.
- `bun run build`: passed; Rsbuild completed in 5.00s and emitted `web/dist`.
- `bun run test --run`: **failed** with 8 failures across 3 existing test
  files (`metadata-editing.test.tsx`, `model-listing.test.tsx`, and
  `setup-guide.test.tsx`); 987 of 995 tests passed. Failures are timeout,
  model-option lookup, pricing mutation, and setup-guide visibility assertions,
  and are unrelated to a directory migration. The run also emitted jsdom
  `window.scrollTo` and Base UI `nativeButton` warnings.

The generated `web/dist` output is ignored build output and is not included in
the commit.

## Scope and concerns

No custom Agent, CXM, or rankings feature was moved in this task. Those remain
inputs for later integration tasks. The official frontend build and typecheck
are healthy; the eight frontend test failures should be triaged separately
before final integration acceptance.

