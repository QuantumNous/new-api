# Task 7 Report: Grok Subscription Video TaskAdaptor and Billing

## Outcome

Implemented the Grok Subscription async video task adaptor for channel type 113 with fixed xAI media endpoints, paid OAuth preflight headers, public/upstream ID isolation, strict poll-state parsing, whitelabel OpenAI video conversion, and frozen provider-specific second billing defaults.

## Files

- `relay/channel/task/groksubscription/adaptor.go`
- `relay/channel/task/groksubscription/adaptor_test.go`
- `relay/channel/task/groksubscription/billing.go`
- `relay/channel/task/groksubscription/billing_test.go`
- `relay/channel/task/groksubscription/request.go`
- `relay/channel/task/groksubscription/request_test.go`
- `relay/channel/task/taskcommon/helpers.go`
- `relay/channel/task/taskcommon/groksubscription_whitelabel_test.go`
- `relay/relay_adaptor.go`
- `relay/relay_adaptor_test.go`
- `setting/billing_setting/video_price.go`
- `setting/billing_setting/video_price_test.go`

## RED Evidence

```text
go test ./relay/channel/task/groksubscription -count=1
FAIL: undefined: TaskAdaptor, setMediaCredentialForTest, normalizeAcceptedStatus
```

```text
go test ./setting/billing_setting -run 'Test.*GrokSubscription' -count=1
FAIL: undefined: GetGrokSubscriptionVideoPriceRules
```

```text
go test ./relay -run 'TestGetTaskAdaptor.*Grok' -count=1
FAIL: undefined task adaptor registration for channel type 113
```

```text
go test ./relay/channel/task/taskcommon -run 'Test.*Whitelabel.*Grok' -count=1
FAIL: Grok Subscription channel type must be whitelabeled
```

## GREEN / Verification

```text
go test ./relay/channel/task/groksubscription -count=1
ok github.com/QuantumNous/new-api/relay/channel/task/groksubscription 0.395s
```

```text
go test ./setting/billing_setting -run 'Test.*GrokSubscription' -count=1
ok github.com/QuantumNous/new-api/setting/billing_setting 0.234s
```

```text
go test ./relay -run 'TestGetTaskAdaptor.*Grok' -count=1
ok github.com/QuantumNous/new-api/relay 0.376s
```

```text
go test ./relay/channel/task/taskcommon -run 'Test.*Whitelabel.*Grok' -count=1
ok github.com/QuantumNous/new-api/relay/channel/task/taskcommon 0.337s
```

```text
git diff --check
exit 0
```

## Commit

`4fe86e93c`

## Notes

- Task 8/9 controller retry, persisted polling key policy, forced-refresh retry, and content proxy orchestration were not implemented.
- `FetchTask` is credential-aware through `channel_id`; Task 8 is expected to wire the polling body consistently.
- GitNexus runner was unavailable (`GitNexus runner unavailable`); scope was verified with repository inspection and focused tests.
