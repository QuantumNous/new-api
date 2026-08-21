# Production model-directory metadata backfill runbook

The data package is prepared, but this runbook is approval-gated. It does not authorize a production write by itself.

## Package

- Import candidate: `data/model-directory/production-candidate.json` — 89 exact-name records for the current full production catalogue.
- Pending review: `data/model-directory/production-pending-review.md` — `eleven_multilingual_v2` and `eleven_sound_v1` are excluded until authoritative metadata is confirmed.
- Read-only audit: `website/reports/model-directory/production-model-directory-audit.json` and the `-plg` variant.

## After the production code is live

From the repository root, set the production database DSN in the process environment only (do not commit it), then run the importer in dry-run mode:

```powershell
$env:SQL_DSN = '<production-dsn>'
go run ./cmd/model_directory_metadata --file data/model-directory/production-candidate.json --dry-run
```

Review the JSON plan. It should contain 89 inserts (or explicit updates if an operator has already added rows) and no rows for the two pending ElevenLabs models or the 24 non-live candidates.

Only after the reviewed dry-run is explicitly approved, run the transactional apply:

```powershell
go run ./cmd/model_directory_metadata --file data/model-directory/production-candidate.json --apply
```

Then rerun the production website audit in read-only mode:

```powershell
$env:APP_CONSOLE_ORIGIN = 'https://console.flatkey.ai'
cd website
bun run audit:model-directory
$env:MODEL_DIRECTORY_AUDIT_GROUP = 'plg'
bun run audit:model-directory
```

Acceptance criteria:

1. The importer exits successfully and reports the expected insert/update/unchanged plan.
2. The post-apply full-catalogue audit reports zero live metadata gaps for the imported 89 models.
3. The PLG audit reports zero live metadata gaps for the 87 overlapping PLG models.
4. `eleven_multilingual_v2` and `eleven_sound_v1` remain explicitly pending until their reviewed rows are added.
5. No stale metadata candidate is imported merely because it exists in the review dataset.
