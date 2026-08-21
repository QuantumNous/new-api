# Production Model Directory Metadata Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every model already returned by the production pricing catalogue participate correctly in the model-directory filters, while keeping every production change reviewable and preventing any database write before explicit operator approval.

**Architecture:** The production pricing API remains the authority for live model identities and displayed prices; non-price directory metadata remains a versioned website data file. A read-only audit freezes the live catalogue, a review artifact records evidence and proposed metadata, and only an approved follow-up PR promotes reviewed staging candidates into production metadata. Catalogue/database additions for models that are not currently live are a separate change lane and are excluded from this backfill.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Bun tests/scripts, production `/api/website/pricing`, GitHub pull requests.

---

## Current production evidence (2026-08-21)

The read-only command below audited `https://console.flatkey.ai/api/website/pricing` and reported `wroteProduction: false`:

```powershell
$env:APP_CONSOLE_ORIGIN='https://console.flatkey.ai'
$env:MODEL_DIRECTORY_AUDIT_OUT_DIR='E:\workspace\.cache\model-directory-audit\2026-08-21-base'
bun run audit:model-directory
```

| Measure | Baseline | With current staging candidates |
| --- | ---: | ---: |
| Live production models | 103 | 103 |
| Metadata entries | 96 | 113 |
| Total issues | 40 | 15 |
| Unknown live models | 7 | 2 |
| Missing fields | 32 | 0 |
| Invalid fields | 1 | 1 |
| Metadata entries absent from production | 0 | 12 |
| Production writes | 0 | 0 |

The seven live production models without base metadata are:

```text
eleven_multilingual_v2
eleven_sound_v1
mirothinker-1-7-deepresearch
mirothinker-1-7-deepresearch-mini
seedance-2.0
seedance-2.0-fast
seedance-2.0-mini
```

Data ownership is explicit:

| Data | Authority | Change mechanism in this plan |
| --- | --- | --- |
| Live model identity and configured price | Production pricing catalogue/database | Read only; no write in this backfill |
| Final displayed/filter price | Production API `display_pricing`, ratio fallback | Read only; verified by audit and UI tests |
| Vendor, provider, modality, context, series, category, age, distillable | `website/src/lib/model-directory-meta-data.ts` | Approval-gated follow-up PR |
| Candidate-only metadata | `website/src/lib/model-directory-meta-staging-preview.ts` | Staging review only; production build flag remains false |

### Task 1: Freeze the production baseline and exclusion set

**Files:**
- Regenerate: `website/reports/model-directory/production-model-directory-audit.json`
- Regenerate: `website/reports/model-directory/production-model-directory-audit.md`
- Create during execution: `website/reports/model-directory/production-model-directory-backfill-review.json`
- Create during execution: `website/reports/model-directory/production-model-directory-backfill-review.md`

- [ ] **Step 1: Regenerate the read-only production audit from the exact production origin**

Run from `website/`:

```powershell
$env:APP_CONSOLE_ORIGIN='https://console.flatkey.ai'
Remove-Item Env:NEXT_PUBLIC_MODEL_DIRECTORY_STAGING_PREVIEW -ErrorAction SilentlyContinue
bun run audit:model-directory
```

Expected: 103 live models, 96 base metadata entries, 40 issues, and `No production write occurred.` If any count differs, use the new output as the baseline and explain every added or removed model in the review artifact before continuing.

- [ ] **Step 2: Record immutable evidence for every proposed change**

Create the review JSON with these top-level fields:

```json
{
  "catalogueSource": "https://console.flatkey.ai/api/website/pricing",
  "catalogueReadOnly": true,
  "baselineModelCount": 103,
  "baselineMetadataCount": 96,
  "excludedNonLiveModels": [],
  "proposedMetadata": {},
  "proposedFieldPatches": {},
  "unresolvedModels": [],
  "approvalStatus": "pending",
  "productionWriteExecuted": false
}
```

Populate the arrays and objects only from the frozen audit, the reviewed staging candidate file, and cited primary sources. The Markdown companion must render the same data for human review.

- [ ] **Step 3: Lock the twelve staging-only models out of this production backfill**

Set `excludedNonLiveModels` to this exact list because none appears in the frozen 103-model production catalogue:

```text
bytedance/seedance-2.0
bytedance/seedance-2.0-fast
claude-3-5-haiku-20241022
doubao/doubao-seedance-2-0-260128
gemini-2.0-flash
jimeng-image-4.5
jimeng-image-5.0-lite
jimeng-video-3.0-fast
jimeng-video-3.0-pro
jimeng-video-seedance-2.0
jimeng-video-seedance-2.0-fast
jimeng-video-seedance-2.0-mini
```

Expected: these names remain available only in the staging preview data. They must not be promoted into production metadata and no production catalogue insert is generated for them.

- [ ] **Step 4: Commit only refreshed evidence if the live snapshot changed**

If the counts or names changed, commit the regenerated reports and updated review artifact separately so the catalogue drift is reviewable. If the snapshot is unchanged, do not create a no-op commit.

### Task 2: Model “output price not applicable” correctly in the audit

**Files:**
- Modify: `website/src/lib/model-directory-audit.ts`
- Modify: `website/scripts/audit-model-directory-metadata.ts`
- Modify: `website/src/lib/model-directory-audit.test.ts`

- [ ] **Step 1: Add failing coverage for an embedding model with no output charge**

Add a fixture whose row includes:

```ts
{
  name: "gemini-embedding-001",
  vendor: "Google",
  billingUnit: "token",
  inputFilterUsd: 0.00015,
  outputFilterUsd: 0,
  outputPriceApplicable: false,
}
```

Assert that the audit does not create an `outputFilterUsd` issue for this row, while a generative row with `outputPriceApplicable: true` and `outputFilterUsd: 0` still creates an `invalid` issue.

- [ ] **Step 2: Run the focused test and verify the new assertion fails**

Run:

```powershell
bun test src/lib/model-directory-audit.test.ts
```

Expected: FAIL because `AuditModelDirectoryRow` does not yet support price applicability and the validator still rejects zero.

- [ ] **Step 3: Add an explicit applicability signal instead of treating zero as a positive price**

Extend the audit row and pricing validation as follows:

```ts
export type AuditModelDirectoryRow = {
  modelId?: string | number;
  name: string;
  vendor: string;
  billingUnit?: string;
  inputFilterUsd?: number | null;
  outputFilterUsd?: number | null;
  outputPriceApplicable?: boolean;
};

validatePrice(row, "inputFilterUsd", row.inputFilterUsd, ["inputPrice"], issues, suggestions);
if (row.outputPriceApplicable !== false) {
  validatePrice(row, "outputFilterUsd", row.outputFilterUsd, ["outputPrice"], issues, suggestions);
}
```

In `assembleAuditCatalogFromPricingPayload`, set `outputPriceApplicable` to true when the final display-pricing payload has an output dimension or when the legacy `completion_ratio` is greater than zero; otherwise set it to false. This preserves validation for text-generation output prices while representing embeddings as not applicable.

- [ ] **Step 4: Run the focused audit suite**

Run `bun test src/lib/model-directory-audit.test.ts`.

Expected: all audit tests pass, including embedding-not-applicable and generative-zero-invalid cases.

- [ ] **Step 5: Regenerate the production audit**

Run the Task 1 command again.

Expected on the frozen catalogue: the `gemini-embedding-001` invalid issue disappears; no positive output price is fabricated; the remaining baseline issues are 7 unknown metadata rows and 32 missing metadata fields.

### Task 3: Review the thirty-two field-level candidate patches

**Files:**
- Read: `website/src/lib/model-directory-meta-staging-preview.ts`
- Update during approval execution: `website/src/lib/model-directory-meta-data.ts`
- Update: `website/reports/model-directory/production-model-directory-backfill-review.json`
- Update: `website/reports/model-directory/production-model-directory-backfill-review.md`

- [ ] **Step 1: Copy the candidate patch map into the review artifact without promoting it**

The review must include all 26 provider patches:

```text
MiniMax-H3 -> Minimax
claude-haiku-4-5-20251001 -> Anthropic, Amazon Bedrock, Google
deepseek-v3.1 -> Alibaba, Baidu, Google
gemini-3.1-flash-tts-preview -> Google, Google AI Studio
gemini-embedding-001 -> Google, Google AI Studio
gemini-flash-latest -> Google, Google AI Studio
gemini-flash-lite-latest -> Google, Google AI Studio
gemini-pro-latest -> Google, Google AI Studio
gemini-robotics-er-1.6-preview -> Google, Google AI Studio
gemma-4-31b-it -> Google
gpt-image-2 -> OpenAI
grok-imagine-image -> xAI
grok-imagine-image-pro -> xAI
grok-imagine-image-quality -> xAI
grok-imagine-video -> xAI
grok-imagine-video-1.5 -> xAI
macaron-v1-coding-venti -> Macaron
macaron-v1-tall -> Macaron
macaron-v1-venti -> Macaron
nano-banana-pro-preview -> Google, Google AI Studio
qwen3.5-plus-2026-02-15 -> Alibaba
seedance-2.0-pro -> ByteDance
seedance-2.5 -> ByteDance
sonilo-video-to-music -> Sonilo
veo-3.1-fast-generate-preview -> Google, Google AI Studio
veo-3.1-generate-preview -> Google, Google AI Studio
```

- [ ] **Step 2: Include the four category patches and two release-date patches**

Use these exact current candidates in the review artifact:

```text
gemini-embedding-001 categories -> Technology
gemini-robotics-er-1.6-preview categories -> Science, Technology
macaron-v1-tall categories -> Programming, Marketing, SEO, Technology, Translation, Trivia
macaron-v1-venti categories -> Programming, Marketing, SEO, Technology, Translation, Trivia
gemini-flash-lite-latest releasedAt -> 2026-06-20
grok-imagine-image-pro releasedAt -> 2026-08-04
```

- [ ] **Step 3: Attach evidence and confidence to every field patch**

For `providers`, cite the production pricing row/vendor plus the provider’s official model page. For `releasedAt`, require an official release note or model-card publication date. For `categories`, record that the value is a Flatkey product taxonomy decision and cite the model capability page used to make that decision. Mark a field `approved`, `rejected`, or `needs-source`; do not promote `needs-source` values.

- [ ] **Step 4: Verify exact coverage against the audit**

Compare the review artifact to the baseline report by exact model name and field. Expected: 26/26 provider issues, 4/4 category issues, and 2/2 release-date issues each have exactly one proposed resolution and at least one evidence reference.

### Task 4: Review the five complete metadata candidates already live in production

**Files:**
- Read: `website/src/lib/model-directory-meta-staging-preview.ts`
- Update during approval execution: `website/src/lib/model-directory-meta-data.ts`
- Update: `website/reports/model-directory/production-model-directory-backfill-review.json`
- Update: `website/reports/model-directory/production-model-directory-backfill-review.md`

- [ ] **Step 1: Record the two MiroThinker proposals**

Use the same candidate for `mirothinker-1-7-deepresearch` and `mirothinker-1-7-deepresearch-mini`, with a distinct rank for each:

```ts
{
  series: "MiroThinker",
  vendor: "MiroMind AI",
  providers: ["MiroMind AI"],
  modalities: ["text", "file"],
  contextTokens: 128000,
  categories: ["Academia", "Science", "Technology"],
  distillable: true,
  releasedAt: "2026-08-01",
}
```

Require an official MiroMind model card or release page for context length, modalities, and release date. Treat categories and distillability as explicit Flatkey review decisions.

- [ ] **Step 2: Record the three Seedance proposals**

Use the same candidate for `seedance-2.0`, `seedance-2.0-fast`, and `seedance-2.0-mini`, with a distinct rank for each:

```ts
{
  series: "Seedance",
  vendor: "ByteDance",
  providers: ["ByteDance"],
  modalities: ["text", "image", "video"],
  contextTokens: null,
  categories: ["Marketing"],
  distillable: false,
  releasedAt: "2026-01-28",
}
```

Require an official ByteDance/Volcengine model page for identity and release date. Keep `contextTokens: null` because these are request/second media models rather than token-context chat models.

- [ ] **Step 3: Assign stable production ranks only after refreshing the live catalogue**

Use the next unused integers after the maximum base rank, ordered by production pricing ID and then exact model name. Add a test that ranks are finite, positive, and unique. Do not copy the staging-only ranks `101` through `117` directly because excluded entries would create misleading gaps and future collisions.

- [ ] **Step 4: Verify candidate behavior on staging**

With `NEXT_PUBLIC_MODEL_DIRECTORY_STAGING_PREVIEW=true`, verify each of the five models appears under its vendor, provider, modality, context, series, category, age, and distillable selections. For request/second Seedance rows, verify both price filter controls use the final displayed request/second price groups.

### Task 5: Resolve the two ElevenLabs models from primary sources

**Files:**
- Update: `website/reports/model-directory/production-model-directory-backfill-review.json`
- Update: `website/reports/model-directory/production-model-directory-backfill-review.md`
- Update during approval execution: `website/src/lib/model-directory-meta-data.ts`

- [ ] **Step 1: Prove the production identity for each exact model name**

For `eleven_multilingual_v2` and `eleven_sound_v1`, capture the production pricing row ID, vendor name, billing unit, final displayed price dimensions, supported endpoint types, and any internal alias description returned by the public read-only API. Do not infer `eleven_sound_v1` from the name alone.

- [ ] **Step 2: Match the identity to an ElevenLabs primary source**

Use an official ElevenLabs model documentation page, model API listing, or release note. Record the source URL, source title, access date, exact external model ID, capabilities, and release date. If the external ID does not exactly match the production name, record the alias mapping evidence from the production row description or backend configuration; otherwise keep that model in `unresolvedModels`.

- [ ] **Step 3: Build a complete proposal only when every required field is supported**

Each approved ElevenLabs proposal must contain `series`, `vendor`, `providers`, `modalities`, explicit `contextTokens` (use `null` only when token context is not applicable), `categories`, `distillable`, `releasedAt`, and a unique `rank`. Use `ElevenLabs` as vendor/provider only if the production vendor and official source agree. Categories and distillability require a recorded Flatkey taxonomy decision.

- [ ] **Step 4: Keep unresolved identities visible and non-filterable**

If either identity cannot be proved, leave it out of production metadata, retain the corresponding `unknown-model` audit issue, and state the exact missing evidence in `unresolvedModels`. Do not substitute guessed metadata to make the audit count reach zero.

### Task 6: Produce the operator approval packet without a production write

**Files:**
- Update: `website/reports/model-directory/production-model-directory-backfill-review.json`
- Update: `website/reports/model-directory/production-model-directory-backfill-review.md`

- [ ] **Step 1: Render a before/after issue projection**

The Markdown packet must show baseline totals, approved candidate totals, rejected candidates, unresolved candidates, affected filters, exact field values, evidence URLs, and confidence. It must retain:

```json
{
  "approvalStatus": "pending",
  "productionWriteExecuted": false
}
```

- [ ] **Step 2: Generate a source-code patch preview, not an executed database migration**

Render the exact proposed `BASE_MODEL_DIRECTORY_META` additions and edits as a unified diff in the Markdown packet. Do not modify `website/src/lib/model-directory-meta-data.ts` in this task. Because directory metadata is owned by the website source file, no SQL is required for the 103 live models.

- [ ] **Step 3: Keep non-live catalogue additions in a separate appendix**

List the twelve excluded names with `decision: "excluded-not-live"`. If product later wants them added to the production pricing catalogue, first inspect the actual production model schema and generate a separate, reversible migration proposal covering identity, channel availability, endpoint support, billing mode, configured price, and rollback. That proposal requires a distinct user approval and is not part of this metadata backfill.

- [ ] **Step 4: Stop at the approval gate**

Send the review packet to the user. Do not promote candidate metadata, push a backfill commit, deploy, call a mutation endpoint, or execute SQL until the user explicitly approves the exact packet.

### Task 7: Promote only the approved metadata in a follow-up PR

**Files:**
- Modify: `website/src/lib/model-directory-meta-data.ts`
- Modify: `website/src/lib/model-directory-meta-staging-preview.ts`
- Modify: `website/src/lib/model-directory-meta.test.ts`
- Modify: `website/src/lib/model-directory-audit.test.ts`
- Regenerate: `website/reports/model-directory/production-model-directory-audit.json`
- Regenerate: `website/reports/model-directory/production-model-directory-audit.md`

- [ ] **Step 1: Create a fresh branch from the production revision containing the model-directory feature**

Use a branch named `feat/model-directory-production-metadata-backfill`. Confirm the production feature PR has merged or rebase onto its approved head before editing.

- [ ] **Step 2: Write failing coverage for the exact approved model and field set**

Assert every approved live name exists in production `MODEL_DIRECTORY_META` with the exact reviewed values. Assert the twelve excluded names are absent when `NEXT_PUBLIC_MODEL_DIRECTORY_STAGING_PREVIEW` is unset. Assert all production ranks are unique.

- [ ] **Step 3: Run focused tests and verify they fail before promotion**

Run:

```powershell
bun test src/lib/model-directory-meta.test.ts src/lib/model-directory-audit.test.ts
```

Expected: FAIL only for the newly approved production values or the new applicability rule.

- [ ] **Step 4: Promote the approved values into base metadata**

Copy only user-approved entries and fields from the review packet into `BASE_MODEL_DIRECTORY_META`. Remove promoted entries or fields from the staging candidate file so the staging overlay remains a list of genuinely unapproved values. Do not change pricing values in metadata.

- [ ] **Step 5: Run focused tests and regenerate the production audit**

Run:

```powershell
bun test src/lib/model-directory-meta.test.ts src/lib/model-directory-audit.test.ts src/lib/model-directory-filters.test.ts
$env:APP_CONSOLE_ORIGIN='https://console.flatkey.ai'
Remove-Item Env:NEXT_PUBLIC_MODEL_DIRECTORY_STAGING_PREVIEW -ErrorAction SilentlyContinue
bun run audit:model-directory
```

Expected: all focused tests pass; no approved metadata issue remains; any unapproved ElevenLabs identity remains explicitly reported; stale staging-only entries do not appear in production metadata.

- [ ] **Step 6: Open a separate PR with the approval packet attached**

The PR body must link the approved review artifact, list exact resolved/unresolved counts, state that no production database write occurred, and include the new audit result.

### Task 8: Verify production build isolation, rollout, and rollback

**Files:**
- Verify: `website/Dockerfile`
- Verify: `.github/workflows/gcp-deploy-website-staging.yml`
- Verify: `website/src/lib/model-directory-meta-data.ts`
- Verify: `website/src/lib/model-directory-meta-staging-preview.ts`

- [ ] **Step 1: Run the complete website verification suite with production preview disabled**

Run from `website/`:

```powershell
Remove-Item Env:NEXT_PUBLIC_MODEL_DIRECTORY_STAGING_PREVIEW -ErrorAction SilentlyContinue
bun test
bun run typecheck
bun run lint
bun run build
```

Expected: every command exits 0. The production build uses only base metadata.

- [ ] **Step 2: Build once with staging preview enabled and compare audit scope**

Run the audit with `NEXT_PUBLIC_MODEL_DIRECTORY_STAGING_PREVIEW=true` into a separate cache directory. Expected: staging includes candidate overlays; the production report and build remain unchanged; the twelve excluded entries are reported as stale against the production catalogue.

- [ ] **Step 3: Smoke-test the deployed production model directory**

After the approved metadata PR deploys, verify `/models` and `/zh/models`: all 103 current models render; approved models participate in every approved metadata filter; context remains single-select with `0..selected` semantics; request/second filters control both displayed price groups; token models use token prices; reset and URL restoration work.

- [ ] **Step 4: Re-run the read-only audit after deployment**

Run the Task 1 production command. Expected: the deployed metadata count and issue totals match the approved packet, and output still states `No production write occurred.`

- [ ] **Step 5: Use a code revert as the metadata rollback**

If a metadata value is wrong, revert the follow-up metadata commit and redeploy the website. Because this plan performs no production database mutation, rollback does not require SQL or catalogue repair. If a future separately approved catalogue migration occurs, its own migration plan must include pre-change row snapshots and transaction-safe inverse statements.

## Approval boundary

This plan authorizes read-only production API calls, local report generation, tests, and PR preparation. It does not authorize production database writes, production catalogue inserts, or promotion of candidate metadata. Execution must stop after Task 6 until the user approves the exact review packet; after approval, Tasks 7-8 may proceed in a separate PR.
