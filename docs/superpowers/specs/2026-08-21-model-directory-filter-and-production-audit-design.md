# Model Directory Filters and Production Metadata Audit

## Outcome

The public `/models` directory must filter the complete in-memory model list without requesting filtered pages from the backend. The filter behavior must match the approved product rules, use the same final prices that the table displays, and remain restorable from the URL.

Before production launch, the project must also produce a read-only completeness report for the production model catalog. The report proposes missing metadata and possible backfill values, but it must never write to the production database. An operator reviews the report and performs any database updates separately.

## Existing baseline

The staging branch already contains the main directory surfaces:

- `website/src/components/models-directory.tsx` builds normalized rows once, owns filter state, mirrors state to the URL, and renders the sidebar and table.
- `website/src/components/models-filter-sidebar.tsx` renders expandable groups and filter chips.
- `website/src/lib/model-directory-filters.ts` contains the filter engine, facet counts, sorting, and row normalization.
- `website/src/lib/model-directory-meta.ts` and `model-directory-meta-data.ts` contain metadata not supplied by the live pricing payload.
- `website/src/lib/model-directory-url.ts` serializes and restores filter state.
- Existing tests cover the current faceted behavior.

The implementation should extend these boundaries instead of introducing a second filter system.

## Approved filter semantics

### Data loading

- The directory receives the complete model list, currently about 104 models.
- Filtering and facet counting run entirely in the browser over the normalized rows.
- No filtered-list API, pagination API, database query, or search service is required.

### Boolean composition

- Options inside the same multi-select group use OR.
- Different filter groups use AND.
- Missing or invalid data does not exclude a model until the corresponding filter is active.
- When a filter is active, a model with missing or invalid data for that dimension does not match.

### Group cardinality

- `modalities`, `inputPrice`, `outputPrice`, `vendors`, `providers`, `series`, `categories`, and `age` remain multi-select groups.
- `context` is single-select.
- `distillable` is single-select.
- Search text and sort order remain independent of group cardinality.

### Context length

- The existing labels remain unchanged: `8K+`, `128K+`, `200K+`, `400K+`, and `1M`.
- Despite those labels, the approved matching rule is an upper bound: a selected value matches `0 < contextTokens <= selectedValue`.
- A model with `contextTokens = null`, zero, negative, or non-finite does not match an active context filter.
- Selecting another context option replaces the previous selection rather than accumulating values.

### Price

- Price bands cover every billing unit: per token, per request, and per second.
- Values are not converted between billing units. A numeric price of `0.6` belongs to `$0.5-$1` whether its unit is `/1M tokens`, `/request`, or `/second`.
- Filtering must use the same final Flatkey price that the table displays, including the same provider/group selection and fallback behavior.
- For token-priced models, input and output filters use their respective final displayed input and output prices.
- For per-request and per-second models, the single final displayed price is used as both `inputFilterPrice` and `outputFilterPrice` so the model can participate in either price group.
- Multiple provider prices do not independently trigger a match. Only the price finally selected for display is considered.
- Price bands use non-overlapping half-open ranges:
  - `< $0.5`: `0 < price < 0.5`
  - `$0.5-$1`: `0.5 <= price < 1`
  - `$1-$2`: `1 <= price < 2`
  - `$2-$5`: `2 <= price < 5`
  - `$5-$10`: `5 <= price < 10`
  - `$10+`: `price >= 10`
- Null, zero, negative, and non-finite prices do not match an active price filter.

### Remaining groups

- Modalities match when the model supports any selected input modality.
- Vendors represent model authors.
- Providers represent official service platforms.
- Series, categories, and age match when any selected option is present.
- Distillable matches one of `true` or `false`; selecting one replaces the other.
- Existing canonical naming and alias handling must prevent variants such as `MiniMax` and `Minimax` from becoming accidental duplicate facets.

### URL and reset behavior

- Every active filter remains encoded in the URL so reload, back/forward navigation, and shared links restore the same view.
- URL parsing must tolerate legacy arrays for `context` and `distillable`, normalizing them to one selected value.
- Reset clears search, all filter groups, and sort state back to `rank`.
- Existing crawlable legacy `vendor` URLs remain supported.

## Normalized row contract

Filtering uses one normalized record per displayed model. The existing `DirectoryRow` can evolve to expose these effective fields:

```ts
type BillingUnit = "token" | "request" | "second";

type DirectoryRow = {
  name: string;
  author: string;
  providers: string[];
  modalities: Modality[];
  contextTokens: number | null;
  series?: string;
  categories: string[];
  releasedAt?: string | null;
  age?: AgeBand;
  distillable?: boolean;

  billingUnit?: BillingUnit;
  displayPrice?: number;
  inputFilterPrice?: number;
  outputFilterPrice?: number;
  inputBand?: PriceBandId;
  outputBand?: PriceBandId;
};
```

The display-price selection stays owned by the existing pricing/home-model normalization. The filter engine consumes the resolved values and must not reimplement provider or group-price selection.

## Component and module changes

### `model-directory-filters.ts`

- Change context matching from minimum/lower-bound logic to single-value upper-bound logic.
- Add a reusable single-select replacement rule for `context` and `distillable` or expose enough metadata for the URL toggle layer to apply it.
- Accept effective input/output filter prices derived from the displayed price.
- Preserve OR-within-group, AND-across-groups, search, sorting, and facet-count semantics.
- Facet counts for single-select groups show the result count for replacing the current selection with that option.

### `model-directory-url.ts`

- Serialize `context` and `distillable` with at most one value.
- When parsing old URLs containing several values, keep one deterministic value and discard the rest.
- Toggling the active single-select option clears that group; toggling another option replaces it.

### `models-directory.tsx`

- Pass the final displayed billing unit and final displayed price into `buildDirectoryRow`.
- Token models retain separate input/output prices.
- Per-request and per-second models feed their final displayed price into both price-filter fields.
- Do not derive price filters by reparsing arbitrary localized table copy when a numeric display-price field is already available.

### `models-filter-sidebar.tsx`

- Keep current user-visible labels and layout.
- Reflect single-selection through `aria-pressed` without presenting context or distillable as simultaneous selections.
- Collapsed groups must hide descendants from keyboard navigation and the accessibility tree, not merely set `tabIndex=-1` while leaving them exposed.

## Production metadata audit

### Scope and safety

- The audit is read-only.
- It reads the production model/pricing catalog through an approved read-only source, preferably the production website-pricing API used by the website. Direct database credentials are not required for the website implementation.
- It compares every production model against the filter metadata and effective price data required by this design.
- It generates files locally and exits. It must not execute SQL, call mutation endpoints, or modify production records.

### Required checks

For every production model, report the status of:

- model identifier and display name
- author/vendor
- providers
- input modalities
- context length
- billing unit (`token`, `request`, or `second`)
- final displayed input/output or single-unit price
- series
- categories/use cases
- release date
- distillable status
- canonical alias resolution

The audit must distinguish:

- genuinely not applicable values, such as token context for some image/video/audio models
- missing values that block an active filter
- invalid values, such as negative prices, invalid dates, or unknown billing units
- unrecognized production models absent from the metadata table
- stale metadata entries whose model no longer exists in production

### Report output

Generate both JSON and Markdown so machines and operators can use the same evidence. Each model issue contains:

```ts
type AuditIssue = {
  modelId: string;
  modelName: string;
  field: string;
  status: "missing" | "invalid" | "unknown-model" | "stale-metadata";
  currentValue: unknown;
  suggestedValue?: unknown;
  suggestedSource?: string;
  confidence?: "high" | "medium" | "low";
  affectedFilters: string[];
  backfillSqlEligible: boolean;
  reviewStatus: "pending";
};
```

The Markdown summary groups issues by severity and affected filter, lists totals, and clearly states that no production write was performed. Suggested values without a trustworthy source remain blank rather than being guessed.

### Operator workflow

1. Run the audit against the production read-only catalog before launch.
2. Review missing, invalid, unknown, and stale entries.
3. Research and approve suggested values separately.
4. Add approved data to the production database or canonical metadata source outside this audit command.
5. Re-run the audit and require no launch-blocking gaps.

## Failure handling

- If production data cannot be fetched, the audit exits non-zero and does not emit a misleading successful report.
- If one record is malformed, the audit records an invalid-data issue and continues evaluating other records.
- The public page retains existing empty/fetch-failure behavior and must not crash because filter metadata is incomplete.
- Unknown billing units and invalid effective prices are treated as missing for active price filters and are surfaced by the audit.
- Alias collisions are report errors; the implementation must not silently merge two distinct models or providers.

## Testing and acceptance criteria

### Unit tests

- Context selection replaces the previous value.
- Context matching implements `0 < contextTokens <= selectedValue` for every bucket.
- Legacy multi-context URLs normalize deterministically.
- Distillable is single-select and can be cleared.
- Multi-select groups preserve OR semantics; different groups preserve AND semantics.
- Positive price boundary values fall into exactly one band; zero remains unpriced.
- Token input/output prices filter independently.
- Per-request and per-second display prices participate in both input and output price filters.
- Missing/invalid fields match only while their filter is inactive.
- Facet counts use replacement semantics for single-select groups.
- URL round-tripping preserves the normalized state.

### Audit tests

- Complete fixtures produce zero issues.
- Missing, invalid, unknown-model, stale-metadata, and alias-collision fixtures produce deterministic issues.
- The report includes affected filters and never claims a production write.
- Fetch failure exits non-zero.
- Suggestions without sources are not invented.

### Project verification

Run from `website/`:

```bash
bun test
bun run lint
bun run typecheck
bun run build
```

Browser acceptance checks cover the English and Chinese `/models` pages, URL restoration, reset, mobile filter disclosure, price units, context replacement, distillable replacement, and keyboard/screen-reader behavior for collapsed groups.

## Deployment and operational impact

- Website-only runtime changes deploy to `newapi-web`; router deployment is not required.
- The audit command is local/read-only tooling and has no runtime or multi-node coordination requirement.
- No database migration is part of this implementation.
- Production metadata changes happen only after operator review and through a separately approved database update process.

## Non-goals

- Server-side filtered pagination or search.
- Currency or billing-unit normalization.
- Automatic production database writes.
- Guessing unknown model facts.
- Changing the approved context labels.
- Redesigning the visual filter layout.

## Approved decisions

- Full model list is filtered client-side.
- Same-group filters use OR; different groups use AND.
- Context and distillable are single-select.
- Context is an upper-bound filter while labels remain unchanged.
- Price bands cover token, request, and second billing without unit conversion.
- Per-request/per-second display price participates in both input and output filters.
- Multi-provider models filter by the final table price only.
- Active filters exclude missing or invalid values.
- Production audit reports first; the operator reviews before any database update.
