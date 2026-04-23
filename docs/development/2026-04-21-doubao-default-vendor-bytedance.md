# Doubao Default Vendor Normalization

## Scope

This change normalizes the default vendor name for `doubao-*` models from the legacy Chinese label to `ByteDance`.

## Why

`/api/pricing` builds fallback model metadata from `model/pricing_default.go` when a model is enabled but has no matching row in the `models` table.

Before this change, the fallback rule used the legacy Chinese vendor name:

- `doubao -> legacy Chinese vendor label`

That behavior caused two practical problems:

- the fallback path could create or reuse a Chinese-named vendor instead of the expected English `ByteDance`
- mixed vendor names made duplicate vendor rows more likely when operators maintained metadata manually in the database

## Change

Update the default fallback mapping in `model/pricing_default.go`:

- `defaultVendorRules["doubao"]` now maps to `ByteDance`
- `defaultVendorIcons` now uses `ByteDance -> Doubao.Color`

## Impact

- New fallback metadata for `doubao-*` models will use `ByteDance`
- Automatic vendor creation from the fallback path will create `ByteDance`, not the legacy Chinese vendor label
- Existing `models` rows are unchanged and still take priority over fallback metadata

## Deployment Note

If a deployment already contains duplicate vendor rows such as both `ByteDance` and a legacy Chinese Doubao vendor row, clean up the database after deploying this change so future fallback resolution stays consistent.
