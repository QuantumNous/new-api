# Database-backed Model Directory Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make database rows the only runtime source for all non-price `/models` filters while preserving the existing live pricing and billing-unit pipeline.

**Architecture:** Add an exact-name `model_directory_metadata` table and a tested repository boundary in the Go model layer. The existing `GET /api/website/pricing?group=plg` handler clones visible pricing rows and attaches one optional `directory_metadata` object per exact model name. A dry-run/apply CLI performs reviewed, transactional upserts; the website parses this API object and removes all runtime static metadata imports.

**Tech Stack:** Go 1.x, GORM, SQLite/MySQL/PostgreSQL, Gin, Next.js 16, React 19, TypeScript, Bun test.

---

### Task 1: Database entity, validation, lookup, and migration

**Files:**
- Create: `model/model_directory_metadata.go`
- Create: `model/model_directory_metadata_test.go`
- Modify: `model/main.go:327-427`

- [ ] **Step 1: Write the failing entity and migration registration tests**

Add tests that open an isolated in-memory SQLite database, assign it to `model.DB`, and assert:

```go
func TestModelDirectoryMetadataMigrationIsRegistered(t *testing.T) {
    names := map[string]bool{}
    for _, migration := range orderedMigrationModels() {
        names[migration.name] = true
    }
    require.True(t, names["ModelDirectoryMetadata"])
}

func TestModelDirectoryMetadataExactNameIsUnique(t *testing.T) {
    db := setupModelDirectoryMetadataTestDB(t)
    first := validModelDirectoryMetadata("gpt-test")
    require.NoError(t, db.Create(&first).Error)
    duplicate := validModelDirectoryMetadata("gpt-test")
    require.Error(t, db.Create(&duplicate).Error)
}
```

Add validation tests for empty author/series/lists, duplicate or whitespace list values, unsupported modalities, invalid dates, non-positive non-null context, and invalid ranks. Add lookup tests proving disabled rows and unrequested names are omitted.

- [ ] **Step 2: Run the model tests and verify RED**

Run:

```powershell
go test ./model -run ModelDirectoryMetadata -count=1
```

Expected: compilation failure because `ModelDirectoryMetadata`, validation, lookup, and migration registration do not exist.

- [ ] **Step 3: Implement the entity and public view**

Create the database entity and API-safe view:

```go
type ModelDirectoryMetadata struct {
    ID             int64  `json:"id" gorm:"primaryKey"`
    ModelName      string `json:"model_name" gorm:"size:191;not null;uniqueIndex"`
    Author         string `json:"author" gorm:"size:128;not null"`
    ProvidersJSON  string `json:"-" gorm:"type:text;not null"`
    ModalitiesJSON string `json:"-" gorm:"type:text;not null"`
    ContextTokens  *int64 `json:"context_tokens,omitempty"`
    Series         string `json:"series" gorm:"size:128;not null"`
    CategoriesJSON string `json:"-" gorm:"type:text;not null"`
    ReleasedAt     string `json:"released_at" gorm:"type:varchar(10);not null"`
    Distillable    bool   `json:"distillable" gorm:"not null"`
    PopularityRank *int   `json:"popularity_rank,omitempty"`
    TopTenRank     *int   `json:"top_ten_rank,omitempty"`
    Status         int    `json:"status" gorm:"default:1;index"`
    CreatedTime    int64  `json:"created_time" gorm:"bigint"`
    UpdatedTime    int64  `json:"updated_time" gorm:"bigint"`
}

type ModelDirectoryMetadataView struct {
    Author         string   `json:"author"`
    Providers      []string `json:"providers"`
    Modalities     []string `json:"modalities"`
    ContextTokens  *int64   `json:"context_tokens"`
    Series         string   `json:"series"`
    Categories     []string `json:"categories"`
    ReleasedAt     string   `json:"released_at"`
    Distillable    bool     `json:"distillable"`
    PopularityRank *int     `json:"popularity_rank,omitempty"`
    TopTenRank     *int     `json:"top_ten_rank,omitempty"`
}
```

Use `common.Marshal` and `common.Unmarshal` for JSON. Implement normalization, `ValidateModelDirectoryMetadata`, `ToView`, and `GetEnabledModelDirectoryMetadataMap(modelNames []string)` with one `WHERE model_name IN ? AND status = ?` query.

- [ ] **Step 4: Register the migration**

Add `{&ModelDirectoryMetadata{}, "ModelDirectoryMetadata"}` immediately after `Model`/`Vendor` in `orderedMigrationModels()` so all three supported databases create the table through the existing migration path.

- [ ] **Step 5: Run GREEN verification**

Run:

```powershell
go test ./model -run ModelDirectoryMetadata -count=1
go test ./model -run 'Migration|SQLite' -count=1
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit the database slice**

Commit with a Lore message recording exact-name isolation, cross-database JSON text storage, and the selected tests.

### Task 2: Attach database metadata to the existing public pricing endpoint

**Files:**
- Modify: `model/pricing.go`
- Modify: `controller/pricing.go`
- Modify: `controller/pricing_test.go`

- [ ] **Step 1: Write failing payload tests**

Add controller tests that replace a package-level metadata loader and verify:

```go
func TestBuildWebsitePublicGroupPricingPayloadAttachesExactDirectoryMetadata(t *testing.T) {
    // Two visible pricing rows, one exact metadata row.
    // Assert only the matching row contains directory_metadata.
}

func TestBuildWebsitePublicGroupPricingPayloadKeepsPricingWhenMetadataLookupFails(t *testing.T) {
    // Loader returns an error.
    // Assert both pricing rows still return and neither has directory_metadata.
}
```

Also assert the source pricing slice is not mutated and disabled/missing rows cannot be attached.

- [ ] **Step 2: Run the controller tests and verify RED**

Run:

```powershell
go test ./controller -run 'WebsitePublicGroupPricingPayload.*DirectoryMetadata' -count=1
```

Expected: compilation or assertion failure because the response field and loader do not exist.

- [ ] **Step 3: Add the response field and clone/attach helper**

Add this non-database field to `model.Pricing`:

```go
DirectoryMetadata *ModelDirectoryMetadataView `json:"directory_metadata,omitempty"`
```

In `controller/pricing.go`, introduce a test-replaceable loader:

```go
var getEnabledModelDirectoryMetadataMap = model.GetEnabledModelDirectoryMetadataMap
```

Implement a helper that copies the visible pricing slice, loads metadata once by exact names, attaches pointers on the copies, logs lookup errors, and returns the unmodified copies without metadata on failure. Use the helper in `buildWebsitePublicGroupPricingPayload` before returning `data`.

- [ ] **Step 4: Run GREEN and contract verification**

Run:

```powershell
go test ./controller -run 'WebsitePublicGroupPricingPayload|GetWebsitePricing' -count=1
go test ./service -run WebsitePricing -count=1
```

Expected: all selected tests pass and existing pricing fields remain unchanged.

- [ ] **Step 5: Commit the API slice**

Commit with a Lore message explaining that metadata lookup is fail-soft while pricing remains available.

### Task 3: Reviewed dry-run/apply import workflow and initial dataset

**Files:**
- Modify: `model/model_directory_metadata.go`
- Modify: `model/model_directory_metadata_test.go`
- Create: `cmd/model_directory_metadata/main.go`
- Create: `cmd/model_directory_metadata/main_test.go`
- Create: `data/model-directory/metadata.json`

- [ ] **Step 1: Write failing import tests**

Define an import document containing exact metadata rows and test:

- duplicate names fail before a transaction starts;
- invalid rows produce field-specific errors;
- dry-run reports inserts/updates/unchanged rows and performs zero writes;
- apply upserts all rows in one transaction;
- applying the same document twice is idempotent;
- a failed row rolls back the whole apply;
- no default production DSN exists in the command.

The intended model API is:

```go
type ModelDirectoryMetadataImportResult struct {
    Inserts   []string `json:"inserts"`
    Updates   []string `json:"updates"`
    Unchanged []string `json:"unchanged"`
}

func PlanModelDirectoryMetadataImport(db *gorm.DB, rows []ModelDirectoryMetadata) (ModelDirectoryMetadataImportResult, error)
func ApplyModelDirectoryMetadataImport(db *gorm.DB, rows []ModelDirectoryMetadata) (ModelDirectoryMetadataImportResult, error)
```

- [ ] **Step 2: Run import tests and verify RED**

Run:

```powershell
go test ./model ./cmd/model_directory_metadata -run ModelDirectoryMetadataImport -count=1
```

Expected: compilation failure because the import planner/apply functions and command do not exist.

- [ ] **Step 3: Implement transactional import logic**

Normalize and validate the entire document first. Plan changes by exact `model_name`, then use `db.Transaction` plus GORM `OnConflict` upsert for apply. Set timestamps through `common.GetTimestamp`. Never infer a DSN or environment.

- [ ] **Step 4: Implement the CLI**

Support exactly:

```text
go run ./cmd/model_directory_metadata --file <path> --dry-run
go run ./cmd/model_directory_metadata --file <path> --apply
```

Require one mode, require `SQL_DSN`, call `common.InitEnv()` and `model.InitDB()`, print the plan as JSON, and exit non-zero on validation or database errors. Do not expose an HTTP write route.

- [ ] **Step 5: Convert the reviewed candidate dataset**

Convert the current base plus staging-preview metadata into `data/model-directory/metadata.json`. Preserve exact names and normalized values; do not invent values for newly discovered production gaps. The import artifact may exist in git, but runtime code must not read it.

- [ ] **Step 6: Run GREEN and dry-run verification**

Run:

```powershell
go test ./model ./cmd/model_directory_metadata -run ModelDirectoryMetadataImport -count=1
go run ./cmd/model_directory_metadata --file data/model-directory/metadata.json --dry-run
```

Expected: tests pass; the command refuses to run without an explicit `SQL_DSN`, proving there is no implicit production target. Then rerun against a disposable SQLite DSN and confirm the expected insert count with no rows written.

- [ ] **Step 7: Commit the import slice**

Commit with a Lore message stating that runtime never reads the import artifact and production apply remains approval-gated.

### Task 4: Make the website consume API metadata only

**Files:**
- Modify: `website/src/lib/pricing.ts`
- Modify: `website/src/lib/pricing.test.ts`
- Modify: `website/src/lib/model-directory-meta.ts`
- Modify: `website/src/lib/model-directory-filters.ts`
- Modify: `website/src/lib/model-directory-filters.test.ts`
- Modify: `website/src/lib/home-models.ts`
- Modify: `website/src/lib/home-models-plg-pricing.test.ts`
- Modify: `website/src/components/models-directory.tsx`
- Modify: `website/src/lib/model-directory-meta.test.ts`
- Delete: `website/src/lib/model-directory-meta-data.ts`
- Delete: `website/src/lib/model-directory-meta-staging-preview.ts`
- Modify: `website/Dockerfile`
- Modify: `.github/workflows/gcp-deploy-website-staging.yml`

- [ ] **Step 1: Write failing API parsing and filtering tests**

Extend `PricingModel` with an optional parsed object:

```ts
export type ModelDirectoryMetadata = {
  author: string;
  providers: string[];
  modalities: string[];
  context_tokens: number | null;
  series: string;
  categories: string[];
  released_at: string;
  distillable: boolean;
  popularity_rank?: number;
  top_ten_rank?: number;
};
```

Add tests proving malformed metadata is dropped, valid metadata survives parsing, every metadata-driven facet reads the payload object, and no test imports `MODEL_DIRECTORY_META`.

- [ ] **Step 2: Run website tests and verify RED**

Run:

```powershell
cd website
bun test src/lib/pricing.test.ts src/lib/model-directory-filters.test.ts src/lib/home-models-plg-pricing.test.ts src/lib/model-directory-meta.test.ts
```

Expected: failures because the parser and row builders still depend on static metadata.

- [ ] **Step 3: Parse and propagate the API object**

Validate `directory_metadata` while parsing the pricing payload. Change `buildRowsForModels` and `buildDirectoryRow` to receive the model's parsed metadata explicitly. Continue deriving prices exclusively through the existing display-pricing and group-ratio functions.

- [ ] **Step 4: Remove runtime static metadata**

Delete both static metadata modules, remove `NEXT_PUBLIC_MODEL_DIRECTORY_STAGING_PREVIEW` from Docker and staging workflow configuration, and refactor metadata option builders to derive authors/providers/modalities/context/series/categories/age/distillable from the current API rows.

- [ ] **Step 5: Run GREEN verification**

Run:

```powershell
bun test src/lib/pricing.test.ts src/lib/model-directory-filters.test.ts src/lib/home-models-plg-pricing.test.ts src/lib/model-directory-meta.test.ts src/components/models-filter-sidebar.test.tsx src/components/models-directory-table.test.tsx
bun run typecheck
```

Expected: all selected tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit the frontend slice**

Commit with a Lore message recording removal of the static runtime fallback.

### Task 5: Integrated verification, staging backfill, and production audit

**Files:**
- Modify as required by failing integration tests only
- Regenerate: `website/reports/model-directory/production-model-directory-audit.json`
- Regenerate: `website/reports/model-directory/production-model-directory-audit.md`
- Modify: `docs/superpowers/plans/2026-08-21-production-model-directory-metadata-backfill.md`

- [ ] **Step 1: Run complete local backend verification**

Run:

```powershell
go test ./model ./controller ./service ./cmd/model_directory_metadata
go build ./...
```

Expected: zero failures.

- [ ] **Step 2: Run complete website verification**

Run:

```powershell
cd website
bun test
bun run typecheck
bun run lint
bun run build
```

Expected: no new failures; any pre-existing baseline failures must be demonstrated against `origin/main` and reported separately.

- [ ] **Step 3: Apply the reviewed dataset to staging only**

Run the importer first with `--dry-run` against the explicit staging DSN, save the insert/update counts, then rerun with `--apply`. Do not point the command at production.

- [ ] **Step 4: Deploy and verify staging**

Deploy the backend API and website staging revisions through the repository's existing staging workflows. Fetch `https://staging-console.flatkey.ai/api/website/pricing?group=plg` and assert every visible model has valid `directory_metadata`. Verify `/models` price units and all facets, including the single-select context upper bound.

- [ ] **Step 5: Generate the production read-only report**

Run the audit against the production pricing endpoint and production metadata table in read-only mode. Record exact missing/invalid/stale rows and proposed imports. Require the report to state `productionWriteExecuted=false`.

- [ ] **Step 6: Final review and PR history cleanup**

Run `git diff --check`, inspect `origin/main...HEAD`, request spec and code-quality reviews, and fix all findings. Squash the feature branch back to one Lore-compliant feature commit without changing the final tree, force-push with lease to PR #802, and verify the PR contains only the database-backed model-directory feature.
