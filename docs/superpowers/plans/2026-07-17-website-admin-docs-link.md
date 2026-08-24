# Website Admin Documentation Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing admin setting `general_setting.docs_link` control every official website header and footer documentation entry.

**Architecture:** Add a server-only public-site setting reader that fetches `${APP_CONSOLE_ORIGIN}/api/status` with a 60-second Next.js revalidation window and a 3-second timeout. Both root layouts resolve the URL once and pass it through a small client context so the interactive header and shared footer use the same normalized value, including pages such as EDM landings that do not use `SiteShell`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Bun test, Tailwind CSS.

---

## File Structure

- Create `website/src/lib/public-site-settings.ts`: parse and fetch the public documentation URL.
- Create `website/src/lib/public-site-settings.test.ts`: cover URL validation, response parsing, failure fallback, caching, and timeout signal wiring.
- Create `website/src/components/site-config-provider.tsx`: serialize the server-read documentation URL into client context.
- Create `website/src/components/site-docs-links.test.tsx`: cover desktop/mobile header links, footer order, external-link safety attributes, and hidden fallback.
- Modify `website/src/app/(en)/layout.tsx`: resolve the documentation URL for English pages.
- Modify `website/src/app/[locale]/layout.tsx`: resolve the documentation URL for localized pages.
- Modify `website/src/components/root-document.tsx`: provide the shared URL to all descendants.
- Modify `website/src/components/site-header.tsx`: insert the conditional external documentation entry after Models.
- Modify `website/src/components/site-footer.tsx`: render the conditional external documentation entry before legal links.
- Modify `website/src/lib/copy.ts`: add the localized `nav.docs` label.
- Modify `website/src/lib/copy.test.ts`: require a non-empty documentation label for every supported locale.
- Modify `docs/superpowers/specs/2026-07-17-website-admin-docs-link-design.md`: reflect the current ten-locale list and root-layout provider seam discovered during implementation mapping.

### Task 1: Public Documentation Setting Reader

**Files:**
- Create: `website/src/lib/public-site-settings.test.ts`
- Create: `website/src/lib/public-site-settings.ts`

- [ ] **Step 1: Write failing URL normalization tests**

```ts
import { afterEach, describe, expect, test } from "bun:test";
import { DOCS_LINK_REVALIDATE_SECONDS, DOCS_LINK_TIMEOUT_MS, getDocsUrl, normalizeDocsUrl } from "./public-site-settings";

describe("normalizeDocsUrl", () => {
  test("accepts trimmed HTTP and HTTPS URLs", () => {
    expect(normalizeDocsUrl("  https://docs.example.com/guide  ")).toBe("https://docs.example.com/guide");
    expect(normalizeDocsUrl("http://docs.example.com")).toBe("http://docs.example.com/");
  });

  test("rejects empty, non-string, relative, malformed, and unsafe URLs", () => {
    for (const value of [undefined, null, 42, "", "   ", "/docs", "not a url", "javascript:alert(1)", "data:text/plain,test"]) {
      expect(normalizeDocsUrl(value)).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run the normalization tests and verify RED**

Run: `cd website && bun test src/lib/public-site-settings.test.ts`

Expected: FAIL because `public-site-settings.ts` does not exist.

- [ ] **Step 3: Add response and fetch behavior tests**

```ts
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getDocsUrl", () => {
  test("reads docs_link from the public status response with bounded caching", async () => {
    let input: RequestInfo | URL | undefined;
    let init: (RequestInit & { next?: { revalidate?: number } }) | undefined;
    globalThis.fetch = ((requestInput: RequestInfo | URL, requestInit?: RequestInit) => {
      input = requestInput;
      init = requestInit;
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: { docs_link: "https://docs.example.com/start" } })));
    }) as typeof fetch;

    await expect(getDocsUrl()).resolves.toBe("https://docs.example.com/start");
    expect(String(input)).toBe("https://console.flatkey.ai/api/status");
    expect(init?.headers).toEqual({ accept: "application/json" });
    expect(init?.next?.revalidate).toBe(DOCS_LINK_REVALIDATE_SECONDS);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(DOCS_LINK_REVALIDATE_SECONDS).toBe(60);
    expect(DOCS_LINK_TIMEOUT_MS).toBe(3000);
  });

  test("returns null for non-2xx, failed envelopes, invalid payloads, and request errors", async () => {
    const results: Array<() => Promise<Response>> = [
      () => Promise.resolve(new Response("{}", { status: 503 })),
      () => Promise.resolve(new Response(JSON.stringify({ success: false, data: { docs_link: "https://docs.example.com" } }))),
      () => Promise.resolve(new Response(JSON.stringify({ success: true, data: { docs_link: "javascript:alert(1)" } }))),
      () => Promise.reject(new DOMException("Timed out", "AbortError")),
    ];

    for (const responseFactory of results) {
      globalThis.fetch = (() => responseFactory()) as typeof fetch;
      await expect(getDocsUrl()).resolves.toBeNull();
    }
  });
});
```

- [ ] **Step 4: Implement the minimal server reader**

```ts
import { APP_CONSOLE_ORIGIN } from "./origins";

export const DOCS_LINK_REVALIDATE_SECONDS = 60;
export const DOCS_LINK_TIMEOUT_MS = 3000;

type StatusPayload = {
  success?: unknown;
  data?: { docs_link?: unknown } | null;
};

export function normalizeDocsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function getDocsUrl(): Promise<string | null> {
  try {
    const response = await fetch(new URL("/api/status", APP_CONSOLE_ORIGIN), {
      headers: { accept: "application/json" },
      next: { revalidate: DOCS_LINK_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(DOCS_LINK_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as StatusPayload;
    if (payload.success !== true || !payload.data || typeof payload.data !== "object") return null;
    return normalizeDocsUrl(payload.data.docs_link);
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the focused reader tests and verify GREEN**

Run: `cd website && bun test src/lib/public-site-settings.test.ts`

Expected: all reader tests pass.

- [ ] **Step 6: Commit the reader**

Commit intent: `Read the admin documentation destination safely`

### Task 2: Shared Server-to-Client Configuration

**Files:**
- Create: `website/src/components/site-config-provider.tsx`
- Modify: `website/src/components/root-document.tsx`
- Modify: `website/src/app/(en)/layout.tsx`
- Modify: `website/src/app/[locale]/layout.tsx`

- [ ] **Step 1: Add the client context**

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";

type SiteConfig = { docsUrl: string | null };

const SiteConfigContext = createContext<SiteConfig>({ docsUrl: null });

export function SiteConfigProvider(props: SiteConfig & { children: ReactNode }) {
  return <SiteConfigContext.Provider value={{ docsUrl: props.docsUrl }}>{props.children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): SiteConfig {
  return useContext(SiteConfigContext);
}
```

- [ ] **Step 2: Pass the setting through `RootDocument`**

Add `docsUrl: string | null` to `RootDocumentProps`, import `SiteConfigProvider`, and replace `{children}` with:

```tsx
<SiteConfigProvider docsUrl={docsUrl}>{children}</SiteConfigProvider>
```

- [ ] **Step 3: Resolve the URL once in each root layout**

Import `getDocsUrl`. Make the English layout async, call `const docsUrl = await getDocsUrl()`, and pass `docsUrl={docsUrl}` to `RootDocument`. In the localized async layout, call `getDocsUrl()` after locale validation and pass the same prop.

- [ ] **Step 4: Run typecheck**

Run: `cd website && bun run typecheck`

Expected: PASS with both layouts providing the required `docsUrl` prop.

- [ ] **Step 5: Commit the configuration seam**

Commit intent: `Share one server-read website setting across page chrome`

### Task 3: Localized Header and Footer Entries

**Files:**
- Modify: `website/src/lib/copy.test.ts`
- Create: `website/src/components/site-docs-links.test.tsx`
- Modify: `website/src/lib/copy.ts`
- Modify: `website/src/components/site-header.tsx`
- Modify: `website/src/components/site-footer.tsx`

- [ ] **Step 1: Write failing copy and component tests**

Add to `copy.test.ts`:

```ts
describe("documentation copy", () => {
  test("provides a documentation label for every supported locale", () => {
    for (const locale of LOCALES) expect(getCopy(locale).nav.docs).toBeTruthy();
  });
});
```

Create `site-docs-links.test.tsx` that wraps both components with:

```tsx
<SiteConfigProvider docsUrl="https://docs.example.com/start">
  <SiteHeader locale="en" pathname="/" />
</SiteConfigProvider>
```

and:

```tsx
<SiteConfigProvider docsUrl="https://docs.example.com/start">
  <SiteFooter locale="en" />
</SiteConfigProvider>
```

Assert the header contains two documentation links (desktop and mobile), every documentation anchor has `target="_blank"` and `rel="noopener noreferrer"`, Models occurs before Documentation and Documentation before Use Case, the footer documentation link occurs before Terms of Service, and a provider with `docsUrl={null}` renders no documentation anchor.

- [ ] **Step 2: Run the focused UI tests and verify RED**

Run: `cd website && bun test src/lib/copy.test.ts src/components/site-docs-links.test.tsx`

Expected: FAIL because `nav.docs` and the rendered links do not exist.

- [ ] **Step 3: Add localized labels**

Add `docs: string` to `Copy["nav"]` and these values to the existing locale blocks:

```ts
en: "Documentation"
zh: "文档"
es: "Documentación"
fr: "Documentation"
pt: "Documentação"
ru: "Документация"
ja: "ドキュメント"
vi: "Tài liệu"
de: "Dokumentation"
```

The staged `id` locale continues to use the existing `withIdFallback` English fallback, so every current `LOCALES` entry remains non-empty without duplicating the full Indonesian copy block.

- [ ] **Step 4: Render the header entry**

Read `docsUrl` from `useSiteConfig()`. Define a typed navigation item shape with optional `external`, insert the documentation item immediately after Models when `docsUrl` is non-null, and branch desktop/mobile rendering so external items use:

```tsx
<a href={item.href} target="_blank" rel="noopener noreferrer">{item.label}</a>
```

Internal items continue to use `Link` plus `localizePath()`.

- [ ] **Step 5: Render the footer entry**

Mark `site-footer.tsx` as a client component, read `docsUrl` from `useSiteConfig()`, and insert this fragment after copyright and before `<LegalLinks>`:

```tsx
{docsUrl ? (
  <>
    <span aria-hidden="true" className="text-muted-foreground/30">·</span>
    <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors duration-200">
      {getCopy(props.locale).nav.docs}
    </a>
  </>
) : null}
```

- [ ] **Step 6: Run focused UI tests and verify GREEN**

Run: `cd website && bun test src/lib/copy.test.ts src/components/site-docs-links.test.tsx`

Expected: all copy and documentation-link tests pass.

- [ ] **Step 7: Commit the visible entries**

Commit intent: `Expose the admin documentation link across website chrome`

### Task 4: Documentation Reconciliation and Full Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-17-website-admin-docs-link-design.md`

- [ ] **Step 1: Reconcile implementation facts in the design**

Change the locale count from nine to ten, note that Indonesian currently follows the repository's staged English fallback, and replace the `SiteShell`-only data-flow wording with root-layout single read → `SiteConfigProvider` → header/footer. Preserve the same product behavior, cache, timeout, validation, and deployment decisions.

- [ ] **Step 2: Run all website tests**

Run: `cd website && bun test`

Expected: new tests pass; record the known unrelated baseline perf-metrics failures separately if they remain.

- [ ] **Step 3: Run static and production-build verification**

Run separately from `website/`:

```text
bun run typecheck
bun run lint
bun run build
```

Expected: each command exits 0.

- [ ] **Step 4: Run repository scope checks**

Run:

```text
git diff --check
git status --short
git diff --stat origin/main...HEAD
```

Expected: no whitespace errors; only the design/plan and `website/` implementation files are changed.

- [ ] **Step 5: Commit final documentation and verification adjustments**

Commit intent: `Keep the approved design aligned with the implemented website seam`

- [ ] **Step 6: Perform final completion verification**

Inspect the final commit range, confirm the feature branch is clean, and report deployment advice:

- Router deploy: not required.
- Other deploy targets: `newapi-web` required; `newapi-console`, legacy `newapi`, database, Terraform, and Cloudflare not required.
- Runtime validation: after deploying `newapi-web`, change the existing backend documentation link and verify desktop header, mobile header, and footer converge on the same URL within about 60 seconds.
