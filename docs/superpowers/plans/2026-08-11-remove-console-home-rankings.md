# Remove Console Home and Rankings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Home and Rankings from the authenticated Flatkey console header while leaving every other navigation surface unchanged.

**Architecture:** Keep `buildTopNavLinks` as the console header's single link builder. Change only its ordered output and focused unit tests; do not alter shared route definitions, sidebar data, public website navigation, or backend module parsing.

**Tech Stack:** React 19, TypeScript, Node test runner through Bun, ESLint, Prettier, Rsbuild

---

### Task 1: Lock the reduced console header contract

**Files:**
- Modify: `web/default/src/hooks/use-top-nav-links.test.ts`
- Test: `web/default/src/hooks/use-top-nav-links.test.ts`

- [ ] **Step 1: Write the failing expectation**

Rename the first test to `omits Home, Rankings, and Playground from console navigation`, remove Home and Rankings from its expected ordered array, and explicitly check all three titles are absent:

```ts
assert.deepEqual(
  links.map((link) => [link.title, link.href]),
  [
    ['Blog', '/blog'],
    ['Models', '/models'],
    ['Docs', 'https://docs.flatkey.ai/'],
    ['Pricing', '/pricing'],
    ['Compute', '/compute'],
    ['Use cases', '/usecases'],
  ]
)
for (const title of ['Home', 'Rankings', 'Playground']) {
  assert.equal(
    links.some((link) => link.title === title),
    false
  )
}
```

Rename the second test to `preserves pricing access control` and keep its Pricing `requiresAuth` assertion. Configure Rankings as enabled so the first test remains the authoritative proof that enabling the backend module cannot restore the console header link.

- [ ] **Step 2: Run the focused test and verify RED**

Run from `web/default`:

```powershell
bun test src/hooks/use-top-nav-links.test.ts
```

Expected: the ordered-link assertion fails because production code still emits Home and Rankings.

### Task 2: Remove Home and Rankings from the builder

**Files:**
- Modify: `web/default/src/hooks/use-top-nav-links.ts`
- Test: `web/default/src/hooks/use-top-nav-links.test.ts`

- [ ] **Step 1: Implement the minimal removal**

Delete the Home insertion:

```ts
links.push(websiteLink(options.translate('Home'), '/'))
```

Delete the complete Rankings block:

```ts
const rankings = options.modules.rankings
if (rankings.enabled) {
  const href = officialWebsiteUrl(websitePath('/models#leaderboard'))
  links.push({
    title: options.translate('Rankings'),
    href,
    requiresAuth: rankings.requireAuth && !options.isAuthed,
    external: href.startsWith('http'),
  })
}
```

Replace the preceding navigation comment with:

```ts
// Follow the remaining official website primary navigation order.
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run from `web/default`:

```powershell
bun test src/hooks/use-top-nav-links.test.ts
```

Expected: 2 tests pass and 0 fail.

- [ ] **Step 3: Run static and production checks**

Run from `web/default`:

```powershell
bunx eslint src/hooks/use-top-nav-links.ts src/hooks/use-top-nav-links.test.ts
bunx prettier --check src/hooks/use-top-nav-links.ts src/hooks/use-top-nav-links.test.ts
bun run typecheck
bun run build
```

Expected: all commands exit successfully. If a repository-wide baseline issue appears, isolate it from these two files and report it without widening the change.

- [ ] **Step 4: Review scope and commit**

Run from the repository root:

```powershell
git diff --check
git diff -- web/default/src/hooks/use-top-nav-links.ts web/default/src/hooks/use-top-nav-links.test.ts
```

Confirm the diff removes only Home and Rankings from the console builder, then commit the test and implementation with a Lore-compliant message documenting verification.

### Task 3: Independent verification and delivery

**Files:**
- Review: `web/default/src/hooks/use-top-nav-links.ts`
- Review: `web/default/src/hooks/use-top-nav-links.test.ts`

- [ ] **Step 1: Request an independent code review**

Ask a reviewer to confirm the implementation matches the design, retains the remaining ordered links, and does not affect the sidebar, routes, or public website navigation.

- [ ] **Step 2: Push and create a main-targeted PR**

Push `fix/remove-console-home-rankings-20260811` to `origin` and create a PR against `main` containing the scope, test evidence, and console-only deployment note.
