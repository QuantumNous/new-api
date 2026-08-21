# Task 8 Report: Prevent uncertain media-write replay and keep OAuth out of tasks

## Outcome

Implemented Task 8 retry and polling safeguards for Grok Subscription media:

- Normal task relay now stops retry/channel switching when `TaskSubmitResult.OutcomeMayBeUnknown` is true.
- The generic request layer marks only URL/request/header construction errors as definitely not sent; `doRequest` transport failures remain ambiguous.
- Grok Subscription task submit treats POST transport errors, 401, 429, 5xx, and malformed 2xx submit responses as uncertain outcomes.
- Grok image POST transport errors and 401/429/5xx responses now skip retry unless the error is explicitly marked definitely pre-send.
- Type 113 task polling never persists `Channel.Key`/OAuth JSON, while Gemini/Vertex/TechMobi/ModelAPI polling keys remain supported.
- Generic and legacy polling bodies now include the origin `channel_id`.
- Grok task polling ignores stored `baseURL`/`key`, uses the caller context and current DB credential, and retries exactly once after a 401 using a lease-safe forced refresh.

## Review-Round Fixes

- Sanitized Grok Subscription image `DoResponse` failures to the generic client-facing message `upstream image response was invalid` and marked them skip-retry.
- Changed forced media refresh waiters to stop returning an unchanged stale credential after another lease owner is already refreshing; they now return the updated credential when it changes, otherwise `ErrRefreshConflict`.

## Files

- `controller/relay.go`
- `controller/relay_task_test.go`
- `controller/asset_task_worker.go`
- `controller/asset_task_worker_test.go`
- `controller/task_video.go`
- `model/task.go`
- `model/task_key_test.go`
- `relay/relay_task.go`
- `relay/channel/api_request.go`
- `relay/channel/api_request_test.go`
- `relay/channel/groksubscription/media_preflight.go`
- `relay/channel/groksubscription/media_preflight_test.go`
- `relay/channel/task/groksubscription/adaptor.go`
- `relay/channel/task/groksubscription/adaptor_test.go`
- `relay/image_handler.go`
- `relay/image_handler_test.go`
- `service/task_polling.go`
- `service/task_polling_video_result_test.go`

## RED Evidence

```text
go test ./relay -run 'Test.*TaskRequest.*Sent|Test.*Grok.*Outcome|TestImageHelper.*Grok.*Retry' -count=1
FAIL: undefined shouldSkipRetryForGrokImagePostError / shouldSkipRetryForGrokImagePostStatus / MarkDefinitelyNotSent
```

```text
go test ./controller -run 'TestRelayTask.*OutcomeUnknown|Test.*Grok.*PollingKey|Test.*Grok.*ChannelID' -count=1
FAIL: undefined channel.MarkDefinitelyNotSent
```

```text
go test ./service -run 'Test.*Grok.*Polling' -count=1
FAIL: expected polling body to include channel_id; actual body omitted channel_id
```

```text
go test ./relay/channel/task/groksubscription -run 'TestFetchTask.*Credential|TestFetchTask.*401' -count=1
FAIL: undefined setPollingCredentialForTest / setAPIBaseForTest / FetchTaskWithContext
```

## GREEN / Verification

```text
go test ./relay -run 'Test.*TaskRequest.*Sent|Test.*Grok.*Outcome|TestImageHelper.*Grok.*Retry' -count=1
ok github.com/QuantumNous/new-api/relay 0.408s
```

```text
go test ./controller -run 'TestRelayTask.*OutcomeUnknown|Test.*Grok.*PollingKey|Test.*Grok.*ChannelID' -count=1
ok github.com/QuantumNous/new-api/controller 0.504s
```

```text
go test ./service -run 'Test.*Grok.*Polling' -count=1
ok github.com/QuantumNous/new-api/service 0.426s
```

```text
go test ./model -run 'Test.*TaskKey.*Grok|Test.*TaskKey' -count=1
ok github.com/QuantumNous/new-api/model 0.389s
```

```text
go test ./relay/channel/groksubscription -run 'Test.*Force.*Refresh' -count=1
ok github.com/QuantumNous/new-api/relay/channel/groksubscription 0.737s
```

```text
go test ./relay ./relay/channel/groksubscription -run 'TestImageHelperGrokRetryDecisionSkipsMalformedDoResponse|TestForceRefreshMediaCredentialWaiterDoesNotReturnStaleCredentialOrRefreshAgain' -count=1
ok github.com/QuantumNous/new-api/relay 2.096s
ok github.com/QuantumNous/new-api/relay/channel/groksubscription 2.507s
```

```text
go test ./relay/channel/task/groksubscription -run 'TestFetchTask.*Credential|TestFetchTask.*401' -count=1
ok github.com/QuantumNous/new-api/relay/channel/task/groksubscription 0.459s
```

```text
go test ./relay/channel -run 'Test.*TaskRequest.*Sent' -count=1
ok github.com/QuantumNous/new-api/relay/channel 0.522s
```

```text
git diff --check
exit 0
```

## Commit

Containing commit: `HEAD` (`4091e2090` was the commit before this self-referential report-hash note was amended).

## Notes / Concerns

- `go test ./relay -run 'Test.*TaskRequest.*Sent...'` does not execute the request-layer tests because they live in `./relay/channel`; I ran the additional `go test ./relay/channel -run 'Test.*TaskRequest.*Sent' -count=1`.
- GitNexus `detect_changes` could not run: `.gitnexus/run.cjs` is absent in this worktree. This matches the approved plan caveat; scope was checked with repo inspection, focused tests, and `git diff --check`.
- Task 9 content proxy / CAS refresh was not implemented.
