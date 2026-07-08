# PLG Models Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `https://flatkey.ai/zh/models` display natural-traffic (`plg`) pricing and model performance metrics only, without changing existing default API behavior.

**Architecture:** Keep the existing metrics collection and database schema unchanged because metrics are already stored by `model_name + group + bucket_ts`. Add an explicit, allowlisted `group=plg` read path for website-facing pricing and performance queries, and update only the public website models page to request that group-specific view. Existing default endpoints must continue returning their current mixed/public-visible behavior, and public website proxies must not forward arbitrary group names.

**Tech Stack:** Go 1.22+, Gin, GORM, React 19, Next.js 16 App Router, TypeScript, Bun.

---

## Requirements Summary

- The public models directory at `/models` and localized variants such as `/zh/models` must show the PLG/natural-traffic view.
- Pricing by group must show only `plg` pricing, even though `plg` is not marked visible in the admin "group pricing" UI.
- Performance metrics must show only `plg` data:
  - Overview TPS / average latency / success rate.
  - Performance tab top cards.
  - Per-group table.
  - Latency and availability charts.
- Existing default API behavior must not change:
  - `/api/perf-metrics/summary?hours=24` remains mixed active-groups behavior.
  - `/api/perf-metrics?model=x&hours=24` remains all active groups for that model.
  - `/api/website/pricing` remains current public-visible group behavior.
- New public website group behavior is allowlisted:
  - `plg` is the only supported explicit public website group.
  - Unsupported explicit groups such as `company-employees` must be rejected rather than forwarded.
  - If production `GroupRatio` does not contain `plg`, fail closed with a clear error; do not silently fall back to ratio `1`.
- No change to metric collection, `perf_metrics` table schema, flush logic, or TPS/latency/success-rate formulas.

## Lead Answers To Review Questions

- Public website performance endpoints must accept only default/no-group behavior and explicit `group=plg`. Arbitrary group performance exposure is not intentional.
- If production `GroupRatio` does not contain `plg`, return a visible error for PLG-specific endpoints. Do not return PLG-looking pricing with ratio `1`.
- The first implementation may display raw `plg` only if product accepts it. If a customer-facing label is desired, use a display-only website mapping with i18n and keep backend group identity as `plg`.
- `/api/website/pricing` and `/api/perf-metrics*` are fetched by the website through `APP_CONSOLE_ORIGIN`, so the primary Go deploy target is `newapi-console` or whichever Go service backs `console.flatkey.ai`, not router nodes by default.
- To avoid cache-key ambiguity, prefer a distinct website path or no-store behavior for PLG-specific JSON responses. Do not rely on unspecified CDN/LB query-string cache behavior.

## Current Evidence

- `controller/perf_metrics.go` currently builds summary groups from all configured ratios plus `auto`, so summary mixes groups by default.
- `pkg/perf_metrics.Query` already accepts `QueryParams.Group`, so detail metrics can already query `group=plg`.
- `model/perf_metric.go` stores metrics by `model_name`, `group`, and `bucket_ts`, so the required grouping dimension already exists.
- `controller/pricing.go` currently builds `/api/website/pricing` from `service.GetUserUsableGroups("")`, which drops hidden groups such as `plg`.
- `website/src/lib/pricing.ts` has a shared `getPricingData()` used by `/models`, sitemap generation, and model landing pages. Add an optional group parameter instead of changing the default call behavior.
- `website/src/components/pricing-model-browser.tsx` fetches `/api/perf-metrics/summary?hours=24` and `/api/perf-metrics?model=...&hours=24`; these calls must become explicitly PLG-scoped for the models directory.

## Non-Goals

- Do not change how relay requests are sampled.
- Do not add a new database table or migration.
- Do not change enterprise/customer group routing or billing.
- Do not make `plg` visible in the admin "group pricing" selector just to support the public website.
- Do not alter default API responses used by existing console/dashboard consumers.

## File Map

- Modify `controller/perf_metrics.go`
  - Add optional summary query filtering only for allowlisted `group=plg`.
  - Keep no-group summary behavior unchanged.
- Modify `controller/pricing.go`
  - Add a website-only explicit PLG pricing branch for `/api/website/pricing?group=plg`.
  - Reject unsupported explicit website pricing groups.
  - Fail closed if `plg` is not configured in `GroupRatio`.
  - Keep `/api/website/pricing` unchanged.
  - Avoid poisoning the existing single-body pricing cache with group-specific payloads.
- Modify or add tests near `controller/pricing_test.go`
  - Cover default pricing cache behavior.
  - Cover PLG website pricing branch.
- Add tests for `controller/perf_metrics.go` covering default/no-group, `group=plg`, unsupported group rejection, and missing `GroupRatio.plg`.
- Modify `website/src/lib/pricing.ts`
  - Add optional `group` argument to pricing URL/data helpers.
  - Preserve default behavior when omitted.
- Modify `website/src/components/pricing-explorer.tsx` and `website/src/components/pricing-model-browser.tsx`
  - Update `usableGroup` prop types to `Record<string, string>`.
  - Remove any `.ratio` reads from `usableGroup`; pricing ratios must come from `groupRatio`.
- Modify `website/src/components/pricing-page.tsx`
  - Make `ModelsPage` request PLG pricing via `getPricingData("plg")`.
  - Do not change sitemap/model landing calls unless product explicitly expands scope.
- Modify `website/src/app/api/perf-metrics/route.ts`
  - Support only the PLG website group; do not forward arbitrary group values.
- Modify `website/src/app/api/perf-metrics/summary/route.ts`
  - Support only the PLG website group; do not forward arbitrary group values.
- Modify `website/src/components/pricing-model-browser.tsx`
  - Fetch summary/detail metrics with `group=plg`.
  - Ensure the performance panel gracefully renders one group row.
- Update frontend tests near `website/src/components/pricing-model-browser.test.ts` and/or `website/src/lib/pricing.test.ts`.

## Implementation Steps

### Task 1: Add Allowlisted PLG Filtering To Performance Summary

**Files:**
- Modify: `controller/perf_metrics.go`

- [ ] **Step 1: Keep default behavior intact**

  Read `GetPerfMetricsSummary`. It currently does:

  ```go
  activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
  result, err := perfmetrics.QuerySummaryAll(hours, activeGroups)
  ```

  This no-query behavior must remain exactly the same.

- [ ] **Step 2: Add explicit PLG-only group branch**

  If `c.Query("group")` is empty, keep default behavior. If it is non-empty, allow only `plg`.

  Target shape:

  ```go
  activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
  if group := strings.TrimSpace(c.Query("group")); group != "" {
      if group != websitePublicGroup {
          c.JSON(http.StatusBadRequest, gin.H{
              "success": false,
              "message": "unsupported performance metrics group",
          })
          return
      }
      if !ratio_setting.ContainsGroupRatio(websitePublicGroup) {
          c.JSON(http.StatusServiceUnavailable, gin.H{
              "success": false,
              "message": "public website group is not configured",
          })
          return
      }
      activeGroups = []string{websitePublicGroup}
  }
  result, err := perfmetrics.QuerySummaryAll(hours, activeGroups)
  ```

  Import `strings`. Define the constant only once in `package controller`, for example in a small shared file such as `controller/website_public_group.go`:

  ```go
  package controller

  const websitePublicGroup = "plg"
  ```

  Do not define `websitePublicGroup` separately in both `controller/perf_metrics.go` and `controller/pricing.go`; duplicate package-level const names in the same Go package will not compile.

- [ ] **Step 3: Keep existing detail endpoint behavior but add PLG config guard**

  `GetPerfMetrics` already passes `Group: c.Query("group")` into `perfmetrics.Query`, so no default behavior needs to change. To keep the website path consistent, add only this new-parameter guard:

  ```go
  if strings.TrimSpace(c.Query("group")) == websitePublicGroup && !ratio_setting.ContainsGroupRatio(websitePublicGroup) {
      c.JSON(http.StatusServiceUnavailable, gin.H{
          "success": false,
          "message": "public website group is not configured",
      })
      return
  }
  ```

  Do not reject non-PLG groups here in this plan, because the detail endpoint already accepted arbitrary `group` before this change and existing authenticated/console consumers may rely on that. The website proxy will enforce PLG-only forwarding.

  Explicit boundary: direct Go detail metrics remain legacy-compatible for arbitrary `group` query values. PLG-only enforcement for detail metrics is implemented at the website proxy and website UI layer.

- [ ] **Step 4: Add tests and manual checks**

  Add tests for:

  - No group keeps default mixed behavior.
  - `group=plg` uses only `[]string{"plg"}`.
  - `group=company-employees` returns 400 from summary.
  - `group=plg` returns 503 when `plg` is missing from `GroupRatio`.

  Manual smoke:

  Run locally or against a running server:

  ```bash
  curl -s 'http://localhost:3000/api/perf-metrics/summary?hours=24' | jq '.success, .data.models | length'
  curl -s 'http://localhost:3000/api/perf-metrics/summary?hours=24&group=plg' | jq '.success, .data.models[0]'
  curl -i 'http://localhost:3000/api/perf-metrics/summary?hours=24&group=company-employees'
  ```

  Expected:
  - First command still returns existing mixed summary.
  - Second command returns only metrics contributed by `plg`.
  - Third command returns 400.

### Task 2: Add Website PLG Pricing Branch Without Changing Default Pricing

**Files:**
- Modify: `controller/pricing.go`
- Test: `controller/pricing_test.go`

- [ ] **Step 1: Protect current default cache behavior**

  `getCachedWebsitePricingJSON()` currently caches a single default payload. Do not reuse this cache for `group=plg`; otherwise a PLG request can poison the default response for 5 minutes.

  Keep this default path:

  ```go
  func GetWebsitePricing(c *gin.Context) {
      body, err := getCachedWebsitePricingJSON()
      ...
  }
  ```

  Only branch before the cache when `group` is present.

- [ ] **Step 2: Add explicit PLG-only group support**

  Use the shared `websitePublicGroup` constant created in Task 1. Do not redeclare it in `controller/pricing.go`, because `controller/pricing.go` and `controller/perf_metrics.go` are both in `package controller`.

  ```go
  if group := strings.TrimSpace(c.Query("group")); group != "" {
      if group != websitePublicGroup {
          c.JSON(http.StatusBadRequest, gin.H{
              "success": false,
              "message": "unsupported website pricing group",
          })
          return
      }
      ...
  }
  ```

  In `GetWebsitePricing`, if `group := strings.TrimSpace(c.Query("group")); group != ""`, allow only the shared `websitePublicGroup`.

  Recommended behavior for unsupported groups:

  ```go
  c.JSON(http.StatusBadRequest, gin.H{
      "success": false,
      "message": "unsupported website pricing group",
  })
  return
  ```

  This avoids accidentally exposing hidden enterprise group pricing through a guessed query parameter.

- [ ] **Step 3: Build PLG pricing payload and fail closed if missing**

  Add helper:

  ```go
  func buildWebsitePricingPayloadForGroup(group string) (gin.H, error) {
      pricing := model.GetPricing()
      groupRatioCopy := ratio_setting.GetGroupRatioCopy()
      ratio, ok := groupRatioCopy[group]
      if !ok {
          return nil, fmt.Errorf("public website group %q is not configured", group)
      }

      usableGroup := map[string]string{
          group: setting.GetUsableGroupDescription(group),
      }
      if strings.TrimSpace(usableGroup[group]) == "" {
          usableGroup[group] = group
      }

      return gin.H{
          "success":            true,
          "data":               filterPricingByUsableGroups(pricing, usableGroup),
          "vendors":            model.GetVendors(),
          "group_ratio":        map[string]float64{group: ratio},
          "usable_group":       usableGroup,
          "supported_endpoint": model.GetSupportedEndpointMap(),
          "auto_groups":        []string{},
          "pricing_version":    "website-public-plg-v1",
      }, nil
  }
  ```

  Note: import `fmt`, `net/http`, `strings`, and `setting` if not already present.

- [ ] **Step 4: Marshal PLG payload separately**

  For `group=plg`, call `buildWebsitePricingPayloadForGroup(group)`. If it returns an error, return `503` with `success: false`; do not fall back to ratio `1`.

  Then call `common.Marshal(payload)` and return `c.Data(200, ...)`.

  Do not write this body into `websitePricingCache`.

  For PLG-specific responses, use either:

  ```go
  c.Header("Cache-Control", "no-store")
  ```

  or a distinct endpoint path in a follow-up. Minimal implementation should prefer `no-store` for the query-param branch to avoid any edge cache that does not key by query string.

- [ ] **Step 5: Add tests**

  In `controller/pricing_test.go`, add focused tests:

  - Default `/api/website/pricing` still uses `getCachedWebsitePricingJSON()` behavior.
  - `buildWebsitePricingPayloadForGroup("plg")` returns:
    - `success: true`
    - `group_ratio` containing only `plg`
    - `usable_group` containing `plg` even if `plg` is not globally visible
    - `data` items whose `enable_groups` are filtered to `plg`
  - Missing `GroupRatio.plg` returns an error and the handler returns 503.
  - Unsupported group query returns 400 from handler-level test if an existing Gin handler test pattern is available.

### Task 3: Make Website Pricing Helper Group-Aware

**Files:**
- Modify: `website/src/lib/pricing.ts`
- Test: `website/src/lib/pricing.test.ts`

- [ ] **Step 1: Fix/confirm `usable_group` response shape everywhere**

  The Go pricing endpoints currently return `usable_group` as `map[string]string` (`group -> description`), while the website TypeScript type currently declares `Record<string, { desc: string; ratio: number }>` in `PricingApiResponse`.

  Before adding group support, correct the TypeScript type to match the actual API:

  ```ts
  type PricingApiResponse = {
    success: boolean;
    message?: string;
    data?: PricingModel[];
    vendors?: PricingVendor[];
    group_ratio?: Record<string, number>;
    usable_group?: Record<string, string>;
    supported_endpoint?: Record<string, string>;
    auto_groups?: string[];
  };

  export type PricingData = {
    models: PricingModel[];
    vendors: PricingVendor[];
    groupRatio: Record<string, number>;
    usableGroup: Record<string, string>;
    supportedEndpoint: Record<string, unknown>;
    autoGroups: string[];
  };
  ```

  Then update every website type and prop that carries `usableGroup` from `Record<string, { desc: string; ratio: number }>` to `Record<string, string>`, including:

  - `getAvailableGroups(...)`
  - `enrichVendorNames(...)`
  - `PricingExplorer` props in `website/src/components/pricing-explorer.tsx`
  - `PricingModelBrowser` props in `website/src/components/pricing-model-browser.tsx`
  - `ModelDetailsDrawer`
  - `GroupPricingSection`

  Price ratio must come only from `group_ratio` / `props.groupRatio`. Remove `.ratio` fallbacks such as:

  ```ts
  props.usableGroup[group]?.ratio
  ```

  Replace with:

  ```ts
  props.groupRatio[group] ?? 1
  ```

  or, where model-specific ratios are already available, continue to use `formatGroupTokenPrice(...)` / `getGroupRatio(...)`. Do not introduce a second ratio source under `usable_group`.

- [ ] **Step 2: Add optional group parameter**

  Change:

  ```ts
  export function publicPricingUrl(apiBaseUrl = API_BASE_URL): string {
    return `${apiBaseUrl}/api/website/pricing`;
  }
  ```

  To:

  ```ts
  export function publicPricingUrl(apiBaseUrl = API_BASE_URL, group?: string): string {
    const url = new URL("/api/website/pricing", apiBaseUrl);
    if (group) url.searchParams.set("group", group);
    return url.toString();
  }
  ```

- [ ] **Step 3: Add optional group to data fetch**

  Change:

  ```ts
  export async function getPricingData(): Promise<PricingData>
  ```

  To:

  ```ts
  export async function getPricingData(group?: string): Promise<PricingData>
  ```

  Then call `fetch(publicPricingUrl(API_BASE_URL, group), ...)`.

- [ ] **Step 4: Preserve default consumers**

  Verify these default calls still compile and keep old behavior:

  - `website/src/app/sitemap.ts`
  - `website/src/app/(en)/models/[slug]/page.tsx`
  - `website/src/app/[locale]/models/[slug]/page.tsx`

- [ ] **Step 5: Add unit tests**

  Add or update tests to assert:

  ```ts
  expect(publicPricingUrl("https://console.flatkey.ai")).toBe("https://console.flatkey.ai/api/website/pricing");
  expect(publicPricingUrl("https://console.flatkey.ai", "plg")).toBe("https://console.flatkey.ai/api/website/pricing?group=plg");
  ```

### Task 4: Scope `/models` Page Pricing To PLG

**Files:**
- Modify: `website/src/components/pricing-page.tsx`

- [ ] **Step 1: Add a local constant**

  Near the model page implementation:

  ```ts
  const PUBLIC_MODELS_GROUP = "plg";
  ```

- [ ] **Step 2: Make only `ModelsPage` request PLG pricing**

  Change:

  ```ts
  const pricing = await getPricingData();
  ```

  To:

  ```ts
  const pricing = await getPricingData(PUBLIC_MODELS_GROUP);
  ```

  This scopes only the public models directory. Do not change sitemap or model landing pages in this task.

- [ ] **Step 3: Confirm pricing table output**

  The existing `enrichVendorNames(...)` and `PricingModelBrowser` flow should receive:

  - `groupRatio = { plg: 0.9 }`
  - `usableGroup` containing `plg`
  - model `enable_groups` filtered to `plg`

  The existing "Pricing by group" table should then show only one row.

### Task 5: Pass PLG Through Website Performance Proxy

**Files:**
- Modify: `website/src/app/api/perf-metrics/route.ts`
- Modify: `website/src/app/api/perf-metrics/summary/route.ts`

- [ ] **Step 1: Add local allowlist helper**

  In both route files, define a tiny helper or inline check:

  ```ts
  const PUBLIC_MODELS_GROUP = "plg";

  function applyPublicGroup(source: URLSearchParams, target: URL): NextResponse | null {
    const group = source.get("group");
    if (!group) return null;
    if (group !== PUBLIC_MODELS_GROUP) {
      return NextResponse.json({ success: false, message: "Unsupported performance metrics group" }, { status: 400 });
    }
    target.searchParams.set("group", PUBLIC_MODELS_GROUP);
    return null;
  }
  ```

  Keep it file-local to avoid broader abstractions. If repeated code bothers the executor, create a tiny helper only if there is already a nearby API utility pattern.

- [ ] **Step 2: Detail proxy should forward only PLG**

  In `route.ts`, after model/hours handling:

  ```ts
  const groupError = applyPublicGroup(source, target);
  if (groupError) return groupError;
  ```

  Default calls without `group` remain unchanged.

- [ ] **Step 3: Summary proxy should forward only PLG**

  In `summary/route.ts`:

  ```ts
  const groupError = applyPublicGroup(request.nextUrl.searchParams, target);
  if (groupError) return groupError;
  ```

  Default calls without `group` remain unchanged.

- [ ] **Step 4: Add route tests**

  Add route-handler tests covering:

  - No `group` query does not add `group` to the target URL.
  - `group=plg` forwards `group=plg`.
  - `group=company-employees` returns 400 and does not proxy upstream.

### Task 6: Scope Models Browser Performance Fetches To PLG

**Files:**
- Modify: `website/src/components/pricing-model-browser.tsx`
- Test: `website/src/components/pricing-model-browser.test.ts`

- [ ] **Step 1: Add group constant**

  Add:

  ```ts
  const PUBLIC_MODELS_GROUP = "plg";
  ```

  If the same constant is also needed in `pricing-page.tsx`, prefer a tiny shared export only if there is already a nearby constants pattern. Otherwise duplicate the string in the two website files to keep the change small.

- [ ] **Step 2: Update summary fetch**

  Change:

  ```ts
  fetch("/api/perf-metrics/summary?hours=24", ...)
  ```

  To construct URLSearchParams:

  ```ts
  const params = new URLSearchParams({ hours: "24", group: PUBLIC_MODELS_GROUP });
  const response = await fetch(`/api/perf-metrics/summary?${params.toString()}`, ...);
  ```

- [ ] **Step 3: Update model detail fetch**

  Change:

  ```ts
  const params = new URLSearchParams({ model: modelName, hours: "24" });
  ```

  To:

  ```ts
  const params = new URLSearchParams({ model: modelName, hours: "24", group: PUBLIC_MODELS_GROUP });
  ```

- [ ] **Step 4: Keep rendering behavior simple**

  Do not add special-case UI. The existing group table will naturally render one `plg` row when the API returns one group.

- [ ] **Step 5: Add or update tests**

  Tests are mandatory. If the current file does not expose fetch helpers, either export narrow test-only helpers or test through the component path already used in `pricing-model-browser.test.ts`.

  Assert the requested URLs include `group=plg` for:

  - Summary fetch.
  - Model detail fetch.

## Acceptance Criteria

- `GET /api/perf-metrics/summary?hours=24` response semantics are unchanged.
- `GET /api/perf-metrics/summary?hours=24&group=plg` returns summary values calculated only from PLG buckets.
- `GET /api/perf-metrics/summary?hours=24&group=company-employees` returns 400 or equivalent explicit rejection.
- `GET /api/perf-metrics?model=claude-opus-4-8&hours=24&group=plg` returns only the `plg` group.
- `GET /api/website/pricing` response semantics are unchanged.
- `GET /api/website/pricing?group=plg` returns:
  - `group_ratio` with only `plg`.
  - `usable_group` with `plg`.
  - model rows filtered to models usable by `plg`.
  - model `enable_groups` filtered to `["plg"]`.
- `GET /api/website/pricing?group=company-employees` returns 400 or equivalent explicit rejection.
- If `GroupRatio.plg` is missing, PLG-specific pricing and summary paths fail closed instead of using ratio `1`.
- `/zh/models` pricing drawer shows one PLG/natural-traffic row in "Pricing by group".
- `/zh/models` performance drawer shows PLG-only metrics and no enterprise groups such as `Claude Official` or `company-employees`.
- Existing sitemap and model landing pages keep their current pricing fetch behavior unless explicitly changed in a follow-up.

## Verification Commands

Run from repository root:

```bash
go test ./controller/... ./pkg/perf_metrics/...
```

Run from website:

```bash
cd website
bun test
bun run typecheck
bun run build
```

Manual local smoke, with the Go app and website running against the same backend:

```bash
curl -s 'http://localhost:3000/api/perf-metrics/summary?hours=24' | jq '.success'
curl -s 'http://localhost:3000/api/perf-metrics/summary?hours=24&group=plg' | jq '.success, .data.models[0]'
curl -i 'http://localhost:3000/api/perf-metrics/summary?hours=24&group=company-employees'
curl -s 'http://localhost:3000/api/website/pricing' | jq '.success'
curl -s 'http://localhost:3000/api/website/pricing?group=plg' | jq '.group_ratio, .usable_group, (.data[0].enable_groups)'
curl -i 'http://localhost:3000/api/website/pricing?group=company-employees'
```

Manual website smoke:

```bash
cd website
bun run dev
```

Open `http://localhost:4000/zh/models`, select a model, and verify:

- Overview metrics are PLG-only.
- Performance tab has only `plg` in the per-group table.
- Pricing by group has only the PLG row.

## Risks And Mitigations

- **Risk:** Group-specific pricing response poisons default `/api/website/pricing` cache.
  - **Mitigation:** Do not use `getCachedWebsitePricingJSON()` for non-empty group queries, or refactor the cache to be keyed by group. The minimal implementation should bypass the default cache for `group=plg`.
- **Risk:** Generic `group` query exposes hidden enterprise pricing or performance data.
  - **Mitigation:** For website-facing pricing and performance paths, allow only `plg`. Return 400 for other explicit groups.
- **Risk:** Summary endpoint default behavior changes and impacts dashboard consumers.
  - **Mitigation:** Only branch when `group` query is non-empty. Add default no-group regression tests and manual response comparison.
- **Risk:** Edge/LB/CDN cache does not key by query string.
  - **Mitigation:** PLG-specific query-param responses should use `Cache-Control: no-store`, or the implementation should use a distinct route path before enabling public caching. Do not assume query strings are in the cache key without checking Cloudflare/LB behavior.
- **Risk:** Production lacks `GroupRatio.plg`.
  - **Mitigation:** Fail closed for PLG-specific endpoints and add a pre-deploy config check. Do not silently use ratio `1`.
- **Risk:** Public UI leaks internal group name `plg`.
  - **Mitigation:** Initial minimal implementation can show `plg` for operational clarity. If product wants a customer-facing label, add a display-only mapping in the website UI without changing backend group identity.
- **Risk:** PLG has no pricing for a model that enterprise groups support.
  - **Mitigation:** This is desired for natural-traffic accuracy. Models without PLG availability should not be shown in the PLG-only public directory.

## Deployment Notes

- Router deploy: not required by default. These changes affect `/api/website/pricing` and `/api/perf-metrics*`, which the website calls through `APP_CONSOLE_ORIGIN` (`console.flatkey.ai`) rather than router `/v1` traffic. Mark router deploy `unclear` only if production currently routes these `/api` paths through router nodes.
- Other deploy targets: `newapi-console` required first for the Go API changes; `newapi-web` required second for the website changes. Legacy `newapi` is required only if it still serves the console/API origin in the active LB path.
- Rollout order:
  1. Deploy Go console/API service.
  2. Verify `https://console.flatkey.ai/api/website/pricing?group=plg`.
  3. Verify unsupported group rejection for pricing and performance summary.
  4. Deploy website service.
  5. Verify `https://flatkey.ai/zh/models` displays PLG-only pricing and metrics.
- Database migration: not required.
- Metric backfill: not required.
- Config prerequisite: production `GroupRatio` must contain `plg`; PLG-specific endpoints should fail closed if it is missing.

## Rollback Plan

- Revert website changes first to stop requesting PLG-specific pricing/metrics.
- Revert Go optional group branches if needed.
- Since no schema or collection logic changes are made, rollback does not require data repair.
