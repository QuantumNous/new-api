# Sora2U Video Channel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add independent channel type `sora2u` (66) that exposes OpenAI Videos (`/v1/videos`) while translating to Sora2U’s `{success,task}` JSON API at `https://sora2u.com/api/v1/videos`.

**Architecture:** New task adaptor package (not forked Sora verbatim). Client stays on OpenAI Videos; adaptor maps fields, unwraps `{success,task}`, maps status, and surfaces public `video_url` into `TaskInfo.Url` / `metadata.url`. No credits sync, no cancel, no remix, no `/content` auth proxy.

**Tech Stack:** Go 1.22+ (Gin), `relay/channel/task` patterns (xai/th12345ai for URL + wrapped JSON; sora for OpenAI Videos façade), React/TS channel UI in `web/default` + classic parity, `common.Marshal`/`Unmarshal`.

**Spec:** `docs/superpowers/specs/2026-07-24-sora2u-channel-design.md`

---

### Task 1: Field-mapping + status-parse unit tests (TDD)

**Files:**
- Create: `relay/channel/task/sora2u/normalize_test.go`
- Create: `relay/channel/task/sora2u/parse_test.go`
- Create: `relay/channel/task/sora2u/normalize.go` (stubs → real impl)
- Create: `relay/channel/task/sora2u/parse.go` (stubs → real impl)

**Step 1: Write failing tests**

```go
package sora2u

import "testing"

func TestNormalizeCreateBody_SecondsToDuration(t *testing.T) {
	body := map[string]interface{}{"seconds": "8"}
	normalizeCreateBody(body)
	if got := asPositiveInt(body["duration"]); got != 8 {
		t.Fatalf("duration=%v", body["duration"])
	}
}

func TestNormalizeCreateBody_SizeToAspectRatio(t *testing.T) {
	body := map[string]interface{}{"size": "720x1280"}
	normalizeCreateBody(body)
	if body["aspect_ratio"] != "9:16" {
		t.Fatalf("aspect_ratio=%v", body["aspect_ratio"])
	}
}

func TestNormalizeCreateBody_ImageURLToReferenceURL(t *testing.T) {
	body := map[string]interface{}{"image_url": "https://cdn.example.com/a.png"}
	normalizeCreateBody(body)
	if body["reference_url"] != "https://cdn.example.com/a.png" {
		t.Fatalf("reference_url=%v", body["reference_url"])
	}
	if _, ok := body["image_url"]; ok {
		t.Fatal("image_url should be removed")
	}
}

func TestNormalizeCreateBody_ImageAliasToReference(t *testing.T) {
	body := map[string]interface{}{"image": "abc123"}
	normalizeCreateBody(body)
	ref, _ := body["reference"].(string)
	if ref == "" || !stringsHasPrefix(ref, "data:") && ref != "abc123" {
		// bare base64 may stay; prefer data URL if helper adds it
		if body["reference"] == nil {
			t.Fatalf("reference=%v", body["reference"])
		}
	}
}

func TestParseCreateResponse_UnwrapsTaskID(t *testing.T) {
	raw := []byte(`{"success":true,"task":{"id":"ckabc","status":"pending","model":"seedance-2.0"}}`)
	id, st, err := parseCreateTask(raw)
	if err != nil || id != "ckabc" || st != "pending" {
		t.Fatalf("id=%q status=%q err=%v", id, st, err)
	}
}

func TestParseTaskResult_CompletedSetsURL(t *testing.T) {
	raw := []byte(`{"success":true,"task":{"id":"ck1","status":"completed","progress":100,"video_url":"https://cdn.example.com/v.mp4"}}`)
	info, err := parseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Url != "https://cdn.example.com/v.mp4" {
		t.Fatalf("url=%q", info.Url)
	}
}

func TestParseTaskResult_FailedReason(t *testing.T) {
	raw := []byte(`{"success":true,"task":{"id":"ck1","status":"failed","error":"audit","error_code":"video_audit_rejected"}}`)
	info, err := parseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Reason == "" {
		t.Fatal("expected reason")
	}
}

func TestAPIOrigin_StripsAPISuffix(t *testing.T) {
	if got := apiOrigin("https://sora2u.com/api"); got != "https://sora2u.com" {
		t.Fatalf("got=%q", got)
	}
	if got := apiOrigin("https://sora2u.com"); got != "https://sora2u.com" {
		t.Fatalf("got=%q", got)
	}
}
```

Adjust helper names (`stringsHasPrefix` → `strings.HasPrefix`) in real file; keep tests compiling against package APIs you define.

**Step 2: Run — expect FAIL**

```bash
go test ./relay/channel/task/sora2u/ -count=1
```

Expected: undefined symbols / compile fail.

**Step 3: Implement `normalize.go` + `parse.go`**

- `apiOrigin(raw string) string` — trim trailing `/`, strip `/api/v1/videos`, `/api/v1`, `/api` suffixes (case-insensitive), inspired by `relay/channel/task/th12345ai/adaptor.go` `apiOrigin`
- `normalizeCreateBody(body map[string]interface{})` — per spec §4
- `asPositiveInt`, `mapSizeToAspectRatio`, remap `image`/`image_base64`→`reference`, `image_url`→`reference_url`
- `parseCreateTask(body []byte) (id, status string, err error)` — require `task.id`
- `parseTaskResult(body []byte) (*relaycommon.TaskInfo, error)` — status map pending→Queued, processing→InProgress, completed→Success+Url, failed→Failure+Reason

**Use `common.Unmarshal` / `common.Marshal`, not raw `encoding/json` marshal helpers for business decode/encode.**

**Step 4: Re-run — expect PASS**

```bash
go test ./relay/channel/task/sora2u/ -count=1
```

**Step 5: Commit**

```bash
git add relay/channel/task/sora2u/
git commit -m "test: sora2u normalize and task parse helpers"
```

---

### Task 2: Constants + channel type 66 registration

**Files:**
- Create: `relay/channel/task/sora2u/constants.go`
- Modify: `constant/channel.go` — insert before `ChannelTypeDummy`
- Modify: `constant/channel_base_url_test.go`
- Modify: `common/endpoint_type.go`

**Step 1: `constants.go`**

```go
package sora2u

const (
	createPath = "/api/v1/videos"
	ChannelName = "sora2u"
)

var ModelList = []string{
	"seedance-2.0",
	"seedance-2.0-character",
	"seedance-1.5",
}
```

**Step 2: `constant/channel.go`**

```go
ChannelTypeMegabyai       = 65
ChannelTypeSora2U         = 66
ChannelTypeDummy          // this one is only for count, do not add any channel after this
```

Append to `ChannelBaseURLs` (index 66): `"https://sora2u.com"`  
Add `ChannelTypeNames[ChannelTypeSora2U] = "sora2u"`

**Step 3: Test**

```go
if got := GetChannelDefaultBaseURL(ChannelTypeSora2U); got != "https://sora2u.com" {
	t.Fatalf("sora2u default base URL = %q", got)
}
```

**Step 4: `common/endpoint_type.go`**

```go
case constant.ChannelTypeSora, constant.ChannelTypeMegabyai, constant.ChannelTypeSora2U:
	endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIVideo}
```

**Step 5: Run + commit**

```bash
go test ./constant/ -run ChannelDefaultBaseURL -count=1
git add constant/channel.go constant/channel_base_url_test.go common/endpoint_type.go relay/channel/task/sora2u/constants.go
git commit -m "feat: register sora2u channel type 66"
```

---

### Task 3: TaskAdaptor + GetTaskAdaptor wiring

**Files:**
- Create: `relay/channel/task/sora2u/adaptor.go`
- Create: `relay/channel/task/sora2u/adaptor_test.go`
- Modify: `relay/relay_adaptor.go`

**Do NOT** add Sora2U to `controller/video_proxy.go` auth `/content` branch — `video_url` is a public CDN/token URL (spec §5).

**Step 1: Adaptor methods**

| Method | Behavior |
|--------|----------|
| `Init` | `baseURL=apiOrigin(...)`, store `apiKey` |
| `ValidateRequestAndSetAction` | If remix → local `not_supported`; else `ValidateMultipartDirect`; after parse, if `prompt` trim len `< 10` → local 400 |
| `EstimateBilling` | `seconds` from duration/seconds (default 5); return `map[string]float64{"seconds": float64(seconds)}` like Sora |
| `BuildRequestURL` | `a.baseURL + createPath` |
| `BuildRequestHeader` | `Authorization: Bearer`, `Content-Type: application/json`, `Accept: application/json` |
| `BuildRequestBody` | Always JSON upstream: from JSON body or multipart form → map → set `model` → `normalizeCreateBody` → `common.Marshal` |
| `DoRequest` | `channel.DoTaskApiRequest` |
| `DoResponse` | Read body; `parseCreateTask`; rewrite client response as OpenAI Video (`id`=public task id, `status` mapped, `object`=`video`); return upstream id + raw body |
| `FetchTask` | `GET {base}/api/v1/videos/{task_id}` + Bearer |
| `ParseTaskResult` | delegate `parseTaskResult` |
| `ConvertToOpenAIVideo` | Build from `originTask.ToOpenAIVideo()` or stored data; set `metadata.url` from `video_url` in Data / Task.Url |
| `GetModelList` / `GetChannelName` | `ModelList` / `ChannelName` |

Treat HTTP **202** as success in `DoResponse` (do not error solely because status != 200). Confirm shared `DoTaskApiRequest` / caller accepts 2xx including 202; if caller rejects non-200, handle inside `DoResponse` after reading body when status is 202.

**Multipart:** parse form fields (`prompt`, `model`, `seconds`, `duration`, `aspect_ratio`, `resolution`, `mute`, `disable_audio`, URL fields) + file parts → base64 data URLs into `reference` / `references`.

**Step 2: Register in `relay/relay_adaptor.go`**

```go
import tasksora2u "github.com/QuantumNous/new-api/relay/channel/task/sora2u"
// ...
case constant.ChannelTypeSora2U:
	return &tasksora2u.TaskAdaptor{}
```

**Step 3: Adaptor tests**

- `BuildRequestURL` ends with `/api/v1/videos`
- `ParseTaskResult` pending/processing/completed/failed
- Optional: `DoResponse` unwrap smoke with httptest Response

**Step 4: Run**

```bash
go test ./relay/channel/task/sora2u/ ./constant/ -count=1
```

**Step 5: Commit**

```bash
git add relay/channel/task/sora2u/ relay/relay_adaptor.go
git commit -m "feat: sora2u video task adaptor"
```

---

### Task 4: Frontend — web/default

**Files:**
- Modify: `web/default/src/features/channels/constants.ts` — `66: 'sora2u'`, key prompt
- Modify: `web/default/src/features/channels/lib/channel-utils.ts` — `66: 'OpenAI'`
- Modify: `web/default/src/features/channels/lib/channel-type-config.ts` — config block `66`
- Modify locales if channel labels need i18n keys (mirror megabyai)

**Config:**

```ts
66: {
  id: 66,
  name: CHANNEL_TYPES[66],
  icon: 'openai',
  defaultBaseUrl: 'https://sora2u.com',
  supportedModels: ['seedance-2.0', 'seedance-2.0-character', 'seedance-1.5'],
  hints: {
    key: 'Bearer token (Sora2U API Key, sk_sora_...)',
    models: 'seedance-2.0, seedance-2.0-character, seedance-1.5',
    baseUrl: 'Default: https://sora2u.com (paths under /api/v1/videos)',
    other:
      'Async video via OpenAI Videos façade. Upstream wraps {success,task}. Maps seconds→duration, size→aspect_ratio, images→reference/reference_url. Completed tasks expose metadata.url (public video_url). No channel credit sync.',
  },
},
```

**Step 1:** Apply edits  
**Step 2:** `cd web/default; bun run typecheck`  
**Step 3: Commit**

```bash
git add web/default/src/features/channels/
git commit -m "feat(web): add sora2u channel type in default UI"
```

---

### Task 5: Frontend — web/classic parity

**Files:**
- Modify: `web/classic/src/constants/channel.constants.js` — `{ value: 66, color: 'green', label: 'Sora2U' }`
- Modify: `web/classic/src/helpers/render.jsx` — `case 66`
- Modify: `web/classic/src/components/table/channels/modals/EditChannelModal.jsx` — default models + key prompt + help (mirror 65)
- Modify i18n: `en.json` / zh locales — `Sora2U 渠道说明`, `sora2u_key_prompt`

Default models in modal: `['seedance-2.0', 'seedance-2.0-character', 'seedance-1.5']`

**Step 1:** Apply  
**Step 2: Commit**

```bash
git add web/classic/
git commit -m "feat(web): add sora2u channel type in classic UI"
```

---

### Task 6: Smoke verification checklist

**Automated:**

```bash
go test ./relay/channel/task/sora2u/ ./constant/ -count=1
```

**Manual (with real `sk_sora_` key):**

1. Admin → create channel type Sora2U, Base URL `https://sora2u.com`, paste key, enable models  
2. Text-to-video:

```bash
curl -s -X POST "$BASE/v1/videos" \
  -H "Authorization: Bearer $USER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"一只柯基在海边奔跑，电影质感，黄昏光线","model":"seedance-2.0","duration":5}'
```

3. Poll `GET /v1/videos/{id}` until `completed`; confirm `metadata.url` plays  
4. Image-to-video with `reference_url` or multipart  
5. Short prompt (`"hi"`) → local 400  
6. Confirm existing Sora / MegaByAI channels still work

---

## Out of scope (do not do)

- `GET /api/v1/credits` channel balance
- `DELETE` cancel upstream
- remix / image models (`gemini-image`, `kontext-image`)
- Changing Sora / MegaByAI / Seedance adaptors
- Committing real API keys
- seedance-debug.html profiles (unless already editing that file)

---

## Execution handoff

After this plan is approved, implement task-by-task (TDD where specified). Prefer small commits matching each task’s commit message.
