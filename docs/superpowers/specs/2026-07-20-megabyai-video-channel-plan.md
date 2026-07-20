# MegaByAI Video Channel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add independent channel type `megabyai` (65) that relays OpenAI Videos–style async video to `https://newapi.megabyai.cc`, with MegaByAI field mapping and per-task billing.

**Architecture:** Fork the Sora task adaptor for `/v1/videos` create/poll/content-proxy behavior; add a JSON body normalizer (size→ratio/resolution, images→referenceImages, reject first/last frame). Register type 65 in backend constants + `GetTaskAdaptor`, video proxy auth path, OpenAIVideo endpoint typing, and default/classic channel UI.

**Tech Stack:** Go 1.22+ (Gin), existing `relay/channel/task/sora` patterns, React/TS channel config in `web/default` + classic parity, `common.Marshal`/`Unmarshal` for JSON.

**Spec:** `docs/superpowers/specs/2026-07-20-megabyai-video-channel-design.md`

---

### Task 1: Field-mapping unit tests (TDD)

**Files:**
- Create: `relay/channel/task/megabyai/normalize_test.go`
- Create: `relay/channel/task/megabyai/normalize.go` (minimal stubs so package compiles)

**Step 1: Write failing tests**

```go
package megabyai

import "testing"

func TestNormalizeCreateBody_SizeToRatioResolution(t *testing.T) {
	body := map[string]interface{}{
		"model":  "videos-mini",
		"prompt": "x",
		"size":   "1280x720",
	}
	normalizeCreateBody(body)
	if body["ratio"] != "16:9" {
		t.Fatalf("ratio=%v", body["ratio"])
	}
	if body["resolution"] != "720p" {
		t.Fatalf("resolution=%v", body["resolution"])
	}
	if _, ok := body["size"]; ok {
		t.Fatal("size should be removed")
	}
}

func TestNormalizeCreateBody_ImagesToReferenceImages(t *testing.T) {
	body := map[string]interface{}{
		"images": []interface{}{"https://example.com/a.png"},
	}
	normalizeCreateBody(body)
	refs, ok := body["referenceImages"].([]string)
	if !ok || len(refs) != 1 || refs[0] != "https://example.com/a.png" {
		t.Fatalf("referenceImages=%#v", body["referenceImages"])
	}
}

func TestNormalizeCreateBody_SecondsDurationSync(t *testing.T) {
	body := map[string]interface{}{"seconds": "8"}
	normalizeCreateBody(body)
	if body["duration"] != 8 && body["duration"] != float64(8) {
		// accept int after normalize
		if v, ok := body["duration"].(int); !ok || v != 8 {
			t.Fatalf("duration=%v", body["duration"])
		}
	}
}

func TestRejectFirstLastFrame(t *testing.T) {
	if err := rejectUnsupportedFrames(map[string]interface{}{"first_image": "x"}); err == nil {
		t.Fatal("expected error")
	}
}
```

**Step 2: Run tests — expect FAIL**

```bash
go test ./relay/channel/task/megabyai/ -count=1
```

Expected: compile error / undefined `normalizeCreateBody`.

**Step 3: Implement `normalize.go`**

Implement:
- `normalizeCreateBody(body map[string]interface{})`
- `rejectUnsupportedFrames(body map[string]interface{}) error`
- helpers: `syncDurationSeconds`, `mapSizeToRatioResolution`, `remapStringSlice`, `normalizeResolution`
- Mapping rules per spec §2 (do not overwrite existing ratio/resolution; delete aliases after remap)

**Step 4: Re-run tests — expect PASS**

```bash
go test ./relay/channel/task/megabyai/ -count=1
```

**Step 5: Commit**

```bash
git add relay/channel/task/megabyai/normalize.go relay/channel/task/megabyai/normalize_test.go
git commit -m "test: megabyai create-body field mapping"
```

---

### Task 2: Constants + channel type registration

**Files:**
- Create: `relay/channel/task/megabyai/constants.go`
- Modify: `constant/channel.go` (insert `ChannelTypeMegabyai = 65` before `ChannelTypeDummy`; append BaseURL + name)
- Modify: `constant/channel_base_url_test.go` (assert default URL)
- Modify: `common/endpoint_type.go` (Megabyai → `EndpointTypeOpenAIVideo`, same as Sora)

**Step 1: `constants.go`**

```go
package megabyai

var ModelList = []string{
	"videos-standard",
	"videos-fast",
	"videos-mini",
}

var ChannelName = "megabyai"
```

**Step 2: `constant/channel.go`**

- `ChannelTypeMegabyai = 65`
- `ChannelBaseURLs` index 65: `"https://newapi.megabyai.cc"`
- `ChannelTypeNames[ChannelTypeMegabyai] = "megabyai"`

**Step 3: Test default URL**

```go
if got := GetChannelDefaultBaseURL(ChannelTypeMegabyai); got != "https://newapi.megabyai.cc" {
	t.Fatalf("megabyai default base URL = %q", got)
}
```

**Step 4: Run**

```bash
go test ./constant/ -run ChannelDefaultBaseURL -count=1
```

**Step 5: Commit**

```bash
git add constant/channel.go constant/channel_base_url_test.go common/endpoint_type.go relay/channel/task/megabyai/constants.go
git commit -m "feat: register megabyai channel type 65"
```

---

### Task 3: TaskAdaptor (Sora-based) + wire GetTaskAdaptor

**Files:**
- Create: `relay/channel/task/megabyai/adaptor.go`
- Create: `relay/channel/task/megabyai/adaptor_test.go` (ParseTaskResult + BuildRequestURL smoke)
- Modify: `relay/relay_adaptor.go` (import + case)
- Modify: `controller/video_proxy.go` (auth content path like Sora)

**Step 1: Adaptor behavior (copy from Sora, then adjust)**

Copy structure from `relay/channel/task/sora/adaptor.go`, then:

| Method | Behavior |
|--------|----------|
| `EstimateBilling` | Do **not** override — use embedded `taskcommon.BaseBilling` (nil ratios = per-task) |
| `ValidateRequestAndSetAction` | Same as Sora generate path (`ValidateMultipartDirect`); **no remix** — if action is remix, return local unsupported error |
| `BuildRequestURL` | Only `POST {base}/v1/videos` (no remix URL) |
| `BuildRequestBody` | JSON: set `model`, call `rejectUnsupportedFrames`, then `normalizeCreateBody`; multipart: keep Sora multipart path **plus** after converting to JSON fields where possible, or reject multipart with clear error if MegaByAI is JSON-only — prefer: accept JSON fully; for multipart, map text fields + collect image URLs if any, build JSON upstream body (MegaByAI doc is JSON-only) |
| `DoResponse` / `FetchTask` / `ParseTaskResult` / `ConvertToOpenAIVideo` | Same as Sora (status `queued`/`in_progress`/`completed`/`failed`; content URL rewrite) |

**Multipart strategy (keep simple):** If `Content-Type` is multipart, parse form into a `map[string]interface{}` (prompt, seconds/duration, size, ratio, resolution, images from URL fields), then `normalizeCreateBody` and marshal as `application/json` to upstream; set request Content-Type to `application/json`.

**Step 2: Register**

In `relay/relay_adaptor.go` `GetTaskAdaptor`:

```go
case constant.ChannelTypeMegabyai:
	return &taskmegabyai.TaskAdaptor{}
```

In `controller/video_proxy.go`:

```go
case constant.ChannelTypeOpenAI, constant.ChannelTypeSora, constant.ChannelTypeMegabyai:
	videoURL = fmt.Sprintf("%s/v1/videos/%s/content", baseURL, task.GetUpstreamTaskID())
	req.Header.Set("Authorization", "Bearer "+channel.Key)
```

**Step 3: Adaptor tests**

- `ParseTaskResult` for `completed` / `failed` / `in_progress`
- `BuildRequestURL` ends with `/v1/videos`
- Optional: JSON body through `normalizeCreateBody` already covered in Task 1

**Step 4: Run**

```bash
go test ./relay/channel/task/megabyai/ ./constant/ -count=1
```

**Step 5: Commit**

```bash
git add relay/channel/task/megabyai/ adaptor.go adaptor_test.go relay/relay_adaptor.go controller/video_proxy.go
git commit -m "feat: megabyai Sora-based video task adaptor"
```

---

### Task 4: Frontend — web/default channel UI

**Files:**
- Modify: `web/default/src/features/channels/constants.ts` — type name + key prompt for `65`
- Modify: `web/default/src/features/channels/lib/channel-utils.ts` — icon group `65: 'OpenAI'`
- Modify: `web/default/src/features/channels/lib/channel-type-config.ts` — config block for `65`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx` — only if type list is not driven solely by constants (mirror th12345ai patterns)

**Config shape (mirror 64):**

```ts
65: {
  id: 65,
  name: CHANNEL_TYPES[65],
  icon: 'openai',
  defaultBaseUrl: 'https://newapi.megabyai.cc',
  supportedModels: ['videos-standard', 'videos-fast', 'videos-mini'],
  hints: {
    key: 'Bearer token (MegaByAI API Key)',
    models: 'videos-standard, videos-fast, videos-mini (per-task)',
    baseUrl: 'Default: https://newapi.megabyai.cc',
    other:
      'Async video: POST /v1/videos, poll GET /v1/videos/{id}, content GET .../content. Maps size→ratio/resolution, images→referenceImages. Supports referenceVideos/referenceAudios. No first_image/last_image.',
  },
},
```

**Step 1: Apply edits**  
**Step 2:** `cd web/default && bun run typecheck` (or project equivalent)  
**Step 3: Commit**

```bash
git add web/default/src/features/channels/
git commit -m "feat(web): add megabyai channel type in default UI"
```

---

### Task 5: Frontend — web/classic parity

**Files:**
- Modify: `web/classic/src/constants/channel.constants.js` — add `{ value: 65, color: 'green', label: 'megabyai' }`
- Modify: `web/classic/src/helpers/render.jsx` — `case 65` OpenAI icon
- Modify: `web/classic/src/components/table/channels/modals/EditChannelModal.jsx` — key prompt + channel help (mirror case 64)
- Modify: i18n locales `en.json`, `zh.json`, `zh-CN.json`, `zh-TW.json` — `megabyai 渠道说明`, `megabyai_key_prompt`

**Step 1: Apply edits mirroring th12345ai (64)**  
**Step 2: Commit**

```bash
git add web/classic/
git commit -m "feat(web): add megabyai channel type in classic UI"
```

---

### Task 6: Optional debug docs (YAGNI unless already editing)

**Only if** `seedance-debug.html` / `seedance-4models.md` are being updated in the same effort:

- Add profiles for `videos-mini` / `videos-fast` / `videos-standard` with `family: "megabyai"`, path `/v1/videos`
- Document type 65 in `seedance-4models.md`

Otherwise skip — not required for channel to work.

---

### Task 7: Smoke verification checklist

**Manual / local:**

1. Admin → create channel type `megabyai`, Base URL `https://newapi.megabyai.cc`, set API key, enable models
2. `POST /v1/videos` with `{ "model":"videos-mini", "prompt":"...", "duration":5, "ratio":"16:9", "resolution":"720p" }`
3. Poll until `completed`; open proxy `/v1/videos/{public_id}/content`
4. Negative: body with `first_image` → 4xx unsupported
5. With `size":"720x1280"` and no ratio → upstream receives `ratio=9:16`

**Automated:**

```bash
go test ./relay/channel/task/megabyai/ ./constant/ -count=1
```

**Final commit** (if any leftover): docs-only touch-ups referencing type 65.

---

## Out of scope (do not do)

- Changing Sora / Doubao / th12345ai adaptors
- Remix endpoint
- Upstream `cost_credits` settlement
- Committing real API keys
