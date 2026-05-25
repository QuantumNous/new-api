# Dashboard API Key Statistics

## Background

The model dashboard historically reads from `quota_data`, an hourly aggregate
table keyed by user, model, and time. That table did not preserve which API key
created the traffic, so the dashboard could only show all usage for a user.

This change keeps one aggregate table and adds API key dimensions for future
rows. Historical rows are not backfilled.

## Data Semantics

`quota_data.token_id` defines whether a row has API key attribution:

- `token_id = 0`: legacy aggregate data that was written before API key
  attribution existed. It represents the user's aggregate usage for that model
  and hour.
- `token_id > 0`: API key-attributed aggregate data written after this change.
  It represents usage for a specific API key, model, and hour.

Historical data is not deleted, rewritten, or backfilled. A dashboard filter for
a specific API key only returns data written after the attribution fields were
introduced.

## Migration Strategy

`quota_data` stays as the single aggregate table. The application migration uses
the existing GORM `AutoMigrate` flow to add:

- `token_id`, defaulting to `0`;
- `token_name`, defaulting to an empty string.

Existing rows therefore keep `token_id = 0` and continue to mean "legacy
aggregate data without API key attribution." No background job rewrites old
rows, and no second aggregate table is introduced.

## Write Path

Consumption logs already know the resolved token id and token name. When
dashboard export is enabled, the aggregate cache now groups rows by:

```text
user_id + token_id + model_name + created_at(hour)
```

The aggregate table is updated on flush by incrementing `count`, `quota`, and
`token_used`. `token_name` is stored for display and troubleshooting, but it is
not part of the statistical identity because token names can change.

Future writes only create API key-attributed rows. They do not also write a
`token_id = 0` total row, because the unfiltered dashboard can derive totals by
summing all rows.

## Read Path

Dashboard data endpoints accept an optional `token_id` query parameter:

- Without `token_id`, the query returns all API keys by aggregating rows across
  token ids. This naturally combines old `token_id = 0` rows and new
  `token_id > 0` rows.
- With `token_id`, the query returns only rows for that API key.

For `/api/data/self`, the backend verifies that the requested token belongs to
the current user before reading aggregates.

For `/api/data`, administrators can combine `username` and `token_id`; both
filters apply. If they do not match any rows, the endpoint returns an empty
dataset.

## Frontend Selection

The dashboard does not ask users to enter token ids. It loads the current
user's API keys from `GET /api/token/options`, displays token names with masked
keys and statuses, and sends only the selected `token_id` to the data endpoint.

The token options endpoint returns masked API keys only. It never returns full
API key material.

## Testing Notes

Backend tests should cover:

- separate aggregate rows for different token ids in the same hour;
- accumulation for repeated writes to the same token/model/hour;
- unchanged token identity when token names change;
- unfiltered reads combining legacy and API key-attributed rows;
- filtered reads returning only the requested token id;
- self-service access rejecting another user's token id;
- token options returning only the current user's masked keys.

Frontend checks should verify that API key filtering only sends `token_id` and
that clearing the selector restores the all-key dashboard.
