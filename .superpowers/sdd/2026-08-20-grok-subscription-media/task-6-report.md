# Task 6 Report: Grok Subscription Video Request DTO

## Outcome

Implemented the provider-local Grok subscription video request layer under `relay/channel/task/groksubscription` without adding an HTTP adaptor.

## Changes

- Added local model/action constants for `grok-imagine-video` and `grok-imagine-video-1.5`.
- Added the strict provider-local `VideoRequest` DTO with pointer optional scalars and media/reference structs.
- Added strict JSON decoding with unknown-field rejection for this package only.
- Added validation/defaulting for:
  - generate, edit, and extend actions;
  - generate duration default `5`, range `1..15`;
  - extend duration default `6`, range `2..10`;
  - allowed aspect ratios `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`;
  - allowed resolutions `480p`, `720p`, `1080p` with model/input caps;
  - reference image max `7` and reference voice max `3`;
  - HTTPS or base64 `data:image/jpeg|png` image inputs;
  - HTTPS or base64 `data:video/mp4` video inputs;
  - nonblank voice IDs.
- Added provider-local Gin context storage plus package-private getter.
- Added synthesized `relaycommon.TaskSubmitReq` storage through `relaycommon.StoreTaskRequest`.
- Added pure upstream payload mapping with action-specific fields and pointer `omitempty` scalars.

## TDD Record

RED:

```text
go test ./relay/channel/task/groksubscription -run 'TestValidateVideoRequest|TestBuildUpstreamVideoRequest' -count=1
FAIL: undefined: actionGenerate, validateVideoRequest, getVideoRequest, actionEdit ...
```

GREEN:

```text
go test ./relay/channel/task/groksubscription -run 'TestValidateVideoRequest|TestBuildUpstreamVideoRequest' -count=1
ok github.com/QuantumNous/new-api/relay/channel/task/groksubscription
```

## Verification

```text
go test ./relay/channel/task/groksubscription -run 'TestValidateVideoRequest|TestBuildUpstreamVideoRequest' -count=1
ok github.com/QuantumNous/new-api/relay/channel/task/groksubscription 0.236s

go test ./relay/channel/task/groksubscription -count=1
ok github.com/QuantumNous/new-api/relay/channel/task/groksubscription 0.217s

git diff --check
exit 0
```

## Notes

- No remote media prefetching was introduced.
- No other video adapter or route is touched.
- GitNexus was unavailable per task binding, so no GitNexus checks were run.

## Review Fix Round 1

Review findings addressed:

- Strictness blocker: whitespace-wrapped HTTPS and data URI media values were validated after trimming but forwarded unchanged.
- Memory issue: `decodeVideoRequest` copied `BodyStorage` through `Bytes()` before strict decoding.

RED:

```text
go test ./relay/channel/task/groksubscription -run 'TestValidateVideoRequestRejectsInvalidMatrix|TestDecodeVideoRequestStreamsBodyStorageAndKeepsBodyReusable' -count=1
FAIL: whitespace-wrapped image/video HTTPS and data URI cases were accepted; stream decode test failed with "Bytes must not be called"
```

GREEN:

```text
go test ./relay/channel/task/groksubscription -run 'TestValidateVideoRequestRejectsInvalidMatrix|TestDecodeVideoRequestStreamsBodyStorageAndKeepsBodyReusable' -count=1
ok github.com/QuantumNous/new-api/relay/channel/task/groksubscription 0.247s
```

Fresh verification:

```text
go test ./relay/channel/task/groksubscription -run 'TestValidateVideoRequest|TestBuildUpstreamVideoRequest' -count=1
ok github.com/QuantumNous/new-api/relay/channel/task/groksubscription 0.261s

go test ./relay/channel/task/groksubscription -count=1
ok github.com/QuantumNous/new-api/relay/channel/task/groksubscription 0.260s

git diff --check
exit 0
```

Self-review:

- Media validation now rejects `raw != strings.TrimSpace(raw)`, so the exact forwarded string is the exact validated string.
- Strict decode now streams from `BodyStorage`, seeks back to start, and restores `c.Request.Body` for downstream reusable parsing.
- Scope remains provider-local under `relay/channel/task/groksubscription`; no HTTP adaptor was added.
