# yk-video Channel Implementation Plan

> **Goal:** Add channel type `yk-video` (69) for KYY Model Center async video (`videos_933_c1` / `videos_stable`), with VolcEngine `content[]` normalize and per-task billing.

**Spec:** `docs/superpowers/specs/2026-08-12-yk-video-channel-design.md`

**Architecture:** New `relay/channel/task/ykvideo/` TaskAdaptor (th12345ai skeleton + mao-style volc_normalize). Client: `POST/GET /v1/video/generations`. Upstream: `POST/GET /v2/model-center/tasks`.

---

### Task 1: Unit tests + core package

**Files:** `relay/channel/task/ykvideo/{constants,adaptor,volc_normalize,normalize,*_test}.go`

- Model resolve: `seedance2.0-yk-933`→`videos_933_c1`, `seedance2.0-ykst-933`→`videos_stable`
- Flat field aliases → snake_case upstream
- Volc `content[]` → prompt / reference_* / first_image / last_image
- Parse create id; ParseTaskResult status + video_url/result_url + progress
- apiOrigin strip `/v2/model-center/tasks`

### Task 2: Register channel type 69

- `constant/channel.go` + base URL test
- `relay/relay_adaptor.go` GetTaskAdaptor

### Task 3: Frontend (default + classic)

- type 69 `yk-video`, default models, key prompt, channel hints/i18n
- EditChannelModal / channel-type-config / constants / lobe-icons

### Task 4: Verify

```bash
go test ./relay/channel/task/ykvideo/ -count=1
go test ./constant/ -run YkVideo -count=1
```
