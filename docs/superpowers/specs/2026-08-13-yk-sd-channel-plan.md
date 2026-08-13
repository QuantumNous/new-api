# yk-sd Channel Implementation Plan

> **Goal:** Add channel type `yk-sd` (70) for KYY `sd_2.0_special` / `sd_2.0_discount`, with forced Seedance asset pipeline and thin `/api/yk-sd/assets/*` proxy.

**Spec:** `docs/superpowers/specs/2026-08-13-yk-sd-channel-design.md`

**Architecture:** New `relay/channel/task/yksd/` (fork ykvideo + force assets + per-second billing). Public asset routes under TokenAuth.

---

### Task 1: Core package `yksd`

**Files:** `relay/channel/task/yksd/{constants,adaptor,normalize,volc_normalize,asset_client,force_assets,*_test}.go`

- Model map; flat + volc normalize; keep watermark
- Resolution validate per model
- Force assets: upload/poll/rewrite
- Per-second EstimateBilling / AdjustBillingOnComplete
- Parse create/query like ykvideo

### Task 2: Register channel 70

- `constant/channel.go` + base URL test
- `relay/relay_adaptor.go`

### Task 3: Asset setting + proxy

- `setting/operation_setting/yk_sd_asset_setting.go`
- `service/yk_sd_asset.go`, `controller/yk_sd_asset.go`, `router/yk_sd-router.go`
- Wire in `router/main.go`
- Minimal classic + default ops UI for enabled + gateway_channel_id

### Task 4: Frontend channel registration

- default + classic: type 70, models, key prompt, hints, icon

### Task 5: Verify

```bash
go test ./relay/channel/task/yksd/ -count=1
go test ./constant/ -run YkSd -count=1
```
