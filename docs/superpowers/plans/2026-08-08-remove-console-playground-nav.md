# Remove Console Playground Top Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Playground from the Flatkey console header without changing sidebar access or the Playground route.

**Architecture:** Keep `buildTopNavLinks` as the single header-navigation builder and delete only its unconditional Playground website-link insertion. Lock the remaining order and absence of Playground in the existing focused unit test.

**Tech Stack:** React 19, TypeScript, Bun test runner, Rsbuild

---

### Task 1: Remove the console header Playground link

**Files:**
- Modify: `web/default/src/hooks/use-top-nav-links.test.ts`
- Modify: `web/default/src/hooks/use-top-nav-links.ts`

- [ ] **Step 1: Write the failing test**

Update the expected top-navigation order to omit Playground and add an explicit absence assertion:

```ts
assert.deepEqual(
  links.map((link) => [link.title, link.href]),
  [
    ['Home', '/'],
    ['Blog', '/blog'],
    ['Models', '/models'],
    ['Docs', 'https://docs.flatkey.ai/'],
    ['Rankings', '/models#leaderboard'],
    ['Pricing', '/pricing'],
    ['Compute', '/compute'],
    ['Use cases', '/usecases'],
  ]
)
assert.equal(
  links.some((link) => link.title === 'Playground'),
  false
)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from `web/default`:

```powershell
bun test src/hooks/use-top-nav-links.test.ts
```

Expected: the ordered-link assertion fails because the production builder still emits `['Playground', '/playground']`.

- [ ] **Step 3: Implement the minimal removal**

Delete only this block from `buildTopNavLinks`:

```ts
links.push(
  websiteLink(
    options.translate('Playground (website navigation)'),
    '/playground'
  )
)
```

- [ ] **Step 4: Run focused and broader verification**

Run from `web/default`:

```powershell
bun test src/hooks/use-top-nav-links.test.ts
bun run typecheck
bun run build
```

Expected: two focused tests pass, TypeScript reports no errors, and Rsbuild completes successfully.

- [ ] **Step 5: Review and commit**

Run from the repository root:

```powershell
git diff --check
git diff -- web/default/src/hooks/use-top-nav-links.ts web/default/src/hooks/use-top-nav-links.test.ts
```

Confirm the sidebar data and `/playground` route are untouched, then commit with a Lore-compliant message recording the narrow scope and verification evidence.
