# Mao Seedance Adaptive Resolution Channel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add channel type `mao` (68) that exposes three logical Seedance models and maps each request’s resolution to the correct catertx upstream model ID on `/v1/video/generations`.

**Architecture:** New `relay/channel/task/mao` TaskAdaptor (patterned on `task7tai`). Client sends `guanzhuan-seedance2.0` (+ `resolution`/`size`); adaptor resolves tier (default `720p`), validates against the series whitelist, rewrites `model` to `sd-2-0-*` / `sd-2-0-mini-*` / `sd-2-5-*`, strips resolution from upstream body, and polls GET for status/URL. Billing: `per_second` + resolution tier ratios.

**Tech Stack:** Go 1.22+ (Gin), `relay/channel/task` + `taskcommon`, `common.Marshal`/`Unmarshal`, React/TS channel UI in `web/default` + classic parity.

**Spec:** `docs/superpowers/specs/2026-08-11-mao-seedance-adaptive-channel-design.md`

---

### Task 1: Resolution resolve + model map unit tests (TDD)

**Files:**
- Create: `relay/channel/task/mao/resolve_test.go`
- Create: `relay/channel/task/mao/resolve.go` (stubs → real impl)
- Create: `relay/channel/task/mao/constants.go`

**Step 1: Write failing tests**

```go
package mao

import "testing"

func TestNormalizeTier_FromResolution(t *testing.T) {
	if got := normalizeTier("1080P", ""); got != "1080p" {
		t.Fatalf("got=%q", got)
	}
}

func TestNormalizeTier_PreferResolutionOverSize(t *testing.T) {
	if got := normalizeTier("1080p", "720p"); got != "1080p" {
		t.Fatalf("got=%q", got)
	}
}

func TestNormalizeTier_FromSizeWxH(t *testing.T) {
	if got := normalizeTier("", "1920x1080"); got != "1080p" {
		t.Fatalf("got=%q", got)
	}
	if got := normalizeTier("", "1280x720"); got != "720p" {
		t.Fatalf("got=%q", got)
	}
	if got := normalizeTier("", "3840x2160"); got != "4k" {
		t.Fatalf("got=%q", got)
	}
}

func TestNormalizeTier_Default720p(t *testing.T) {
	if got := normalizeTier("", ""); got != "720p" {
		t.Fatalf("got=%q", got)
	}
}

func TestResolveUpstreamModel_Seedance20(t *testing.T) {
	id, err := resolveUpstreamModel("guanzhuan-seedance2.0", "1080p")
	if err != nil || id != "sd-2-0-1080p" {
		t.Fatalf("id=%q err=%v", id, err)
	}
	id, err = resolveUpstreamModel("guanzhuan-seedance2.0", "4k")
	if err != nil || id != "sd-2-0-4k" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestResolveUpstreamModel_MiniRejects1080p(t *testing.T) {
	_, err := resolveUpstreamModel("guanzhuan-seedance2.0-mini", "1080p")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestResolveUpstreamModel_25Rejects4k(t *testing.T) {
	_, err := resolveUpstreamModel("guanzhuan-seedance2.5", "4k")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestResolveUpstreamModel_MiniOK(t *testing.T) {
	id, err := resolveUpstreamModel("guanzhuan-seedance2.0-mini", "480p")
	if err != nil || id != "sd-2-0-mini-480p" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestResolveUpstreamModel_UnknownLogic(t *testing.T) {
	_, err := resolveUpstreamModel("unknown-model", "720p")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestValidateDuration_Mini(t *testing.T) {
	if err := validateDuration("guanzhuan-seedance2.0-mini", 3); err == nil {
		t.Fatal("expected error for <4s")
	}
	if err := validateDuration("guanzhuan-seedance2.0-mini", 16); err == nil {
		t.Fatal("expected error for >15s")
	}
	if err := validateDuration("guanzhuan-seedance2.0-mini", 10); err != nil {
		t.Fatal(err)
	}
}

func TestValidateDuration_25Max30(t *testing.T) {
	if err := validateDuration("guanzhuan-seedance2.5", 31); err == nil {
		t.Fatal("expected error")
	}
	if err := validateDuration("guanzhuan-seedance2.5", 30); err != nil {
		t.Fatal(err)
	}
}

func TestSupportsCameraFixed(t *testing.T) {
	if supportsCameraFixed("guanzhuan-seedance2.0-mini") {
		t.Fatal("mini must not support camera_fixed")
	}
	if !supportsCameraFixed("guanzhuan-seedance2.0") {
		t.Fatal("2.0 should support camera_fixed")
	}
}
```

**Step 2: Run — expect FAIL**

```bash
go test ./relay/channel/task/mao/ -count=1
```

Expected: package/undefined symbols.

**Step 3: Implement `constants.go` + `resolve.go`**

```go
// constants.go
package mao

const (
	ChannelName  = "mao"
	createPath   = "/video/generations"
	queryPathFmt = "/video/generations/"
)

var ModelList = []string{
	"guanzhuan-seedance2.0",
	"guanzhuan-seedance2.0-mini",
	"guanzhuan-seedance2.5",
}
```

`resolve.go` must implement:

- `normalizeTier(resolution, size string) string` — prefer resolution; parse `*p` / `4k` / `WxH` (min side → 480/720/1080; both ≥2160 or label 4k → `4k`); default `720p`
- `resolveUpstreamModel(logic, tier string) (string, error)` — map per design §4.2; unknown logic or unsupported tier → error with supported list
- `validateDuration(logic string, sec int) error` — mini 4–15; 2.5 max 30; sec≤0 skip (optional duration)
- `supportsCameraFixed(logic string) bool` — false for mini
- `isLogicModel` / `isPerSecondModel` helpers for the three logic names

**Use `strings` only; no `encoding/json` marshal in this file.**

**Step 4: Re-run — expect PASS**

```bash
go test ./relay/channel/task/mao/ -count=1
```

**Step 5: Commit**

```bash
git add relay/channel/task/mao/
git commit -m "test: mao resolution tier and upstream model mapping"
```

---

### Task 2: Parse create/poll responses (TDD)

**Files:**
- Create: `relay/channel/task/mao/parse_test.go`
- Create: `relay/channel/task/mao/parse.go`

**Step 1: Write failing tests**

```go
package mao

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestParseCreateTaskID(t *testing.T) {
	id, err := parseCreateTaskID([]byte(`{"task_id":"t1","status":"queued"}`))
	if err != nil || id != "t1" {
		t.Fatalf("id=%q err=%v", id, err)
	}
	id, err = parseCreateTaskID([]byte(`{"data":{"task_id":"t2"}}`))
	if err != nil || id != "t2" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestParseCreateTaskID_Missing(t *testing.T) {
	_, err := parseCreateTaskID([]byte(`{"status":"queued"}`))
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestParseTaskResult_PreparingRefVideo(t *testing.T) {
	ti, err := parseTaskResult([]byte(`{"status":"preparing_reference_video"}`))
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status=%v", ti.Status)
	}
}

func TestParseTaskResult_SuccessURL(t *testing.T) {
	raw := []byte(`{"status":"completed","video_url":"https://cdn.example.com/v.mp4"}`)
	ti, err := parseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusSuccess || ti.Url != "https://cdn.example.com/v.mp4" {
		t.Fatalf("status=%v url=%q", ti.Status, ti.Url)
	}
}

func TestParseTaskResult_Failed(t *testing.T) {
	raw := []byte(`{"status":"failed","fail_reason":"audit"}`)
	ti, err := parseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusFailure || ti.Reason != "audit" {
		t.Fatalf("status=%v reason=%q", ti.Status, ti.Reason)
	}
}
```

**Step 2: Run — expect FAIL**

```bash
go test ./relay/channel/task/mao/ -count=1 -run Parse
```

**Step 3: Implement `parse.go`**

Mirror `task7tai` helpers (gjson paths):

- `parseCreateTaskID` — paths: `task_id`, `data.task_id`, `id`, `data.id`
- `parseTaskResult` → `*relaycommon.TaskInfo`
  - in-progress: `queued|pending|submitted|preparing_reference_video|processing_reference_video|submitting|processing|running|in_progress|polling`
  - success: `success|completed|succeeded` + URL required
  - failure: `failed|failure|error|cancelled|canceled`
- `extractVideoURL` / `extractErrorMessage` / `formatProgress` — same path lists as 7tai where applicable

**Step 4: Re-run — expect PASS**

```bash
go test ./relay/channel/task/mao/ -count=1
```

**Step 5: Commit**

```bash
git add relay/channel/task/mao/parse.go relay/channel/task/mao/parse_test.go
git commit -m "test: mao create and poll response parsing"
```

---

### Task 3: Payload builder (TDD) — model rewrite + metadata rules

**Files:**
- Create: `relay/channel/task/mao/payload_test.go`
- Create: `relay/channel/task/mao/payload.go`

**Step 1: Write failing tests**

```go
package mao

import "testing"

func TestBuildUpstreamPayload_RewritesModelAndDropsResolution(t *testing.T) {
	in := map[string]interface{}{
		"model":      "guanzhuan-seedance2.0",
		"prompt":     "hello",
		"duration":   10,
		"ratio":      "16:9",
		"resolution": "1080p",
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if out["model"] != "sd-2-0-1080p" {
		t.Fatalf("model=%v", out["model"])
	}
	if _, ok := out["resolution"]; ok {
		t.Fatal("resolution must not be sent upstream")
	}
	if _, ok := out["size"]; ok {
		t.Fatal("size must not be sent upstream")
	}
}

func TestBuildUpstreamPayload_DefaultTier720p(t *testing.T) {
	in := map[string]interface{}{"model": "guanzhuan-seedance2.5", "prompt": "x"}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.5")
	if err != nil {
		t.Fatal(err)
	}
	if out["model"] != "sd-2-5-720p" {
		t.Fatalf("model=%v", out["model"])
	}
}

func TestBuildUpstreamPayload_MiniStripsCameraFixed(t *testing.T) {
	in := map[string]interface{}{
		"model": "guanzhuan-seedance2.0-mini",
		"prompt": "x",
		"metadata": map[string]interface{}{
			"camera_fixed":   true,
			"generate_audio": true,
		},
	}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0-mini")
	if err != nil {
		t.Fatal(err)
	}
	md, _ := out["metadata"].(map[string]interface{})
	if _, ok := md["camera_fixed"]; ok {
		t.Fatal("camera_fixed must be stripped for mini")
	}
	if md["generate_audio"] != true {
		t.Fatalf("generate_audio=%v", md["generate_audio"])
	}
}

func TestBuildUpstreamPayload_UnsupportedTier(t *testing.T) {
	in := map[string]interface{}{
		"model":      "guanzhuan-seedance2.5",
		"resolution": "1080p",
		"prompt":     "x",
	}
	_, err := buildUpstreamPayload(in, "guanzhuan-seedance2.5")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestBuildUpstreamPayload_DefaultResponseFormat(t *testing.T) {
	in := map[string]interface{}{"model": "guanzhuan-seedance2.0", "prompt": "x"}
	out, err := buildUpstreamPayload(in, "guanzhuan-seedance2.0")
	if err != nil {
		t.Fatal(err)
	}
	if out["response_format"] != "url" {
		t.Fatalf("response_format=%v", out["response_format"])
	}
}
```

**Step 2: Run — expect FAIL**

```bash
go test ./relay/channel/task/mao/ -count=1 -run BuildUpstream
```

**Step 3: Implement `buildUpstreamPayload(body map[string]interface{}, logicModel string) (map[string]interface{}, error)`**

1. Read `resolution` / `size` from body → `normalizeTier`
2. `resolveUpstreamModel(logicModel, tier)`
3. Copy allowed fields: `prompt`, `duration` (or from `seconds`), `ratio` (or `aspect_ratio`), `seed`, `image`, `last_frame`, `videos`, `audios`, `n`, `response_format` (default `url`), `metadata`
4. Delete `resolution`, `size`, `seconds`, `aspect_ratio` after normalizing
5. If top-level `generate_audio` exists, merge into metadata
6. If `!supportsCameraFixed(logic)`, delete `metadata.camera_fixed`
7. If duration present, `validateDuration`
8. Set `model` to upstream ID last (overwrite any client value)

Return a **new** map (do not mutate caller unexpectedly if tests share maps — clone first).

**Step 4: Re-run — expect PASS**

```bash
go test ./relay/channel/task/mao/ -count=1
```

**Step 5: Commit**

```bash
git add relay/channel/task/mao/payload.go relay/channel/task/mao/payload_test.go
git commit -m "feat: mao upstream payload builder with adaptive model"
```

---

### Task 4: TaskAdaptor + channel registration

**Files:**
- Create: `relay/channel/task/mao/adaptor.go`
- Modify: `constant/channel.go` — insert before `ChannelTypeDummy`
- Modify: `constant/channel_base_url_test.go`
- Modify: `relay/relay_adaptor.go`

**Step 1: Register channel type 68**

In `constant/channel.go`:

```go
ChannelTypeZiZiDongHua    = 67
ChannelTypeMao            = 68
ChannelTypeDummy          // this one is only for count, do not add any channel after this
```

Append to `ChannelBaseURLs`:

```go
"https://www.zizidonghua.com",               //67 zz
"https://api.catertx.com",                   //68 mao (catertx Seedance)
```

Add to `ChannelTypeNames`:

```go
ChannelTypeMao: "mao",
```

In `constant/channel_base_url_test.go` add:

```go
if got := GetChannelDefaultBaseURL(ChannelTypeMao); got != "https://api.catertx.com" {
    t.Fatalf("mao base url = %q", got)
}
```

**Step 2: Implement `adaptor.go`**

Copy structure from `relay/channel/task/task7tai/adaptor.go`, adapt:

- `Init` / `apiOrigin` — strip `/v1/video/generations`, `/video/generations`, trailing `/v1` then ensure `/v1` suffix (same as 7tai)
- `ValidateRequestAndSetAction` → `relaycommon.ValidateMultipartDirect`
- `BuildRequestURL` → `a.baseURL + createPath`
- `BuildRequestHeader` → JSON + `Authorization: Bearer ` + apiKey
- `BuildRequestBody`:
  - get raw body via storage / `GetTaskRequest`
  - unmarshal to `map[string]interface{}` with `common.Unmarshal`
  - logic model from `info.OriginModelName` (prefer) or `UpstreamModelName`
  - `buildUpstreamPayload(body, logic)`
  - `common.Marshal` → reader
- `DoRequest` → `channel.DoTaskApiRequest`
- `DoResponse` → parseCreateTaskID; return OpenAI Video queued with `OriginModelName`
- `FetchTask` / `ParseTaskResult` → use `parse.go`; `buildQueryURL` via `apiOrigin`
- `EstimateBilling` — if `billing_setting.IsPerSecondModel` or `isPerSecondModel`: seconds from duration (default `taskcommon.DefaultPerSecondPrechargeSeconds`); also set resolution tier into OtherRatios if project pattern supports it (follow 7tai / doubao: at minimum return `{"seconds": float64(sec)}`; resolution billing uses existing global resolution ratio pipeline when size/resolution on request — store tier in request path consistently with other video adaptors; if 7tai only returns seconds, match that)
- `AdjustBillingOnComplete` — same as 7tai (extract duration from task.Data)
- `GetModelList` / `GetChannelName` / `ConvertToOpenAIVideo` — same pattern as 7tai

**Step 3: Wire `relay/relay_adaptor.go`**

```go
taskmao "github.com/QuantumNous/new-api/relay/channel/task/mao"
```

```go
case constant.ChannelTypeMao:
    return &taskmao.TaskAdaptor{}
```

**Step 4: Run tests**

```bash
go test ./relay/channel/task/mao/ ./constant/ -count=1
go build ./relay/...
```

Expected: PASS / build OK.

**Step 5: Commit**

```bash
git add relay/channel/task/mao/ constant/channel.go constant/channel_base_url_test.go relay/relay_adaptor.go
git commit -m "feat: register mao channel type 68 and task adaptor"
```

---

### Task 5: Frontend channel options (default + classic)

**Files:**
- Modify: `web/default/src/features/channels/constants.ts`
- Modify: `web/default/src/features/channels/lib/channel-type-config.ts`
- Modify: `web/default/src/features/channels/lib/channel-utils.ts` (icon map if needed)
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx` — default models when type===68
- Modify: `web/classic/src/constants/channel.constants.js`
- Modify: `web/classic/src/components/table/channels/modals/EditChannelModal.jsx`
- Modify: `web/classic/src/helpers/lobe-icons.jsx` — case 68

**Step 1: default theme**

`constants.ts`:

```ts
68: 'mao',
```

Add `68` to the ordered type list array.  
Key prompt: `'Format: Bearer token (catertx / mao API Key)'`

`channel-type-config.ts`:

```ts
68: {
  id: 68,
  name: CHANNEL_TYPES[68],
  icon: 'openai',
  defaultBaseUrl: 'https://api.catertx.com',
  supportedModels: [
    'guanzhuan-seedance2.0',
    'guanzhuan-seedance2.0-mini',
    'guanzhuan-seedance2.5',
  ],
  hints: {
    key: 'Bearer token (catertx API Key)',
    models:
      'guanzhuan-seedance2.0, guanzhuan-seedance2.0-mini, guanzhuan-seedance2.5 (resolution → upstream sd-* model)',
    baseUrl: 'Default: https://api.catertx.com',
    other:
      'Async Seedance via POST/GET /v1/video/generations. Client uses logic model names; adaptor maps resolution (default 720p) to sd-2-0-* / sd-2-0-mini-* / sd-2-5-*. Unsupported tiers return 400. per_second + resolution billing.',
  },
},
```

`channel-mutate-drawer.tsx`: when `currentType === 68`, set `base_url` to `https://api.catertx.com` and models to the three logic names (comma-joined), matching case 67 pattern.

**Step 2: classic theme**

`channel.constants.js` — append `{ value: 68, color: 'green', label: 'mao' }`.

`EditChannelModal.jsx` — `case 68:` default models + base_url; key prompt helper if present.

`lobe-icons.jsx` — `case 68: // mao catertx Seedance`.

**Step 3: Typecheck (default)**

```bash
cd web/default && bun run typecheck
```

Fix any TS errors.

**Step 4: Commit**

```bash
git add web/default/src/features/channels/ web/classic/src/
git commit -m "feat: add mao channel UI options in default and classic"
```

---

### Task 6: Smoke checklist + final verify

**Step 1: Unit + build**

```bash
go test ./relay/channel/task/mao/ ./constant/ -count=1
go build -o NUL .
```

**Step 2: Manual smoke (when key available)**

1. Admin create channel type `mao`, base `https://api.catertx.com`, key set, models = three logic names
2. Configure model prices as `per_second` + resolution ratios in billing settings
3. `POST /v1/video/generations` with `guanzhuan-seedance2.0` + `resolution:1080p` → task queued
4. Confirm upstream received `sd-2-0-1080p` (via channel logs if available)
5. `guanzhuan-seedance2.5` + `1080p` → local 400
6. Poll until completed URL present

**Step 3: Final commit only if leftover fixes**

```bash
git status
```

---

## Execution notes

- Always use `common.Marshal` / `common.Unmarshal` for JSON in business code.
- Do not modify existing 7tai/doubao/zz adaptors.
- Do not add `/content` proxy unless smoke shows authenticated-only URLs.
- Keep `ChannelTypeDummy` last in the const block.
- i18n: channel type labels that are proper nouns (`mao`) can stay as-is; user-facing error strings from adaptor should be clear English (or follow existing task error style).

---

## Plan complete

Saved to `docs/superpowers/specs/2026-08-11-mao-seedance-adaptive-channel-plan.md`.
