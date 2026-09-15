# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

## Embedded static files and SPA route directories

### 1. Scope / Trigger

Use this contract when an embedded frontend serves static assets before a
single-page application fallback. A public SPA path may have the same name as
an asset directory (for example, route `/client` and files under
`web/public/client/`). Treating that directory as a static file causes
`http.FileServer` to emit a trailing-slash redirect before the SPA can render.

### 2. Signatures

- `common.EmbedFolder(fsEmbed, targetPath)` returns a
  `static.ServeFileSystem` used by `router.SetWebRouter`.
- `(*embedFileSystem).Exists(prefix, path)` decides whether
  `static.Serve` may hand the request to `http.FileServer`.

### 3. Contracts

- `Exists` returns true only when `Open(path)` succeeds, `Stat()` succeeds, and
  the entry is a regular file. Directories must continue to the next Gin
  handler so SPA routes can use the same path segment as asset folders.
- Every successfully opened probe is closed, including when `Stat()` fails.
- Keep the root-path bypass in `Open`: `/` must reach the SPA index response,
  which may contain runtime-injected content instead of the raw embedded file.
- Query strings do not change static-file identity. They remain available to
  the SPA fallback when a path is not a regular file.
- The web fallback must continue rejecting `/api`, `/v1`, and `/assets`
  misses instead of returning SPA HTML.

### 4. Validation & Error Matrix

| Input | Expected behavior |
| --- | --- |
| Existing regular asset | Serve the original bytes and content type; do not run the SPA fallback |
| Existing directory, with or without `/` | `Exists` is false; continue to SPA fallback without a static redirect |
| Root path | Continue to the runtime SPA index response |
| Missing path | Continue to the existing fallback chain |
| `Open` or `Stat` failure | Return false; after a successful open, close the probe exactly once |
| Missing `/api`, `/v1`, or `/assets` path | Preserve the existing non-SPA not-found response |

### 5. Good / Base / Bad Cases

- Good: `/client` renders SPA HTML while
  `/client/yecai-client-apps-light-showcase.webp` still serves the embedded
  WebP asset.
- Base: `/client?source=header` reaches the SPA with the query intact.
- Bad: report an asset directory as existing and let `http.FileServer` return
  `Location: client/`; a reverse canonical redirect can then create a loop.

### 6. Tests Required

- Exercise actual HTTP `GET` requests through Gin `static.Serve` plus the SPA
  fallback for both slash variants, queries, root, another directory, a
  missing path, and a real asset with its original body/content type.
- Test probe cleanup on `Stat` failure. When changing `SetWebRouter`, also
  assert that API and asset-prefix misses do not become SPA responses.
- Do not rely on `HEAD` alone: proxy or file-server handling can differ from
  the browser's `GET` redirect chain.

### 7. Wrong vs Correct

```go
// Wrong: directories and files both report success.
_, err := e.Open(path)
return err == nil

// Correct: close the probe and reserve static handling for regular files.
file, err := e.Open(path)
if err != nil {
    return false
}
defer file.Close()
info, err := file.Stat()
return err == nil && info.Mode().IsRegular()
```

## Authenticated request outcome pagination

### Scope / Trigger
Easy-console request history, distinct from raw developer/admin log pagination.

### Signatures
- `GET /api/log/self/requests?p=&page_size=&start_timestamp=&end_timestamp=`
  requires `UserAuth` and returns `{success, data: {page, page_size, total, items}}`.
- `model.GetUserRequestLogs(ctx, userID, start, end, startIdx, num)` owns collapse and passes the request context to `LOG_DB.WithContext(ctx)`.

### Contracts
- Require positive integer start/end timestamps, end >= start, and at most one fixed-offset day: `end - start < 86400`. Validate positivity and ordering before subtraction, reject parse errors and missing bounds before database access, and always apply both timestamp filters. Restrict rows to the authenticated user and consume/error types in that window.
- For nonempty request IDs, consume always wins over error. Within a type,
  choose the greatest `(created_at, id)`. Both paths use `compareRequestOutcomes`; exact time/ID ties use the greatest `(is_stream, other, quota, prompt_tokens, completion_tokens)` in that order, with true > false, raw-byte string order for other, and numeric order for amounts. This is deterministic tie resolution for zero-ID ClickHouse rows, not recovered insertion order. All compared fields must be loaded by both paths; total charge/token accumulation still includes every consume row.
- Preserve every empty-ID historical row independently.
- Keep chosen rows in database display order: ordinary databases use `id desc`;
  ClickHouse uses `created_at desc, request_id desc`. Compute total and slice
  only after collapse, then call `formatUserLogs` for display IDs and sanitization.
- Preserve `/api/log/self` and its raw filtering/pagination callers.
- The shared page parser permits negative legacy values. This slice-based
  endpoint must reject nonpositive parsed page/page size and multiplication
  overflow before calculating offsets. Keep the existing defaults and 100 cap.

### Validation & Error Matrix
| Input | Behavior |
| --- | --- |
| Retry error and consumption straddle 50 raw rows | One final consumption; total counts outcomes |
| Past final page | Empty array with the correct outcome total |
| Missing/invalid/nonpositive/reversed window, or >86400 inclusive seconds | `success: false`, no database access |
| Canceled request | Query receives request context and stops |
| Negative page/size or overflowing offset | `success: false`, no panic |
| Database failure | `success: false`, `查询日志失败` |
| Admin/root/audit metadata | Removed through `formatUserLogs` |

### Good / Base / Bad Cases
- Good: a later error write cannot displace a completed consumption.
- Base: unrelated empty-ID logs remain separate.
- Bad: pick settlement by insertion order when event timestamps differ.

### Tests Required
Cover >50 raw rows, repeated consumes/errors, out-of-order event times, empty
IDs (including same-second zero-ID ties in both input orders), user/type/date isolation, totals/end pages, unsafe pagination, window bounds and cancellation, database
errors, and ordinary/ClickHouse ordering and sanitization. SQLite branch tests
for ClickHouse ordering do not substitute for a live ClickHouse integration run.

### Wrong vs Correct
- Wrong: paginate raw rows and collapse only the current page.
- Correct: select final outcomes, preserve display order, count, then paginate.
