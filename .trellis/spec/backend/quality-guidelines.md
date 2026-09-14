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
  `/client/yecai-client-apps.png` still serves the embedded PNG.
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
