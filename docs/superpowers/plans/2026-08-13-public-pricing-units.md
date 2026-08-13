# Public Pricing Units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return display-ready per-second, per-request, and per-million-token prices from the existing public pricing API and render those units throughout the website with legacy-response fallback.

**Architecture:** Add one service-level display-pricing builder that derives public decimal-string prices from the same runtime pricing and video-rule sources used by billing. Inject its model-keyed output into both v1 website payload builders, then centralize frontend parsing and formatting so every surface prefers the additive contract and falls back to the old numeric fields.

**Tech Stack:** Go, Gin, shopspring/decimal, TypeScript, React, Next.js, Bun tests, GitNexus.

---

## File structure

- Modify `service/website_pricing.go` to define and build the reusable display-pricing map.
- Modify `service/website_pricing_test.go` to cover video/request/token price derivation.
- Modify `controller/pricing.go` to add `display_pricing` to both v1 payload shapes.
- Modify `controller/pricing_test.go` to lock the additive controller contract.
- Modify `website/src/lib/pricing.ts` to parse the map and provide shared display-price resolution.
- Modify `website/src/lib/pricing.test.ts` to cover new-field precedence and old-field fallback.
- Modify `website/src/lib/home-models.ts` and its tests for per-row units and `from`.
- Modify `website/src/components/models-directory-table.tsx` and its tests to remove the fixed token-only header claim.
- Modify `website/src/components/pricing-model-browser.tsx` and its tests to render per-second/request/token units.
- Modify `website/src/lib/model-public.ts`, `website/src/components/model-public-page.tsx`, and their tests to carry and render units per price row.

### Task 1: Build display-ready backend prices

**Files:**
- Modify: `service/website_pricing.go`
- Modify: `service/website_pricing_test.go`

- [ ] **Step 1: Write failing service tests**

Add tests that call a private builder with injected video rules and pricing-source values. Assert a two-tier video model returns the lowest `second` price with `from=true`, a one-tier model has no `from`, request models return `request`, token models return `input/output/image/cache/audio_*`, and invalid video rows are skipped.

- [ ] **Step 2: Run tests to verify RED**

Run `go test ./service -run 'TestBuildWebsiteDisplayPricing' -count=1`.

Expected: FAIL because the display-pricing builder and per-second price key do not exist.

- [ ] **Step 3: Implement the minimal builder**

Add `WebsiteDisplayPricing`, extend `WebsiteDisplayPrices` with `Second`, and add optional `From` to `WebsitePricePair`. Extend the injected source with `VideoPriceRules()`. Implement `BuildWebsiteDisplayPricing(pricing, group)` plus a private testable form. Reuse the current decimal price-pair helpers and token math; never copy rule metadata.

- [ ] **Step 4: Verify GREEN**

Run `gofmt -w service/website_pricing.go service/website_pricing_test.go` followed by `go test ./service -run 'TestBuildWebsite(DisplayPricing|PricingV2)' -count=1`.

Expected: PASS.

### Task 2: Add display pricing to the existing v1 endpoint

**Files:**
- Modify: `controller/pricing.go`
- Modify: `controller/pricing_test.go`

- [ ] **Step 1: Write failing payload tests**

Inject a display-pricing builder in controller tests and assert both `buildWebsitePricingPayloadDefault` and `buildWebsitePublicGroupPricingPayload` expose `display_pricing` alongside the unchanged `data` field. Assert the builder receives only already-visible models.

- [ ] **Step 2: Run tests to verify RED**

Run `go test ./controller -run 'TestBuildWebsite.*DisplayPricing' -count=1`.

Expected: FAIL because neither payload contains `display_pricing`.

- [ ] **Step 3: Implement additive payload integration**

Add a package-level builder seam calling `service.BuildWebsiteDisplayPricing`. Invoke it after visibility filtering in both payload builders. On error, log and return an empty map while preserving the legacy payload.

- [ ] **Step 4: Verify GREEN**

Run `gofmt -w controller/pricing.go controller/pricing_test.go` followed by `go test ./controller -run 'Test(BuildWebsite|GetWebsitePricing)' -count=1`.

Expected: PASS.

### Task 3: Parse and resolve display prices in one frontend module

**Files:**
- Modify: `website/src/lib/pricing.ts`
- Modify: `website/src/lib/pricing.test.ts`

- [ ] **Step 1: Write failing parsing and resolver tests**

Assert `getPricingData("plg")` attaches model-keyed display data. Test resolver results for `per_second`, `request`, and `token`; verify decimal strings, `from`, and unit. Add malformed display-price cases that use the legacy price formulas, plus a payload with no new field.

- [ ] **Step 2: Run tests to verify RED**

Run `bun test src/lib/pricing.test.ts` from `website`.

Expected: FAIL because the display types and resolver are missing.

- [ ] **Step 3: Implement types, parser, and resolver**

Define the display contract and a `resolveModelDisplayPrice` helper. Parse only finite non-negative decimal strings. Prefer `plg` for visitor prices and `configured` for list prices; preserve the old `quota_type/model_ratio/model_price` calculations as fallback.

- [ ] **Step 4: Verify GREEN**

Run `bun test src/lib/pricing.test.ts` from `website`.

Expected: PASS.

### Task 4: Render correct units on model directory rows

**Files:**
- Modify: `website/src/lib/home-models.ts`
- Modify: `website/src/lib/home-models-plg-pricing.test.ts`
- Modify: `website/src/components/models-directory-table.tsx`
- Modify: `website/src/components/models-directory-table.test.tsx`

- [ ] **Step 1: Write failing row and component tests**

Add a multi-tier video model and assert `from $... / second`; add request and token models and assert `/ request` and `/ 1M tokens`. Render the directory table and assert its header no longer claims every row is token-priced.

- [ ] **Step 2: Run tests to verify RED**

Run `bun test src/lib/home-models-plg-pricing.test.ts src/components/models-directory-table.test.tsx` from `website`.

Expected: FAIL because rows only append `/req` and the header is fixed to per-million tokens.

- [ ] **Step 3: Implement row-aware formatting**

Build directory rows from the shared resolver. Carry the unit inside the price strings (or a dedicated row field) and replace the fixed header sublabel with neutral copy while retaining the existing columns and layout.

- [ ] **Step 4: Verify GREEN**

Run the same Bun command and expect PASS.

### Task 5: Render units in pricing cards and public model pages

**Files:**
- Modify: `website/src/components/pricing-model-browser.tsx`
- Modify: `website/src/components/pricing-model-browser.test.ts`
- Modify: `website/src/lib/model-public.ts`
- Modify: `website/src/lib/model-public.test.ts`
- Modify: `website/src/components/model-public-page.tsx`

- [ ] **Step 1: Write failing view-model tests**

Assert pricing cards/drawer helpers and `buildModelPublicView` return `from`, price text, and per-row unit for video, request, and token models. Assert legacy token models retain input/output and optional dimension rows.

- [ ] **Step 2: Run tests to verify RED**

Run `bun test src/components/pricing-model-browser.test.ts src/lib/model-public.test.ts` from `website`.

Expected: FAIL because both surfaces assume only request or token units.

- [ ] **Step 3: Use the shared resolver throughout both surfaces**

Replace fixed `/1M` and `/request` rendering with resolver units. Add a `unit` field to public price rows and render it in `model-public-page.tsx`. Preserve legacy group breakdown behavior when no display contract exists.

- [ ] **Step 4: Verify GREEN**

Run the same Bun command and expect PASS.

### Task 6: Integration verification and review

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run targeted Go tests**

Run `go test ./service ./controller -count=1`.

Expected: PASS.

- [ ] **Step 2: Run website tests and static checks**

From `website`, run `bun test`, the package typecheck command, lint command, and production build command declared in `package.json`.

Expected: all commands exit 0.

- [ ] **Step 3: Run repository hygiene checks**

Run `git diff --check` and `gitnexus detect-changes`.

Expected: no whitespace errors; GitNexus reports only intended pricing flows.

- [ ] **Step 4: Perform spec and quality reviews**

Compare the diff to the design requirement by requirement, then review error handling, compatibility, exported names, duplicated calculation logic, and test adequacy. Resolve every important finding and repeat affected verification.
