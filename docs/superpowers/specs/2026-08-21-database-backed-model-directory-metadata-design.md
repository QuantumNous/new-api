# Database-backed Model Directory Metadata Design

## Goal

Make the database the only runtime source for every non-price model-directory filter. The existing public pricing pipeline remains authoritative for model availability, displayed price, discount, and billing unit.

## Scope

This change covers:

- a dedicated database table keyed by the exact public `model_name`;
- startup schema migration through the repository's existing GORM migration path;
- database reads joined into `GET /api/website/pricing?group=plg`;
- an idempotent, reviewable metadata import command with dry-run and apply modes;
- staging backfill and coverage verification;
- frontend removal of the runtime static metadata source;
- read-only production gap reporting before any production import.

This change does not add an admin editing page or a public/admin write endpoint. Operators maintain metadata through the reviewed import command or direct database changes.

## Chosen Architecture

Create a separate `model_directory_metadata` table and attach one optional `directory_metadata` object to every visible pricing model returned by the existing website pricing endpoint.

The separate table is required because the existing `models` table supports exact, prefix, suffix, and contains name rules. A single non-exact `models` row can represent multiple public model names, while directory metadata must bind one-to-one to the exact name rendered on `/models`.

The existing endpoint is preferred over a second public endpoint because the page already needs the pricing payload and filters must use a coherent snapshot of model visibility, pricing, and metadata.

## Data Model

The `model_directory_metadata` table contains:

| Column | Contract |
| --- | --- |
| `id` | Primary key. |
| `model_name` | Required exact public model name with a unique index. |
| `author` | Required model author/vendor label used by the author filter. |
| `providers_json` | Required JSON array of non-empty, deduplicated provider names. |
| `modalities_json` | Required JSON array containing supported directory modality values. |
| `context_tokens` | Nullable positive integer. `NULL` is valid for image, video, audio, and other models without a token context window. |
| `series` | Required model family label. |
| `categories_json` | Required JSON array of non-empty, deduplicated directory categories. |
| `released_at` | Required calendar date stored as `YYYY-MM-DD`. |
| `distillable` | Required boolean. |
| `popularity_rank` | Nullable positive integer used by directory ordering. |
| `top_ten_rank` | Nullable integer from 1 through 10. |
| `status` | Enabled/disabled flag. Only enabled rows are public. |
| `created_time` | Creation timestamp using the repository's integer timestamp convention. |
| `updated_time` | Last update timestamp using the repository's integer timestamp convention. |

JSON text is used for the three list columns so the schema behaves consistently across MySQL, PostgreSQL, and SQLite. Repository methods parse, normalize, validate, and serialize the arrays; callers do not manipulate raw JSON.

## Backend Read Path

1. `GetWebsitePricing` resolves the public `plg` model list and displayed pricing through the existing logic.
2. The backend extracts the exact visible model names.
3. One database query loads enabled directory metadata rows for those names.
4. Parsed metadata is indexed by exact `model_name`.
5. Each pricing item receives `directory_metadata` when an exact enabled row exists.
6. The response keeps all existing pricing fields unchanged.

The directory metadata query failure is fail-soft for the public catalogue: prices and models still return, `directory_metadata` is omitted, and the server records the database error. This prevents metadata availability from taking down the pricing page while making incomplete filters visible to monitoring and coverage tests.

## Public Response Contract

Each item in `data` may include:

```json
{
  "directory_metadata": {
    "author": "OpenAI",
    "providers": ["OpenAI", "Azure"],
    "modalities": ["text", "image", "file"],
    "context_tokens": 1048576,
    "series": "GPT",
    "categories": ["Programming", "Technology"],
    "released_at": "2026-06-20",
    "distillable": false,
    "popularity_rank": 21,
    "top_ten_rank": null
  }
}
```

No metadata write method is exposed from the public endpoint.

## Frontend Data Flow

- Model name, availability, endpoints, pricing ratios, display price, and billing unit continue to come from the existing pricing payload.
- Input/output price filters use the same final displayed values rendered by the table.
- Per-second and per-request models use their single displayed price in both price filter groups, preserving the approved behavior.
- Author, providers, modalities, context length, series, categories, release date, distillability, and popularity ranks come only from `directory_metadata`.
- The context filter remains single-select and matches `0 < context_tokens <= selected_limit`.
- A model without metadata still renders and remains searchable by its public name and payload vendor, but it is excluded from metadata-dependent facets.
- The production frontend no longer imports or conditionally enables static model-directory metadata files.

## Import and Backfill

The import command accepts a reviewed JSON document and supports:

- `--dry-run`: validate, normalize, compare with current rows, and print inserts/updates/disables without writing;
- `--apply`: execute the same validated changes in one transaction;
- idempotent upserts keyed by exact `model_name`;
- an explicit environment/DSN supplied by the operator rather than an implicit production default;
- no automatic startup seed.

Validation rejects duplicate model names, empty required strings or arrays, unsupported modalities, invalid dates, non-positive non-null context lengths, invalid ranks, and malformed JSON.

The existing static candidate data may be converted into the initial reviewed import document, but that document is only an import artifact. Runtime reads never fall back to it.

## Environment Rollout

1. Migrate the new table in all environments through the normal application migration path.
2. Generate a staging dry-run against the staging catalogue.
3. Apply the complete reviewed dataset to the staging database.
4. Verify every staging-visible pricing model has valid metadata and every filter works against the API response.
5. Generate a read-only production gap report from the production pricing catalogue and database metadata.
6. Present production inserts and updates for operator review.
7. Apply to production only after explicit approval.
8. Re-run the production read-only audit and require zero unreviewed live-model gaps before enabling the frontend release.

## Testing

Backend tests cover:

- schema migration registration;
- exact-name uniqueness;
- JSON normalization and validation;
- enabled-row lookup by visible model names;
- metadata attachment to the `plg` pricing payload;
- omission of disabled or missing metadata;
- fail-soft behavior when the metadata query fails;
- dry-run producing no writes;
- transactional, idempotent apply behavior.

Frontend tests cover:

- parsing the API metadata contract;
- all filter groups using API metadata rather than static imports;
- the single-select upper-bound context rule;
- token, request, and second price behavior;
- graceful rendering of models with missing metadata;
- current staging catalogue coverage through the live staging pricing endpoint.

End-to-end verification requires the staging API response to contain valid metadata for every visible staging model, with no runtime static metadata flag enabled.

## Acceptance Criteria

- The database is the only runtime source for all non-price directory filters.
- The existing website pricing endpoint remains the only data request needed by `/models`.
- All staging-visible models have complete, valid metadata after staging import.
- Prices and billing units remain live and unchanged from the existing pricing pipeline.
- No admin editing UI or metadata write endpoint is added.
- No production metadata is written before the reviewed production dry-run is approved.
- The final PR contains the database schema, backend response, import workflow, frontend migration, tests, and rollout evidence for this feature only.
